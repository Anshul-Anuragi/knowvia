from typing import List, Optional
from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    conversation_id: str
    question: str
    mode: Optional[str] = Field(default="rag", description="Search mode: 'rag', 'research', or 'deep_research'")
    model: Optional[str] = Field(default="gemini-1.5-flash", description="AI model to query")
    document_ids: Optional[List[str]] = Field(default=None, description="Optional list of document IDs to filter by")


class Source(BaseModel):
    citation_index: int = 1
    document_id: str
    document_name: str = "Document"
    page_number: int = 1
    file_size: str = "Unknown"
    extracted_text: str = ""
    validated_sentences: List[str] = []
    confidence_score: float = 0.95
    is_verified: bool = True
    score: float = 0.0


class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
