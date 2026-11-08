from src.services.embedding_service import (
    generate_embedding
)

from src.services.pinecone_service import (
    index
)


def retrieve_chunks(
    query: str,
    top_k: int = 5,
    document_ids: list = None
):
    query_embedding = generate_embedding(
        query
    )

    query_kwargs = {
        "vector": query_embedding,
        "top_k": top_k,
        "include_metadata": True
    }

    if document_ids and len(document_ids) > 0:
        clean_ids = [str(did) for did in document_ids if did]
        if len(clean_ids) == 1:
            query_kwargs["filter"] = {"document_id": clean_ids[0]}
        elif len(clean_ids) > 1:
            query_kwargs["filter"] = {"document_id": {"$in": clean_ids}}

    results = index.query(**query_kwargs)

    contexts = []

    for match in results["matches"]:

        metadata = match.get(
            "metadata",
            {}
        )
        if not metadata.get("text"):
            continue


        contexts.append(
            {
                "text": metadata.get(
                    "text",
                    ""
                ),

                "document_id": metadata.get(
                    "document_id"
                ),

                "filename": metadata.get(
                    "filename"
                ),

                "chunk_id": metadata.get(
                    "chunk_id"
                ),

                "page_number": metadata.get(
                    "page_number",
                    1
                ),

                "score": match.get(
                    "score",
                    0.0
                )
            }
        )

    return contexts