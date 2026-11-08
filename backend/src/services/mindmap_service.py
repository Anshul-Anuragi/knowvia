import json
import re
import hashlib
import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
import google.generativeai as genai

from src.core.config import settings

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)
from src.models.document import Document
from src.models.document_chunk import DocumentChunk
from src.models.mindmap import MindMap
from src.schemas.mindmap import MindMapNode, MindMapResponse
from src.services.redis_service import redis_service
from src.services.retrieval_service import retrieve_chunks

logger = logging.getLogger("knowvia.mindmap")

CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
]

def compute_cache_key(user_id: str, document_ids: List[str], selected_text: Optional[str] = None) -> str:
    """Deterministic SHA-256 cache key based on user and sorted document IDs or text hash."""
    if selected_text and selected_text.strip():
        text_hash = hashlib.sha256(selected_text.strip().encode("utf-8")).hexdigest()[:32]
        seed = f"{user_id}:text:{text_hash}"
    else:
        sorted_docs = ",".join(sorted([str(d).strip() for d in document_ids if d]))
        seed = f"{user_id}:{sorted_docs}"
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()

def _clean_json_output(raw_text: str) -> str:
    """Strip markdown code fence wrappers from LLM response."""
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            return match.group(1).strip()
    # Find first '{' and last '}'
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return cleaned[first_brace : last_brace + 1]
    return cleaned

def _call_gemini_json(prompt: str) -> Dict[str, Any]:
    """Invoke Gemini with json structured response."""
    last_error = None
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(
                model_name,
                generation_config={"response_mime_type": "application/json"}
            )
            res = m.generate_content(prompt)
            if res and res.text:
                cleaned = _clean_json_output(res.text)
                return json.loads(cleaned)
        except Exception as e:
            last_error = e
            logger.warning(f"Gemini model {model_name} failed: {e}. Trying next...")
            continue

    # Fallback to non-mime_type generation if json mime_type fails
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(prompt)
            if res and res.text:
                cleaned = _clean_json_output(res.text)
                return json.loads(cleaned)
        except Exception as e:
            last_error = e
            continue

    if last_error:
        raise last_error
    raise RuntimeError("Failed to generate mind map JSON from Gemini.")

async def get_document_corpus(
    db: Session,
    user_id: str,
    document_ids: List[str]
) -> Tuple[str, str, List[str]]:
    """
    Fetch reconstructed document text using Redis Cache (Layer 1) -> Neon DB (Layer 2).
    Returns (aggregated_corpus_text, primary_document_title, verified_doc_ids).
    """
    corpus_parts = []
    primary_title = "Document Knowledge Base"
    valid_doc_ids = []

    for doc_id_str in document_ids:
        try:
            doc_uuid = uuid.UUID(doc_id_str)
        except Exception:
            continue

        cache_key = redis_service.doc_text_key(user_id, str(doc_uuid))
        cached_text = await redis_service.get_json(cache_key)

        if cached_text and isinstance(cached_text, dict) and "text" in cached_text:
            text = cached_text["text"]
            title = cached_text.get("filename", "Document")
            corpus_parts.append(f"=== Document: {title} ===\n{text}")
            if not valid_doc_ids:
                primary_title = title.replace(".pdf", "")
            valid_doc_ids.append(str(doc_uuid))
            continue

        # Layer 2: Neon PostgreSQL
        doc = db.query(Document).filter(
            Document.id == doc_uuid,
            Document.uploaded_by == uuid.UUID(user_id)
        ).first()

        if not doc:
            continue

        valid_doc_ids.append(str(doc.id))
        title = doc.filename or "Document"
        if not corpus_parts:
            primary_title = title.replace(".pdf", "")

        text_content = ""
        if doc.content and doc.content.strip():
            text_content = doc.content
        else:
            chunks = (
                db.query(DocumentChunk)
                .filter(DocumentChunk.document_id == doc.id)
                .order_by(DocumentChunk.chunk_index)
                .all()
            )
            text_content = "\n\n".join([c.chunk_text for c in chunks if c.chunk_text])

        if text_content:
            corpus_parts.append(f"=== Document: {title} ===\n{text_content}")
            # Cache in Redis (TTL: 7 days)
            await redis_service.set_json(
                cache_key,
                {"filename": title, "text": text_content[:50000]},
                ttl=7 * 86400
            )

    combined_text = "\n\n".join(corpus_parts)
    # Cap at ~65,000 characters to keep Gemini prompt dense & rapid
    if len(combined_text) > 65000:
        combined_text = combined_text[:65000] + "\n\n[... Remaining content truncated for synthesis ...]"

    return combined_text, primary_title, valid_doc_ids


