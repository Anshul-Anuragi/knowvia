import uuid

from sqlalchemy import Text
from sqlalchemy import ForeignKey

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from src.database.base import Base


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    document_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("documents.id")
    )

    chunk_text: Mapped[str] = mapped_column(
        Text
    )

    chunk_index: Mapped[int] = mapped_column()