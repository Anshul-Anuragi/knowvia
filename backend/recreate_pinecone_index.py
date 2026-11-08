#!/usr/bin/env python3
"""
Utility script to recreate the Pinecone index with the correct dimensions (384)
and standard vector index type (instead of document schema).
"""
import time
from src.core.config import settings
from pinecone import Pinecone, ServerlessSpec

pc = Pinecone(api_key=settings.PINECONE_API_KEY)
index_name = settings.PINECONE_INDEX_NAME

print(f"Connecting to Pinecone with index name: '{index_name}'...")
existing_indexes = [idx.name for idx in pc.list_indexes()]

if index_name in existing_indexes:
    print(f"Deleting incompatible index '{index_name}'...")
    pc.delete_index(index_name)
    time.sleep(3)

print(f"Creating fresh standard Vector Index '{index_name}' with 384 dimensions (for BGE-small)...")
pc.create_index(
    name=index_name,
    dimension=384,
    metric="cosine",
    spec=ServerlessSpec(
        cloud="aws",
        region="us-east-1"
    )
)

print(f"Waiting for index '{index_name}' to be ready...")
while not pc.describe_index(index_name).status["ready"]:
    time.sleep(1)

print(f"Index '{index_name}' successfully created and ready with 384 dimensions!")

