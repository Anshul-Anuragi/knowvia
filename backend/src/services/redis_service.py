import json
import logging
from typing import Any, Optional
import redis.asyncio as aioredis
from src.core.config import settings

logger = logging.getLogger("knowvia.redis")

# Default TTL: 7 days in seconds
DEFAULT_TTL = 7 * 24 * 60 * 60

class RedisService:
    def __init__(self):
        self._client: Optional[aioredis.Redis] = None
        self._enabled = bool(settings.REDIS_URL)

    def _get_client(self) -> Optional[aioredis.Redis]:
        if not self._enabled:
            return None
        if self._client is None and settings.REDIS_URL:
            try:
                self._client = aioredis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=2.0,
                    socket_timeout=2.0,
                    retry_on_timeout=False
                )
            except Exception as e:
                logger.warning(f"Failed to initialize Redis client: {e}. Falling back to PostgreSQL.")
                self._client = None
        return self._client

    # Key namespace helpers
    @staticmethod
    def doc_content_key(user_id: str, doc_id: str) -> str:
        return f"knowvia:doc_content:{user_id}:{doc_id}"

    @staticmethod
    def doc_text_key(user_id: str, doc_id: str) -> str:
        return f"mm:doc_text:{user_id}:{doc_id}"

    @staticmethod
    def tree_key(user_id: str, cache_key: str) -> str:
        return f"mm:tree:{user_id}:{cache_key}"

    @staticmethod
    def expand_key(mindmap_id: str, node_id: str) -> str:
        return f"mm:expand:{mindmap_id}:{node_id}"

    async def get_json(self, key: str) -> Optional[Any]:
        """Fetch and parse JSON from Redis with strict timeout safety."""
        client = self._get_client()
        if client is None:
            return None
        try:
            val = await client.get(key)
            if val is not None:
                return json.loads(val)
        except Exception as e:
            logger.warning(f"Redis get_json error for key '{key}': {e}. Continuing without Redis.")
        return None

    async def set_json(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> bool:
        """Serialize and save value to Redis with TTL."""
        client = self._get_client()
        if client is None:
            return False
        try:
            payload = json.dumps(value, ensure_ascii=False)
            await client.setex(key, ttl, payload)
            return True
        except Exception as e:
            logger.warning(f"Redis set_json error for key '{key}': {e}. Neon DB is primary.")
            return False

    async def delete_key(self, key: str) -> bool:
        """Delete a key safely."""
        client = self._get_client()
        if client is None:
            return False
        try:
            await client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Redis delete_key error for key '{key}': {e}.")
            return False

    async def delete_pattern(self, pattern: str) -> bool:
        """Scan and delete matching keys safely without blocking Redis."""
        client = self._get_client()
        if client is None:
            return False
        try:
            cursor = 0
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=pattern, count=100)
                if keys:
                    await client.delete(*keys)
                if cursor == 0:
                    break
            return True
        except Exception as e:
            logger.warning(f"Redis delete_pattern error for pattern '{pattern}': {e}.")
            return False

    async def ping(self) -> bool:
        client = self._get_client()
        if client is None:
            return False
        try:
            return await client.ping()
        except Exception:
            return False


# Singleton instance
redis_service = RedisService()

