import uuid

from sqlalchemy import ForeignKey, String

from sqlalchemy.orm import Mapped
from sqlalchemy.orm import mapped_column

from src.database.base import Base


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id")
    )
    
    title: Mapped[str] = mapped_column(
        String(255),
        default="New Conversation"
    )