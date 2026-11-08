from pinecone import Pinecone

from src.core.config import settings


pc = Pinecone(
    api_key=settings.PINECONE_API_KEY
)

index = pc.Index(
    settings.PINECONE_INDEX_NAME
)


def upsert_embedding(
    chunk_id: str,
    embedding: list[float],
    text: str,
    document_id: str,
    filename: str
):
    index.upsert(
        vectors=[
            {
                "id": chunk_id,
                "values": embedding,
                "metadata": {
                    "text": text,
                    "document_id": document_id,
                    "filename": filename
                }
            }
        ]
    )


def upsert_batch_embeddings(vectors: list[dict]):
    """
    Upserts a list of vectors to Pinecone in batches of up to 100.
    Greatly reduces network overhead and latency.
    """
    if not vectors:
        return

    batch_size = 100
    for i in range(0, len(vectors), batch_size):
        batch = vectors[i : i + batch_size]
        index.upsert(vectors=batch)

def delete_document_embeddings(
    document_id: str
):
    index.delete(
        filter={
            "document_id": document_id
        }
    )