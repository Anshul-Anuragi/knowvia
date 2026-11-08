import io
import json
import logging
import os
import re
import uuid
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path
import httpx
from sqlalchemy.orm import Session
import google.generativeai as genai

from src.core.config import settings
from src.models.document import Document
from src.models.document_chunk import DocumentChunk
from src.services.pdf_service import extract_pages_from_pdf
from src.services.storage_service import (
    upload_markdown_to_supabase,
    redis_service,
)

logger = logging.getLogger("knowvia.source_intelligence")

if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

CANDIDATE_MODELS = [
    "gemini-3.5-flash",
    "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-flash-latest",
    "gemini-3.5-flash-lite",
]


def _clean_json_output(raw_text: str) -> str:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", cleaned)
        if match:
            return match.group(1).strip()
    first_brace = cleaned.find("{")
    last_brace = cleaned.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        return cleaned[first_brace : last_brace + 1]
    return cleaned


def generate_source_guide(text: str, filename: str) -> Dict[str, Any]:
    """
    Generate an executive 1-paragraph summary, 4-6 key topics, and 3 suggested questions
    grounded strictly in the document text.
    """
    fallback_title = filename.replace(".pdf", "").replace("_", " ").strip()
    sample_text = text[:15000].strip()

    prompt = f"""
You are an expert AI Research Assistant analyzing a document titled "{filename}".
Produce a concise, insightful Source Guide formatted as a single JSON object.

Requirements:
1. "summary": A clear, executive 1-paragraph summary (3 to 5 sentences) explaining the document's purpose, central thesis, and key takeaways.
2. "key_topics": An array of 4 to 6 concise technical concepts, domain topics, or major modules covered in the text (each 2-5 words).
3. "suggested_questions": An array of exactly 3 specific, insightful questions that can be answered from this document to help the user explore it.

Format strictly as JSON:
{{
  "summary": "...",
  "key_topics": ["...", "...", "...", "..."],
  "suggested_questions": ["...", "...", "..."]
}}

Document Excerpt:
{sample_text}
"""

    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(
                model_name,
                generation_config={"response_mime_type": "application/json"}
            )
            res = m.generate_content(prompt)
            if res and res.text:
                parsed = json.loads(_clean_json_output(res.text))
                if (
                    isinstance(parsed, dict)
                    and "summary" in parsed
                    and "key_topics" in parsed
                    and "suggested_questions" in parsed
                ):
                    return parsed
        except Exception as e:
            logger.debug(f"Model {model_name} source guide generation notice: {e}")
            continue

    # Non-json mime fallback
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(prompt)
            if res and res.text:
                parsed = json.loads(_clean_json_output(res.text))
                if isinstance(parsed, dict) and "summary" in parsed:
                    return parsed
        except Exception:
            continue

    # Heuristic fallback if LLM is unavailable
    first_lines = [line.strip() for line in sample_text.split("\n") if len(line.strip()) > 30]
    lead_summary = (
        " ".join(first_lines[:3])
        if first_lines
        else f"Comprehensive source document covering {fallback_title}."
    )
    if len(lead_summary) > 350:
        lead_summary = lead_summary[:347] + "..."

    return {
        "summary": lead_summary,
        "key_topics": [fallback_title, "Core Architecture", "Methodology", "Key Specifications"],
        "suggested_questions": [
            f"What are the main foundational principles outlined in {fallback_title}?",
            "What specific methodologies or technical components are discussed?",
            "What are the primary conclusions and practical implications?",
        ],
    }


def build_anchored_chunks(
    pages: List[Tuple[int, str]],
    chunk_size: int = 600
) -> Tuple[List[Dict[str, Any]], str, Dict[str, Any]]:
    """
    Splits page text into sequential, deterministic chunks:
    chunk_001, chunk_002, chunk_003...
    
    Returns:
      (chunks_list, full_markdown, chunk_map)
    """
    chunks_list: List[Dict[str, Any]] = []
    chunk_map: Dict[str, Any] = {}
    markdown_blocks: List[str] = []

    global_chunk_idx = 1
    running_char_offset = 0

    # If no pages supplied or all empty, handle gracefully
    valid_pages = [(p_num, p_text) for p_num, p_text in pages if p_text and p_text.strip()]
    if not valid_pages:
        valid_pages = [(1, "No readable text content found in document.")]

    for page_num, page_text in valid_pages:
        clean_text = page_text.strip()
        if not clean_text:
            continue

        # Split page into chunk_size slices respecting paragraph or sentence breaks where possible
        paragraphs = [p.strip() for p in clean_text.split("\n\n") if p.strip()]
        page_slices: List[str] = []

        if not paragraphs:
            paragraphs = [clean_text]

        current_slice = ""
        for p in paragraphs:
            if len(current_slice) + len(p) + 2 <= chunk_size:
                current_slice = f"{current_slice}\n\n{p}".strip()
            else:
                if current_slice:
                    page_slices.append(current_slice)
                if len(p) > chunk_size:
                    # Break long paragraphs into sub-chunks
                    for i in range(0, len(p), chunk_size):
                        page_slices.append(p[i : i + chunk_size].strip())
                    current_slice = ""
                else:
                    current_slice = p

        if current_slice:
            page_slices.append(current_slice)

        if not page_slices:
            page_slices = [clean_text[:chunk_size]]

        for slice_text in page_slices:
            if not slice_text.strip():
                continue

            chunk_id = f"chunk_{global_chunk_idx:03d}"
            char_start = running_char_offset
            char_end = char_start + len(slice_text)
            running_char_offset = char_end + 2

            preview_len = 140
            preview = slice_text[:preview_len].strip()
            if len(slice_text) > preview_len:
                preview += "..."

            chunk_item = {
                "chunk_id": chunk_id,
                "page_number": page_num,
                "text": slice_text,
                "char_start": char_start,
                "char_end": char_end,
                "preview": preview,
            }
            chunks_list.append(chunk_item)

            chunk_map[chunk_id] = {
                "chunk_id": chunk_id,
                "page_number": page_num,
                "char_start": char_start,
                "char_end": char_end,
                "preview": preview,
            }

            # Build markdown anchor block
            markdown_blocks.append(
                f'<div id="{chunk_id}" data-page="{page_num}" class="knowvia-chunk">\n\n{slice_text}\n\n</div>'
            )

            global_chunk_idx += 1

    full_markdown = "\n\n".join(markdown_blocks)
    return chunks_list, full_markdown, chunk_map


