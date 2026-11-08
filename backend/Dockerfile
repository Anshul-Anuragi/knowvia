# ==========================================
# Stage 1: Build Dependencies
# ==========================================
FROM python:3.11-slim AS builder

WORKDIR /app

# Install system build dependencies for C-extensions (psycopg2, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .

# 1. Install lightweight CPU-only PyTorch first (saves >4.5 GB of NVIDIA CUDA bloat on cloud)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# 2. Install all remaining project dependencies into /opt/venv
RUN pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 2: Final Production Runner
# ==========================================
FROM python:3.11-slim AS runner

WORKDIR /app

# Install runtime libraries only (libpq for PostgreSQL, curl for healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder (accessible by all users)
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
ENV ENVIRONMENT=production

# Create dedicated non-root security user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --gid 1001 appuser

# Copy application source code and migrations
COPY . /app

# Ensure directories exist and are owned by appuser
RUN mkdir -p /app/uploads /app/reports /app/research_notes && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:8000/healthz || exit 1

# Run with Gunicorn process manager and Uvicorn workers (respects Render's WEB_CONCURRENCY)
CMD ["sh", "-c", "exec gunicorn src.main:app -w ${WEB_CONCURRENCY:-2} -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000 --access-logfile - --error-logfile -"]
