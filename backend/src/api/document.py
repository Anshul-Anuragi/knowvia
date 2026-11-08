import os
import re
import uuid

from pathlib import Path
from typing import List

from fastapi import (
    APIRouter,
    UploadFile,
    File,
    Depends,
    HTTPException,
    status
)

from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user

from src.services.chunking_service import chunk_text

from src.crud.document_chunk import (
    create_chunk,
    create_chunks_batch,
    delete_chunks_by_document
)

from src.crud.document import (
    create_document,
    update_document_content,
    get_documents_by_user,
    get_document_by_id,
    delete_document
)

from src.schemas.document import (
    DocumentResponse,
    DocumentContentResponse
)

from src.services.pdf_service import (
    extract_text_from_pdf,
    extract_pages_from_pdf
)

from src.services.source_intelligence_service import (
    build_anchored_chunks,
    generate_source_guide,
    get_or_backfill_document_content
)

from src.services.embedding_service import (
    generate_embedding,
    generate_batch_embeddings
)

from src.services.pinecone_service import (
    upsert_embedding,
    upsert_batch_embeddings,
    delete_document_embeddings
)

from src.services.storage_service import (
    upload_pdf_file,
    delete_stored_file,
    upload_markdown_to_supabase,
    redis_service
)


router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)


UPLOAD_DIR = Path("uploads")

ALLOWED_CONTENT_TYPES = {
    "application/pdf"
}

MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


def _safe_filename(
    filename: str
) -> str:

    name = os.path.basename(
        filename or ""
    )

    name = re.sub(
        r"[^A-Za-z0-9._-]",
        "_",
        name
    )

    return name or "file"


# --------------------------------------------------
# Upload Document
# --------------------------------------------------

@router.post(
    "/upload",
    status_code=status.HTTP_201_CREATED
)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # Validate file type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported"
        )

    # Read file
    contents = file.file.read()

    # Validate file size
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="File too large. Maximum size is 20 MB"
        )

    # 1. Store PDF via Storage Service (Cloud Storage like Supabase/S3 or Local fallback)
    unique_name, storage_filepath_or_url = upload_pdf_file(
        file.filename,
        contents,
        file.content_type or "application/pdf"
    )

    document = None

    try:
        # 2. Extract PDF pages with page attribution
        pages = extract_pages_from_pdf(contents)

        if not pages or not any(p[1].strip() for p in pages):
            raise HTTPException(
                status_code=400,
                detail="Could not extract readable text from this PDF. Please ensure the document is not an image-only scan."
            )

        # 3. Build sequential deterministic anchored chunks, full_markdown, and chunk_map
        chunks_list, full_markdown, chunk_map = build_anchored_chunks(pages)
        aggregated_text = "\n\n".join([c["text"] for c in chunks_list])

        # 4. Generate AI Source Guide
        source_guide = generate_source_guide(aggregated_text, file.filename)

        # 5. Create document record in database
        document = create_document(
            db,
            {
                "filename": file.filename,
                "filepath": storage_filepath_or_url,
                "uploaded_by": current_user.id
            }
        )

        # 6. Upload .md to Supabase Storage
        supabase_md_url = upload_markdown_to_supabase(
            str(current_user.id),
            str(document.id),
            full_markdown
        )

        # 7. Update document with markdown, source guide, and chunk map
        document.content = aggregated_text
        document.full_markdown = full_markdown
        document.source_guide_json = source_guide
        document.chunk_map_json = chunk_map
        document.supabase_md_url = supabase_md_url
        db.commit()
        db.refresh(document)

        # 8. Batch insert chunks into database (Single atomic query)
        chunks_data = [
            {
                "document_id": document.id,
                "chunk_text": c["text"],
                "chunk_index": index
            }
            for index, c in enumerate(chunks_list)
        ]
        create_chunks_batch(db, chunks_data)

        # 9. Batch generate embeddings (Vectorized parallel inference with FastEmbed / SentenceTransformer)
        chunk_texts = [c["text"] for c in chunks_list]
        embeddings = generate_batch_embeddings(chunk_texts)

        # 10. Batch upsert vectors to Pinecone with chunk_id & page_number metadata
        vectors = [
            {
                "id": f"{document.id}_{c['chunk_id']}",
                "values": embeddings[index],
                "metadata": {
                    "text": c["text"],
                    "document_id": str(document.id),
                    "filename": file.filename,
                    "chunk_id": c["chunk_id"],
                    "page_number": c["page_number"]
                }
            }
            for index, c in enumerate(chunks_list)
        ]
        upsert_batch_embeddings(vectors)

        # 11. Cache payload in Redis Cloud (<2ms retrieval)
        try:
            redis_payload = {
                "id": str(document.id),
                "filename": document.filename,
                "full_markdown": document.full_markdown,
                "source_guide": document.source_guide_json,
                "chunk_map": document.chunk_map_json,
                "supabase_md_url": document.supabase_md_url,
            }
            await redis_service.set_json(
                redis_service.doc_content_key(str(current_user.id), str(document.id)),
                redis_payload,
                ttl=7 * 86400
            )
        except Exception as re_err:
            print(f"Redis cache notice: {re_err}")

    except HTTPException:
        delete_stored_file(storage_filepath_or_url)
        raise

    except Exception as e:
        import traceback
        traceback.print_exc()

        # Remove stored file
        delete_stored_file(storage_filepath_or_url)

        # Remove Pinecone vectors
        if document is not None:
            try:
                delete_document_embeddings(
                    str(document.id)
                )
            except Exception:
                pass

            # Remove chunks
            try:
                delete_chunks_by_document(
                    db,
                    document.id
                )
            except Exception:
                pass

            # Remove document
            try:
                delete_document(
                    db,
                    document
                )
            except Exception:
                pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )

    return {
        "message": "Uploaded successfully",
        "document_id": document.id
    }


