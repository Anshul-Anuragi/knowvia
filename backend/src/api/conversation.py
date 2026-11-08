from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from src.crud.message import (
    get_messages_by_conversation,
    delete_messages_by_conversation
)

from src.schemas.message import (
    MessageResponse
)

from typing import List

from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user

from src.crud.conversation import (
    create_conversation,
    get_user_conversation,
    get_conversations_by_user,
    delete_conversation
)
from src.schemas.conversation import (
    ConversationResponse
)


router = APIRouter(
    prefix="/conversations",
    tags=["Conversations"]
)


@router.post(
    "/",
    response_model=ConversationResponse
)
def start_conversation(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    conversation = create_conversation(
        db,
        current_user.id
    )

    return conversation


@router.get(
    "/",
    response_model=List[ConversationResponse]
)
def get_my_conversations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    return get_conversations_by_user(
        db,
        current_user.id
    )


@router.get(
    "/{conversation_id}/messages",
    response_model=List[MessageResponse]
)
def get_conversation_messages(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    conversation = get_user_conversation(
        db,
        conversation_id,
        current_user.id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return get_messages_by_conversation(
        db,
        conversation_id
    )

@router.delete(
    "/{conversation_id}"
)
def remove_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    conversation = get_user_conversation(
        db,
        conversation_id,
        current_user.id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    delete_messages_by_conversation(
        db,
        conversation_id
    )

    delete_conversation(
        db,
        conversation
    )

    return {
        "message": "Conversation deleted successfully",
        "conversation_id": conversation_id
    }