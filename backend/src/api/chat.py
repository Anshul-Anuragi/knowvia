from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException

from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user

from src.crud.conversation import (
    get_user_conversation
)

from src.schemas.chat import (
    ChatRequest,
    ChatResponse
)

from src.services.chat_service import (
    process_chat
)


router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)


@router.post(
    "/ask",
    response_model=ChatResponse
)
def ask_question(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):

    conversation = get_user_conversation(
        db,
        request.conversation_id,
        current_user.id
    )

    if not conversation:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return process_chat(
        db,
        request.conversation_id,
        request.question,
        mode=request.mode or "rag",
        model_name=request.model or "gemini-1.5-flash",
        document_ids=request.document_ids
    )