def _format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


# --------------------------------------------------
# Get Current User's Documents
# --------------------------------------------------

@router.get(
    "/",
    response_model=List[DocumentResponse]
)
def get_my_documents(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    docs = get_documents_by_user(
        db,
        current_user.id
    )

    result = []
    for doc in docs:
        size_str = "Unknown"
        storage_prov = "local"
        if doc.filepath and doc.filepath.startswith("http"):
            if "supabase" in doc.filepath:
                storage_prov = "supabase"
            elif "s3" in doc.filepath or "amazonaws" in doc.filepath:
                storage_prov = "aws_s3"
            else:
                storage_prov = "cloud"
        elif doc.filepath and not doc.filepath.startswith("http") and os.path.exists(doc.filepath):
            try:
                size_str = _format_file_size(os.path.getsize(doc.filepath))
            except Exception:
                pass
        elif doc.content:
            size_str = _format_file_size(len(doc.content.encode("utf-8")))

        result.append(
            DocumentResponse(
                id=doc.id,
                filename=doc.filename,
                uploaded_by=doc.uploaded_by,
                file_size=size_str,
                storage_provider=storage_prov
            )
        )

    return result


# --------------------------------------------------
# Get Live Document Content & AI Source Guide
# --------------------------------------------------

@router.get(
    "/{document_id}/content",
    response_model=DocumentContentResponse
)
async def get_document_content(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Fetches the live Document content, source guide, and chunk anchors.
    Layer 1: Redis Cloud (<2ms)
    Layer 2: Neon PostgreSQL
    Layer 3: Automatic Lazy Backfill for existing PDFs
    """
    try:
        content = await get_or_backfill_document_content(
            db=db,
            document_id=document_id,
            user_id=str(current_user.id)
        )
        return content
    except ValueError as e:
        raise HTTPException(
            status_code=404,
            detail=str(e)
        )
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load document content: {str(e)}"
        )


# --------------------------------------------------
# Delete Document
# --------------------------------------------------

@router.delete(
    "/{document_id}"
)
async def remove_document(
    document_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    # Find only documents owned by current user
    document = get_document_by_id(
        db,
        document_id,
        current_user.id
    )

    if not document:
        raise HTTPException(
            status_code=404,
            detail="Document not found"
        )

    # Invalidate Redis cache
    try:
        await redis_service.delete_key(
            redis_service.doc_content_key(str(current_user.id), str(document.id))
        )
    except Exception:
        pass

    # 1. Delete Pinecone vectors
    delete_document_embeddings(
        str(document.id)
    )

    # 2. Delete stored file (cloud or local)
    delete_stored_file(
        document.filepath
    )

    # 3. Delete database chunks
    delete_chunks_by_document(
        db,
        document.id
    )

    # 4. Delete document
    delete_document(
        db,
        document
    )

    return {
        "message": "Document deleted successfully",
        "document_id": document.id
    }
