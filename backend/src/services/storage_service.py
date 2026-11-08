import os
import uuid
import re
from pathlib import Path
from typing import Optional, Tuple
import httpx

from src.core.config import settings

LOCAL_UPLOAD_DIR = Path("uploads")


def _sanitize_filename(filename: str) -> str:
    name = os.path.basename(filename or "")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name)
    return name or "file.pdf"


def get_storage_provider() -> str:
    """
    Detects which storage provider is configured.
    Returns: 'supabase', 's3', or 'local'.
    """
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        return "supabase"
    if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY and settings.S3_BUCKET_NAME:
        return "s3"
    return "local"


def upload_pdf_file(
    filename: str,
    file_bytes: bytes,
    content_type: str = "application/pdf"
) -> Tuple[str, str]:
    """
    Uploads a PDF file to the configured storage provider (Supabase Storage, S3, or Local Disk).
    
    Returns:
        (unique_filename, storage_path_or_url)
    """
    clean_name = _sanitize_filename(filename)
    unique_key = f"{uuid.uuid4().hex}_{clean_name}"
    provider = get_storage_provider()

    # 1. Supabase Storage (Cloud Object Storage)
    if provider == "supabase":
        bucket = settings.SUPABASE_BUCKET or "knowvia-documents"
        base_url = settings.SUPABASE_URL.rstrip("/")
        upload_endpoint = f"{base_url}/storage/v1/object/{bucket}/{unique_key}"

        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY,
            "Content-Type": content_type,
            "x-upsert": "true"
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(upload_endpoint, headers=headers, content=file_bytes)
                if res.status_code in [200, 201]:
                    public_url = f"{base_url}/storage/v1/object/public/{bucket}/{unique_key}"
                    return unique_key, public_url
                else:
                    print(f"Supabase storage upload failed with status {res.status_code}: {res.text}. Falling back to local.")
        except Exception as e:
            print(f"Supabase storage error: {e}. Falling back to local disk.")

    # 2. AWS S3 / Cloudflare R2 / MinIO
    elif provider == "s3":
        try:
            import boto3
            client_kwargs = {
                "aws_access_key_id": settings.AWS_ACCESS_KEY_ID,
                "aws_secret_access_key": settings.AWS_SECRET_ACCESS_KEY,
                "region_name": settings.AWS_REGION or "us-east-1",
            }
            if settings.S3_ENDPOINT_URL:
                client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

            s3 = boto3.client("s3", **client_kwargs)
            s3.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=unique_key,
                Body=file_bytes,
                ContentType=content_type,
            )
            # Form standard S3 URL or custom endpoint
            s3_url = f"https://{settings.S3_BUCKET_NAME}.s3.amazonaws.com/{unique_key}"
            return unique_key, s3_url
        except Exception as e:
            print(f"S3 upload error: {e}. Falling back to local disk.")

    # 3. Default: Local Disk Storage
    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    local_path = LOCAL_UPLOAD_DIR / unique_key
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    return unique_key, str(local_path)


def delete_stored_file(filepath_or_url: str) -> None:
    """
    Deletes the file from cloud object storage or local disk.
    """
    if not filepath_or_url:
        return

    # Check if it's a Supabase URL
    if settings.SUPABASE_URL and settings.SUPABASE_URL in filepath_or_url:
        bucket = settings.SUPABASE_BUCKET or "knowvia-documents"
        unique_key = filepath_or_url.split(f"/{bucket}/")[-1]
        base_url = settings.SUPABASE_URL.rstrip("/")
        delete_endpoint = f"{base_url}/storage/v1/object/{bucket}/{unique_key}"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY,
        }
        try:
            with httpx.Client(timeout=10.0) as client:
                client.delete(delete_endpoint, headers=headers)
        except Exception as e:
            print(f"Failed to delete file from Supabase storage: {e}")
        return

    # Check if local file
    try:
        if os.path.exists(filepath_or_url):
            os.remove(filepath_or_url)
    except Exception as e:
        print(f"Failed to remove local file: {e}")


from src.services.redis_service import redis_service, RedisService


def upload_markdown_to_supabase(
    user_id: str,
    doc_id: str,
    markdown_content: str,
    bucket: Optional[str] = None
) -> Optional[str]:
    """
    Uploads extracted {user_id}/{doc_id}.md to Supabase Storage bucket.
    Falls back gracefully to local disk and returns the path or URL.
    """
    target_bucket = bucket or settings.SUPABASE_BUCKET or "knowvia-sources"
    object_path = f"{user_id}/{doc_id}.md"

    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        base_url = settings.SUPABASE_URL.rstrip("/")
        upload_endpoint = f"{base_url}/storage/v1/object/{target_bucket}/{object_path}"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY,
            "Content-Type": "text/markdown; charset=utf-8",
            "x-upsert": "true"
        }

        try:
            with httpx.Client(timeout=15.0) as client:
                res = client.post(upload_endpoint, headers=headers, content=markdown_content.encode("utf-8"))
                if res.status_code in [200, 201]:
                    return f"{base_url}/storage/v1/object/public/{target_bucket}/{object_path}"
                elif res.status_code == 404:
                    # Try default knowvia-documents bucket
                    alt_endpoint = f"{base_url}/storage/v1/object/knowvia-documents/{object_path}"
                    alt_res = client.post(alt_endpoint, headers=headers, content=markdown_content.encode("utf-8"))
                    if alt_res.status_code in [200, 201]:
                        return f"{base_url}/storage/v1/object/public/knowvia-documents/{object_path}"
        except Exception as e:
            print(f"Supabase markdown upload warning: {e}. Falling back to local storage.")

    # Local fallback
    try:
        md_dir = LOCAL_UPLOAD_DIR / "markdowns" / str(user_id)
        md_dir.mkdir(parents=True, exist_ok=True)
        local_md_path = md_dir / f"{doc_id}.md"
        with open(local_md_path, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        return str(local_md_path)
    except Exception as e:
        print(f"Local markdown save warning: {e}")
        return None


