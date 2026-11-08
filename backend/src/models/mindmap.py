import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from src.database.base import Base


class MindMap(Base):
    __tablename__ = "mind_maps"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"),
        index=True
    )

    # SHA-256 of user_id + sorted document_ids
    cache_key: Mapped[str] = mapped_column(
        String(64),
        index=True
    )

    title: Mapped[str] = mapped_column(
        String(255),
        default="Mind Map"
    )

    # JSON-encoded array of document IDs: '["uuid1", "uuid2"]'
    document_ids_json: Mapped[str] = mapped_column(
        Text,
        default="[]"
    )

    # JSON-encoded flat adjacency list of MindMap nodes
    nodes_json: Mapped[str] = mapped_column(
        Text,
        default="[]"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

