from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from src.core.config import settings
from src.database.dependencies import get_db
from src.database.base import Base
from src.database.session import engine
import src.models  # Ensure all models are registered
from src.api.document import router as document_router
from src.api.user import router as user_router
from src.api.chat import router as chat_router
from src.api.conversation import router as conversation_router
from src.api.subscription import router as subscription_router
from src.api.mindmap import router as mindmap_router
from src.api.research import router as research_router


app = FastAPI(
    title="Knowvia Enterprise RAG API",
    version="1.0.0",
    description="Enterprise Retrieval-Augmented Generation (RAG) backend with Vector Hybrid Search and Gemini 1.5 LLM Synthesis.",
    docs_url="/docs" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if settings.DEBUG or settings.ENVIRONMENT != "production" else None,
)

# Auto-create tables safely on startup
@app.on_event("startup")
def on_startup():
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Warning during Base.metadata.create_all: {e}")

    try:
        with engine.connect() as conn:
            conn.execute(text("""
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS full_markdown TEXT;
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_guide_json JSONB;
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS chunk_map_json JSONB;
                ALTER TABLE documents ADD COLUMN IF NOT EXISTS supabase_md_url VARCHAR(500);
            """))
            conn.commit()
    except Exception as e:
        # If unprivileged connection or already up to date
        pass

# Production CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routes
app.include_router(user_router)
app.include_router(conversation_router)
app.include_router(chat_router)
app.include_router(document_router)
app.include_router(subscription_router)
app.include_router(mindmap_router)
app.include_router(research_router)



@app.get("/")
def root():
    return {
        "status": "healthy",
        "service": "Knowvia Enterprise RAG API",
        "version": "1.0.0",
        "environment": settings.ENVIRONMENT
    }


@app.get("/healthz")
def health_check():
    """Liveness probe for container orchestrators (Kubernetes / Cloud Run)"""
    return {"status": "ok"}


@app.get("/readyz")
def readiness_check(db: Session = Depends(get_db)):
    """Readiness probe that validates live database connectivity"""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as e:
        return {"status": "unhealthy", "database": str(e)}