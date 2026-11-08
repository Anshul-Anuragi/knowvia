from typing import List, Optional
from pydantic import BaseModel, Field


class MindMapNode(BaseModel):
    id: str = Field(description="Unique string identifier for the node, e.g. 'root', 'node_1_2'")
    parent_id: Optional[str] = Field(default=None, description="Identifier of parent node, or null for root")
    label: str = Field(description="Crisp 2-6 word topic or concept title")
    summary: Optional[str] = Field(default="", description="1-2 sentence grounded executive summary of this concept")
    level: int = Field(default=0, description="Depth level: 0=root, 1=main topic, 2=sub-topic, 3=leaf detail")
    page_numbers: Optional[List[int]] = Field(default_factory=list, description="Associated document page numbers if known")
    source_ids: Optional[List[str]] = Field(default_factory=list, description="Document IDs grounding this concept")
    can_expand_more: Optional[bool] = Field(default=False, description="Whether node can be expanded further with deeper RAG retrieval")


class MindMapGenerateRequest(BaseModel):
    document_ids: Optional[List[str]] = Field(default_factory=list, description="List of document IDs to generate the mind map from")
    selected_text: Optional[str] = Field(default=None, description="Optional raw or selected text snippet to synthesize full mind map from in a single shot")
    topic_title: Optional[str] = Field(default=None, description="Optional title for the concept mind map")
    force_regenerate: Optional[bool] = Field(default=False, description="Bypass Redis and Postgres cache and re-synthesize from scratch")


class MindMapExpandRequest(BaseModel):
    mindmap_id: str = Field(description="The UUID of the mind map")
    node_id: str = Field(description="The node ID to expand with deeper child concepts")


class MindMapResponse(BaseModel):
    id: str
    title: str
    document_ids: List[str]
    nodes: List[MindMapNode]
    cache_hit: bool = False
    cache_source: Optional[str] = None  # "redis" | "postgres" | "generated"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

