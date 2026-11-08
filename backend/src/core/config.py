from typing import List, Union, Optional
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    DATABASE_URL_UNPOOLED: Union[str, None] = None
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "knowvia-rag"
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    TAVILY_API_KEY: Optional[str] = None

    # Redis Cloud Cache URL (e.g. redis://default:password@host:port)
    REDIS_URL: Optional[str] = None

    # Cloud Object Storage (Supabase Storage / AWS S3 / Cloudflare R2)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_BUCKET: str = "knowvia-documents"

    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: Optional[str] = None
    S3_ENDPOINT_URL: Optional[str] = None


    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    ALLOWED_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://app.knowvia.com",
    ]

    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_ECHO: bool = False

    @model_validator(mode="after")
    def populate_gemini_key(self):
        if not self.GEMINI_API_KEY and self.GOOGLE_API_KEY:
            self.GEMINI_API_KEY = self.GOOGLE_API_KEY
        elif not self.GOOGLE_API_KEY and self.GEMINI_API_KEY:
            self.GOOGLE_API_KEY = self.GEMINI_API_KEY
        if not self.GEMINI_API_KEY:
            raise ValueError("Either GEMINI_API_KEY or GOOGLE_API_KEY must be configured in .env")
        return self

    @field_validator("REDIS_URL", mode="before")
    @classmethod
    def normalize_redis_url(cls, v: Optional[str]) -> Optional[str]:
        if not v:
            return None
        v = v.strip().strip('"').strip("'")
        if "redis://" in v or "rediss://" in v:
            idx = v.find("redis://")
            if idx == -1:
                idx = v.find("rediss://")
            return v[idx:]
        return v

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("DATABASE_URL_UNPOOLED", mode="before")
    @classmethod
    def normalize_unpooled_database_url(cls, v: Union[str, None]) -> Union[str, None]:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)


    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()