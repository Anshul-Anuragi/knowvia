from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from uuid import UUID


class DocumentResponse(BaseModel):
    id: UUID
    filename: str
    uploaded_by: UUID
    file_size: Optional[str] = None
    storage_provider: Optional[str] = "local"

    class Config:
        from_attributes = True


class SourceGuide(BaseModel):
    summary: str
    key_topics: List[str] = []
    suggested_questions: List[str] = []


class ChunkMapItem(BaseModel):
    chunk_id: Optional[str] = None
    page_number: int = 1
    char_start: Optional[int] = 0
    char_end: Optional[int] = 0
    preview: str = ""


class DocumentContentResponse(BaseModel):
    id: str
    filename: str
    full_markdown: str
    source_guide: SourceGuide
    chunk_map: Dict[str, Any] = {}
    supabase_md_url: Optional[str] = None

    class Config:
        from_attributes = True