def sanitize_and_link_nodes(
    nodes_raw: List[Dict[str, Any]],
    root_title: str,
    valid_doc_ids: List[str]
) -> List[Dict[str, Any]]:
    """
    Validates parent_id links, assigns levels, and ensures zero broken or orphan nodes.
    Ensures flat adjacency list matches NotebookLM structure (~35-55 nodes).
    """
    nodes_by_id: Dict[str, Dict[str, Any]] = {}
    sanitized: List[Dict[str, Any]] = []

    # 1. Ensure root exists
    root_found = False
    for item in nodes_raw:
        nid = str(item.get("id", "")).strip()
        if nid == "root" or item.get("parent_id") in [None, "", "null"]:
            item["id"] = "root"
            item["parent_id"] = None
            item["level"] = 0
            if not item.get("label"):
                item["label"] = root_title
            item["can_expand_more"] = False
            root_found = True
            nodes_by_id["root"] = item
            sanitized.append(item)
            break

    if not root_found:
        root_node = {
            "id": "root",
            "parent_id": None,
            "label": root_title,
            "summary": f"Central concept synthesis of {root_title}.",
            "level": 0,
            "page_numbers": [1],
            "source_ids": valid_doc_ids,
            "can_expand_more": False
        }
        nodes_by_id["root"] = root_node
        sanitized.append(root_node)

    # 2. Index all other nodes with fallback IDs
    node_counter = 1
    for item in nodes_raw:
        nid = str(item.get("id", "")).strip()
        if nid == "root":
            continue
        if not nid:
            nid = f"node_{node_counter}"
            node_counter += 1

        label = str(item.get("label") or f"Concept {node_counter}").strip()
        summary = str(item.get("summary") or "").strip()
        level = int(item.get("level", 1))
        parent_id = str(item.get("parent_id") or "root").strip()

        node_dict = {
            "id": nid,
            "parent_id": parent_id,
            "label": label[:60],
            "summary": summary[:250],
            "level": level,
            "page_numbers": item.get("page_numbers") or [],
            "source_ids": item.get("source_ids") or valid_doc_ids,
            "can_expand_more": bool(item.get("can_expand_more", level >= 3))
        }
        nodes_by_id[nid] = node_dict
        sanitized.append(node_dict)

    # 3. Parent link sanity pass: If parent does not exist, attach to 'root'
    for node in sanitized:
        if node["id"] == "root":
            continue
        pid = node["parent_id"]
        if pid not in nodes_by_id or pid == node["id"]:
            node["parent_id"] = "root"
            node["level"] = 1
        else:
            # Recompute accurate level from parent
            parent_node = nodes_by_id[pid]
            node["level"] = min(parent_node["level"] + 1, 4)

    return sanitized


async def generate_mindmap_tree(
    db: Session,
    user_id: str,
    document_ids: List[str],
    selected_text: Optional[str] = None,
    topic_title: Optional[str] = None
) -> MindMapResponse:
    """
    Synthesize complete 4-level NotebookLM Mind Map hierarchy from document corpus or selected text.
    """
    if selected_text and selected_text.strip():
        corpus_text = selected_text.strip()
        primary_title = topic_title.strip() if topic_title and topic_title.strip() else "Concept Knowledge Tree"
        valid_doc_ids = [d for d in document_ids if d]
    else:
        corpus_text, primary_title, valid_doc_ids = await get_document_corpus(db, user_id, document_ids)
        if not corpus_text or not valid_doc_ids:
            raise ValueError("No readable text found in the selected documents.")
        if topic_title and topic_title.strip():
            primary_title = topic_title.strip()

    prompt = f"""
You are an expert Knowledge Graph Architect replicating the exact visual concept tree of Google NotebookLM.

Analyze the document corpus below and generate an extensive, highly structured 4-LEVEL HIERARCHY MIND MAP.
Output MUST be a single valid JSON object.

HIERARCHY SPECIFICATIONS:
- Level 0 (Root, id: "root", parent_id: null): The primary document title or central topic theme (1 node).
- Level 1 (Major Themes, 4 to 6 nodes, parent_id: "root"): The foundational modules, pillars, or core topic divisions.
- Level 2 (Sub-Topics, 3 to 4 nodes under EACH Level 1 branch): Specific sub-components, architectural stages, or key domains.
- Level 3 (Concrete Leaf Details, 2 to 4 nodes under EACH Level 2 node): Explicit formulas, technical primitives, operational rules, metrics, or factual statements.

Total node count across the tree should be between 35 and 55 nodes so the graph is rich, deeply structured, and informative.

JSON SCHEMA:
{{
  "title": "{primary_title}",
  "nodes": [
    {{
      "id": "root",
      "parent_id": null,
      "label": "{primary_title}",
      "summary": "High-level executive overview of the document corpus.",
      "level": 0,
      "page_numbers": [1],
      "can_expand_more": false
    }},
    {{
      "id": "n1_1",
      "parent_id": "root",
      "label": "2 to 5 words topic title",
      "summary": "1 to 2 clear grounded explanatory sentences.",
      "level": 1,
      "page_numbers": [1, 2],
      "can_expand_more": false
    }},
    ...
  ]
}}

DOCUMENT CORPUS:
{corpus_text}
"""

    gemini_result = _call_gemini_json(prompt)
    raw_nodes = gemini_result.get("nodes", [])
    title = gemini_result.get("title") or primary_title

    # Sanitize and link
    sanitized_nodes = sanitize_and_link_nodes(raw_nodes, title, valid_doc_ids)

    # Prepare response
    map_id = str(uuid.uuid4())
    pydantic_nodes = [MindMapNode(**n) for n in sanitized_nodes]

    response = MindMapResponse(
        id=map_id,
        title=title,
        document_ids=valid_doc_ids,
        nodes=pydantic_nodes,
        cache_hit=False,
        cache_source="generated"
    )

    return response


