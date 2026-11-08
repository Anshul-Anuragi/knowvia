
import uuid
from typing import Optional, Dict, Any

from sqlalchemy import Text
from sqlalchemy import String
from sqlalchemy import ForeignKey
from sqlalchemy import JSON

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from src.database.base import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    filename: Mapped[str] = mapped_column(
        String(255)
    )

    filepath: Mapped[str] = mapped_column(
        String(500)
    )

    content: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    uploaded_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id")
    )

    full_markdown: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    source_guide_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )

    chunk_map_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON,
        nullable=True
    )

    supabase_md_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )

