import json
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user
from src.models.mindmap import MindMap
from src.schemas.mindmap import (
    MindMapGenerateRequest,
    MindMapExpandRequest,
    MindMapResponse,
    MindMapNode
)
from src.services.redis_service import redis_service
from src.services.mindmap_service import (
    compute_cache_key,
    generate_mindmap_tree,
    expand_node_hierarchy
)

logger = logging.getLogger("knowvia.mindmap.api")

router = APIRouter(
    prefix="/mindmap",
    tags=["MindMap"]
)


@router.post(
    "/generate",
    response_model=MindMapResponse,
    status_code=status.HTTP_200_OK
)
async def generate_mindmap(
    request: MindMapGenerateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Generate or retrieve a NotebookLM-style interactive Mind Map.
    Uses two-tier caching:
      - Layer 1: Redis Cloud (<2ms response)
      - Layer 2: Neon PostgreSQL
      - Layer 3: Gemini 1.5/2.5 Synthesis
    """
    if not request.document_ids and not (request.selected_text and request.selected_text.strip()):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one document_id or selected_text snippet must be provided to generate a mind map."
        )

    user_id = str(current_user.id)
    cache_key = compute_cache_key(user_id, request.document_ids or [], request.selected_text)
    redis_tree_key = redis_service.tree_key(user_id, cache_key)

    # 1. Layer 1 Check: Redis Cloud Cache (unless force_regenerate is True)
    if not request.force_regenerate:
        cached_data = await redis_service.get_json(redis_tree_key)
        if cached_data:
            try:
                res = MindMapResponse(**cached_data)
                res.cache_hit = True
                res.cache_source = "redis"
                return res
            except Exception as e:
                logger.warning(f"Error parsing Redis mindmap payload: {e}")

        # 2. Layer 2 Check: Neon PostgreSQL
        db_mm = db.query(MindMap).filter(
            MindMap.user_id == current_user.id,
            MindMap.cache_key == cache_key
        ).first()

        if db_mm:
            try:
                raw_nodes = json.loads(db_mm.nodes_json)
                pydantic_nodes = [MindMapNode(**n) for n in raw_nodes]
                doc_ids = json.loads(db_mm.document_ids_json)

                res = MindMapResponse(
                    id=str(db_mm.id),
                    title=db_mm.title,
                    document_ids=doc_ids,
                    nodes=pydantic_nodes,
                    cache_hit=True,
                    cache_source="postgres",
                    created_at=db_mm.created_at.isoformat() if db_mm.created_at else None,
                    updated_at=db_mm.updated_at.isoformat() if db_mm.updated_at else None
                )

                # Backfill Layer 1 Redis Cloud Cache
                await redis_service.set_json(redis_tree_key, res.model_dump(), ttl=7 * 86400)
                return res
            except Exception as e:
                logger.warning(f"Error restoring mind map from Postgres: {e}")

    # 3. Layer 3: Fresh Generation via Gemini
    try:
        fresh_response = await generate_mindmap_tree(
            db,
            user_id,
            request.document_ids or [],
            selected_text=request.selected_text,
            topic_title=request.topic_title
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception("Failed to synthesize mind map tree")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate mind map: {str(e)}"
        )

    # 4. Save/Upsert into Neon PostgreSQL
    existing_record = db.query(MindMap).filter(
        MindMap.user_id == current_user.id,
        MindMap.cache_key == cache_key
    ).first()

    nodes_json_payload = json.dumps([n.model_dump() for n in fresh_response.nodes], ensure_ascii=False)
    doc_ids_payload = json.dumps(fresh_response.document_ids)

    if existing_record:
        existing_record.title = fresh_response.title
        existing_record.nodes_json = nodes_json_payload
        existing_record.document_ids_json = doc_ids_payload
        db.commit()
        db.refresh(existing_record)
        saved_id = str(existing_record.id)
        created_at_str = existing_record.created_at.isoformat() if existing_record.created_at else None
        updated_at_str = existing_record.updated_at.isoformat() if existing_record.updated_at else None
    else:
        new_record = MindMap(
            user_id=current_user.id,
            cache_key=cache_key,
            title=fresh_response.title,
            document_ids_json=doc_ids_payload,
            nodes_json=nodes_json_payload
        )
        db.add(new_record)
        db.commit()
        db.refresh(new_record)
        saved_id = str(new_record.id)
        created_at_str = new_record.created_at.isoformat() if new_record.created_at else None
        updated_at_str = new_record.updated_at.isoformat() if new_record.updated_at else None

    fresh_response.id = saved_id
    fresh_response.created_at = created_at_str
    fresh_response.updated_at = updated_at_str
    fresh_response.cache_hit = False
    fresh_response.cache_source = "generated"

    # 5. Populate Layer 1 Redis Cloud Cache
    await redis_service.set_json(redis_tree_key, fresh_response.model_dump(), ttl=7 * 86400)

    return fresh_response


@router.post(
    "/expand",
    response_model=MindMapResponse,
    status_code=status.HTTP_200_OK
)
async def expand_node(
    request: MindMapExpandRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Expand a leaf node with deeper granular child concepts using targeted RAG retrieval.
    """
    try:
        updated_map = await expand_node_hierarchy(
            db=db,
            user_id=str(current_user.id),
            mindmap_id=request.mindmap_id,
            node_id=request.node_id
        )
        return updated_map
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.exception(f"Failed to expand mind map node '{request.node_id}'")
        raise HTTPException(status_code=500, detail=f"Failed to expand node: {str(e)}")


@router.get(
    "/{mindmap_id}",
    response_model=MindMapResponse,
    status_code=status.HTTP_200_OK
)
async def get_mindmap(
    mindmap_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Retrieve an existing Mind Map by its UUID.
    """
    try:
        mm_uuid = uuid.UUID(mindmap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mind map UUID format.")

    db_mm = db.query(MindMap).filter(
        MindMap.id == mm_uuid,
        MindMap.user_id == current_user.id
    ).first()

    if not db_mm:
        raise HTTPException(status_code=404, detail="Mind map not found or permission denied.")

    return MindMapResponse(
        id=str(db_mm.id),
        title=db_mm.title,
        document_ids=db_mm.document_ids_json or [],
        nodes=db_mm.nodes_json or [],
        cache_hit=True,
        cache_source="postgres",
        created_at=db_mm.created_at.isoformat() if db_mm.created_at else None,
        updated_at=db_mm.updated_at.isoformat() if db_mm.updated_at else None
    )


@router.delete(
    "/{mindmap_id}",
    status_code=status.HTTP_200_OK
)
async def delete_mindmap(
    mindmap_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Delete a saved mind map from Neon PostgreSQL and invalidate its Redis Cloud cache.
    """
    try:
        mm_uuid = uuid.UUID(mindmap_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid mind map UUID format.")

    db_mm = db.query(MindMap).filter(
        MindMap.id == mm_uuid,
        MindMap.user_id == current_user.id
    ).first()

    if not db_mm:
        raise HTTPException(status_code=404, detail="Mind map not found or permission denied.")

    cache_key = db_mm.cache_key
    user_id = str(current_user.id)

    # 1. Delete from PostgreSQL
    db.delete(db_mm)
    db.commit()

    # 2. Invalidate from Redis Cloud
    redis_tree_key = redis_service.tree_key(user_id, cache_key)
    await redis_service.delete_key(redis_tree_key)
    await redis_service.delete_pattern(f"mm:expand:{mindmap_id}:*")

    return {
        "status": "deleted",
        "id": mindmap_id,
        "message": "Mind map deleted from database and cache successfully."
    }

