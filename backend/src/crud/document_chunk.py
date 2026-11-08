
from src.models.document_chunk import (
    DocumentChunk
)


def create_chunk(
    db,
    data
):
    chunk = DocumentChunk(
        **data
    )

    db.add(chunk)

    db.commit()

    db.refresh(
        chunk
    )

    return chunk


def create_chunks_batch(
    db,
    chunks_data: list
):
    if not chunks_data:
        return []

    chunk_objects = [DocumentChunk(**item) for item in chunks_data]
    db.add_all(chunk_objects)
    db.commit()
    return chunk_objects


def delete_chunks_by_document(
    db,
    document_id
):

    (
        db.query(DocumentChunk)
        .filter(
            DocumentChunk.document_id
            == document_id
        )
        .delete(
            synchronize_session=False
        )
    )

    db.commit()

