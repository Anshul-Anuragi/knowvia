from uuid import UUID
from pydantic import BaseModel


class ConversationResponse(BaseModel):
    id: UUID
    title: str
    user_id: UUID

    model_config = {
        "from_attributes": True
    }