async def get_or_backfill_document_content(
    db: Session,
    document_id: str,
    user_id: str
) -> Dict[str, Any]:
    """
    Fetches the live Document content with two-tier caching:
      1. Redis Cloud (<2ms)
      2. Neon PostgreSQL
      3. Automatic Backfill for legacy PDFs missing full_markdown
    """
    redis_key = redis_service.doc_content_key(user_id, document_id)

    # 1. Check Redis Cloud Cache
    cached_content = await redis_service.get_json(redis_key)
    if cached_content and isinstance(cached_content, dict) and "full_markdown" in cached_content:
        return cached_content

    # 2. Check Neon PostgreSQL
    doc_uuid = uuid.UUID(document_id)
    doc = db.query(Document).filter(
        Document.id == doc_uuid,
        Document.uploaded_by == uuid.UUID(user_id)
    ).first()

    if not doc:
        raise ValueError("Document not found or access denied")

    # If document already has full_markdown and source_guide_json
    if doc.full_markdown and doc.source_guide_json and doc.chunk_map_json:
        payload = {
            "id": str(doc.id),
            "filename": doc.filename,
            "full_markdown": doc.full_markdown,
            "source_guide": doc.source_guide_json,
            "chunk_map": doc.chunk_map_json,
            "supabase_md_url": doc.supabase_md_url,
        }
        await redis_service.set_json(redis_key, payload, ttl=7 * 86400)
        return payload

    # 3. Automatic Backfill for legacy PDFs
    logger.info(f"Backfilling Live Markdown & Source Guide for document {doc.id} ({doc.filename})...")

    # Extract pages
    pages: List[Tuple[int, str]] = []

    # Try reading file from filepath (local or remote URL)
    if doc.filepath:
        if os.path.exists(doc.filepath):
            try:
                with open(doc.filepath, "rb") as f:
                    pages = extract_pages_from_pdf(f.read())
            except Exception as e:
                logger.warning(f"Failed to read local PDF for backfill: {e}")
        elif doc.filepath.startswith("http"):
            try:
                with httpx.Client(timeout=25.0) as client:
                    resp = client.get(doc.filepath)
                    if resp.status_code == 200:
                        pages = extract_pages_from_pdf(resp.content)
            except Exception as e:
                logger.warning(f"Failed to fetch remote PDF for backfill: {e}")

    # Fallback to document_chunks table or doc.content if PDF file could not be read
    if not pages:
        db_chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == doc.id)
            .order_by(DocumentChunk.chunk_index)
            .all()
        )
        if db_chunks:
            pages = [(1, "\n\n".join([c.chunk_text for c in db_chunks]))]
        elif doc.content:
            pages = [(1, doc.content)]
        else:
            pages = [(1, f"Extracted knowledge source for {doc.filename}.")]

    # Build anchored chunks, markdown and map
    chunks_list, full_markdown, chunk_map = build_anchored_chunks(pages)

    # Aggregate text for source guide
    aggregated_text = "\n\n".join([c["text"] for c in chunks_list])
    source_guide = generate_source_guide(aggregated_text, doc.filename)

    # Upload markdown to Supabase Storage
    supabase_url = upload_markdown_to_supabase(user_id, str(doc.id), full_markdown)

    # Update database
    doc.full_markdown = full_markdown
    doc.source_guide_json = source_guide
    doc.chunk_map_json = chunk_map
    doc.supabase_md_url = supabase_url
    db.commit()
    db.refresh(doc)

    payload = {
        "id": str(doc.id),
        "filename": doc.filename,
        "full_markdown": doc.full_markdown,
        "source_guide": doc.source_guide_json,
        "chunk_map": doc.chunk_map_json,
        "supabase_md_url": doc.supabase_md_url,
    }

    # Cache in Redis Cloud
    await redis_service.set_json(redis_key, payload, ttl=7 * 86400)
    return payload

