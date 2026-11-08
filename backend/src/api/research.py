import os
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from src.database.dependencies import get_db
from src.auth.dependencies import get_current_user
from src.crud.conversation import (
    get_user_conversation,
    create_conversation
)
from src.crud.message import create_message
from src.services.conversation_service import generate_conversation_title
from src.services.research_agent_service import (
    run_knowvia_research_agent,
    REPORTS_DIR
)

router = APIRouter(
    prefix="/research",
    tags=["Research Agent"]
)


class ResearchRunRequest(BaseModel):
    query: str = Field(description="The topic or research question to investigate")
    conversation_id: Optional[str] = Field(default=None, description="Optional existing conversation ID to persist chat context")
    selected_documents: Optional[List[str]] = Field(default_factory=list, description="IDs of user-selected uploaded documents to query")


class ResearchRunResponse(BaseModel):
    answer: str
    report_filename: str
    report_path: str
    tool_steps: List[Dict[str, Any]]
    sources: List[Dict[str, Any]]
    conversation_id: str


class ReportItem(BaseModel):
    title: str
    filename: str
    word_count: int
    size_bytes: int
    created_at: str


@router.post(
    "/run",
    response_model=ResearchRunResponse,
    status_code=status.HTTP_200_OK
)
async def run_research(
    request: ResearchRunRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """
    Executes the LangGraph Single-Agent Research Engine.
    Combines:
      - Internal Knowvia Pinecone RAG Search
      - Tavily Live Web Search
      - Wikipedia Knowledge Base
      - Epistemic Verification & Executive Report Writing
    Persists user query & final report into PostgreSQL messages table.
    """
    if not request.query.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Research query cannot be empty."
        )

    # 1. Resolve or create conversation
    conversation = None
    is_new_conversation = False

    if request.conversation_id:
        conversation = get_user_conversation(
            db,
            request.conversation_id,
            current_user.id
        )

    if not conversation:
        conversation = create_conversation(
            db,
            {
                "user_id": current_user.id,
                "title": generate_conversation_title(request.query)
            }
        )
        is_new_conversation = True

    # 2. Save user message to PostgreSQL
    create_message(
        db,
        {
            "conversation_id": conversation.id,
            "role": "user",
            "content": request.query
        }
    )

    # 3. Execute LangGraph Research Agent
    result = await run_knowvia_research_agent(
        topic=request.query,
        user_id=str(current_user.id),
        selected_document_ids=request.selected_documents
    )

    # 4. Save assistant report message to PostgreSQL
    create_message(
        db,
        {
            "conversation_id": conversation.id,
            "role": "assistant",
            "content": result["answer"],
            "sources": result["sources"]
        }
    )

    # Update conversation title if needed
    if not is_new_conversation and conversation.title in ["New Chat", "New Conversation"]:
        conversation.title = generate_conversation_title(request.query)
        db.commit()

    return ResearchRunResponse(
        answer=result["answer"],
        report_filename=result["report_filename"],
        report_path=result["report_path"],
        tool_steps=result["tool_steps"],
        sources=result["sources"],
        conversation_id=str(conversation.id)
    )


@router.get(
    "/reports",
    response_model=List[ReportItem],
    status_code=status.HTTP_200_OK
)
def list_reports(current_user=Depends(get_current_user)):
    """
    Lists all saved Markdown research reports in backend/reports/.
    """
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    items = []

    for path in REPORTS_DIR.glob("*.md"):
        try:
            stat = path.stat()
            content = path.read_text(encoding="utf-8", errors="ignore")
            word_count = len(content.split())
            clean_title = path.stem

            items.append(
                ReportItem(
                    title=clean_title,
                    filename=path.name,
                    word_count=word_count,
                    size_bytes=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_mtime).isoformat()
                )
            )
        except Exception:
            continue

    # Sort newest first
    items.sort(key=lambda x: x.created_at, reverse=True)
    return items


@router.get(
    "/reports/{filename}/download"
)
def download_report(
    filename: str,
    current_user=Depends(get_current_user)
):
    """
    Download a raw Markdown research report with Content-Disposition attachment.
    """
    safe_name = os.path.basename(filename)
    if not safe_name.endswith(".md"):
        safe_name += ".md"

    report_path = REPORTS_DIR / safe_name
    if not report_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Report '{safe_name}' not found."
        )

    return FileResponse(
        path=str(report_path),
        media_type="text/markdown; charset=utf-8",
        filename=safe_name,
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"'
        }
    )