async def expand_node_hierarchy(
    db: Session,
    user_id: str,
    mindmap_id: str,
    node_id: str
) -> MindMapResponse:
    """
    Deepens a specific node by generating 3-4 granular child nodes using Pinecone RAG retrieval.
    """
    # 1. Fetch mind map from Neon DB
    mm = db.query(MindMap).filter(
        MindMap.id == uuid.UUID(mindmap_id),
        MindMap.user_id == uuid.UUID(user_id)
    ).first()

    if not mm:
        raise ValueError("Mind map not found")

    nodes: List[Dict[str, Any]] = json.loads(mm.nodes_json)
    doc_ids: List[str] = json.loads(mm.document_ids_json)

    # 2. Find target node
    target_node = next((n for n in nodes if n["id"] == node_id), None)
    if not target_node:
        raise ValueError(f"Node '{node_id}' not found in mind map")

    # 3. Collect ancestor breadcrumbs for focused query
    ancestor_labels = []
    curr = target_node
    while curr and curr.get("parent_id"):
        curr = next((n for n in nodes if n["id"] == curr["parent_id"]), None)
        if curr and curr["id"] != "root":
            ancestor_labels.insert(0, curr["label"])

    breadcrumb = " > ".join(ancestor_labels + [target_node["label"]])

    # 4. RAG retrieval using Pinecone
    contexts = retrieve_chunks(
        query=f"{breadcrumb}: detailed components, specifications, examples, and rules",
        top_k=4,
        document_ids=doc_ids
    )

    context_str = "\n\n".join([c.get("text", "") for c in contexts if c.get("text")])
    if not context_str:
        # Fallback to document text
        corpus_text, _, _ = await get_document_corpus(db, user_id, doc_ids)
        context_str = corpus_text[:12000]

    # 5. Ask Gemini for 3 to 4 granular child nodes
    new_level = target_node["level"] + 1
    prompt = f"""
You are deepening a branch of a Google NotebookLM-style Concept Mind Map.
Target Parent Concept: "{target_node['label']}" (Context: {breadcrumb})
Summary: {target_node.get('summary', '')}

Generate exactly 3 to 4 specific, granular child concepts under this node based on the context below.

OUTPUT FORMAT (JSON only):
{{
  "new_nodes": [
    {{
      "label": "Crisp 2-5 word sub-concept",
      "summary": "1 grounded sentence explaining this sub-concept.",
      "page_numbers": [1]
    }}
  ]
}}

RETRIEVED CONTEXT:
{context_str}
"""

    gemini_res = _call_gemini_json(prompt)
    new_nodes_raw = gemini_res.get("new_nodes", [])

    generated_children = []
    for idx, raw in enumerate(new_nodes_raw, 1):
        child_id = f"{node_id}_sub_{idx}_{uuid.uuid4().hex[:4]}"
        child_dict = {
            "id": child_id,
            "parent_id": node_id,
            "label": str(raw.get("label", f"Sub-topic {idx}")).strip()[:60],
            "summary": str(raw.get("summary", "")).strip()[:250],
            "level": new_level,
            "page_numbers": raw.get("page_numbers") or target_node.get("page_numbers", [1]),
            "source_ids": doc_ids,
            "can_expand_more": False
        }
        generated_children.append(child_dict)

    # 6. Update target node
    target_node["can_expand_more"] = False
    nodes.extend(generated_children)

    # 7. Save to Neon PostgreSQL
    mm.nodes_json = json.dumps(nodes, ensure_ascii=False)
    db.commit()
    db.refresh(mm)

    # 8. Update Redis Cloud cache
    cache_key = mm.cache_key
    tree_key = redis_service.tree_key(user_id, cache_key)
    pydantic_nodes = [MindMapNode(**n) for n in nodes]

    response = MindMapResponse(
        id=str(mm.id),
        title=mm.title,
        document_ids=doc_ids,
        nodes=pydantic_nodes,
        cache_hit=False,
        cache_source="generated",
        created_at=mm.created_at.isoformat() if mm.created_at else None,
        updated_at=mm.updated_at.isoformat() if mm.updated_at else None
    )

    await redis_service.set_json(tree_key, response.model_dump(), ttl=7 * 86400)
    await redis_service.set_json(
        redis_service.expand_key(mindmap_id, node_id),
        {"expanded": True, "count": len(generated_children)},
        ttl=7 * 86400
    )

    return response

