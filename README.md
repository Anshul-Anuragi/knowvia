<div align="center">

# 🧠 Knowvia Enterprise RAG
### Next-Generation Retrieval-Augmented Generation (RAG) Platform with Vector Search & Grounded LLM Synthesis

[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Pinecone](https://img.shields.io/badge/Vector%20DB-Pinecone-000000?style=for-the-badge&logo=pinecone)](https://www.pinecone.io/)
[![Google Gemini](https://img.shields.io/badge/LLM-Gemini%201.5%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Container-Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

<br />

<p align="center">
  <b>Enterprise-ready AI assistant designed for high-precision document search, verified source attribution, and seamless workspace productivity.</b>
</p>

[Key Features](#-key-features) •
[Architecture](#-architecture) •
[Tech Stack](#-tech-stack) •
[Quickstart](#-quickstart-with-docker) •
[API Reference](#-api-endpoints) •
[Deployment](#-production-deployment)

---

</div>

## 📸 Demo & Screenshots

> **Tip**: Place your app screenshots or demo GIF in an `assets/` folder to preview them directly in your repository.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│                       [ Add Demo Video / GIF Here ]                        │
│                 assets/demo.gif or assets/chat_preview.png                 │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

<details>
<summary><b>🖼️ Click to expand screenshot gallery</b></summary>

| ChatGPT/Claude Style Full Workspace | Source Inspector & Citations |
| :---: | :---: |
| *(Add `assets/chat-view.png`)* | *(Add `assets/citation-modal.png`)* |

| Real-time Document Upload & Processing | Session Management & Dynamic Titles |
| :---: | :---: |
| *(Add `assets/upload-flow.png`)* | *(Add `assets/conversations.png`)* |

</details>

---

## ✨ Key Features

- **📄 Intelligent Document Ingestion**:
  - High-performance PDF text parsing and semantic recursive chunking.
  - Generates dense vector embeddings using `BAAI/bge-small-en-v1.5`.
  - Automated indexing to Pinecone serverless vector database with metadata tagging.

- **🔍 Grounded Hybrid Retrieval & LLM Synthesis**:
  - Contextual query rewriting to disambiguate multi-turn conversational context.
  - Cosine-similarity top-k semantic retrieval with exact source page attribution.
  - Fast, accurate synthesis via **Google Gemini 1.5 Flash** with hallucination suppression.

- **💬 Claude & ChatGPT-Grade Chat Workspace**:
  - Distraction-free, unboxed chat stream with rich GFM Markdown formatting (tables, lists, blockquotes).
  - Code blocks with syntax tags and one-click copy buttons.
  - Interactive source citation pills linking directly to verified document references.
  - Automatic dynamic session titling generated from the user's first query.

- **🛡️ Enterprise Security & Multi-Tenancy**:
  - JWT (JSON Web Token) authentication with BCrypt password hashing.
  - Strict user-scoped data isolation (users only search their own uploaded documents).
  - Safe file sanitization and MIME-type validation (20MB limit).

- **🐳 Production-Hardened & Containerized**:
  - Multi-stage Next.js standalone build reducing image footprint from ~1GB to ~120MB.
  - Multi-worker Gunicorn + Uvicorn process manager for FastAPI.
  - Built-in `/healthz` (liveness) and `/readyz` (DB readiness) health probes.
  - Background wake-up mechanism to prevent free-tier cloud container sleep.

---

## 🏗 Architecture

```
                               ┌───────────────────────────┐
                               │     Web User / Client     │
                               └─────────────┬─────────────┘
                                             │ HTTP/REST
                                             ▼
                               ┌───────────────────────────┐
                               │  Next.js 15 (App Router)  │
                               │  TypeScript + Tailwind    │
                               └─────────────┬─────────────┘
                                             │ API Requests (Port 8000)
                                             ▼
                               ┌───────────────────────────┐
                               │   FastAPI Backend Server  │
                               │   (Gunicorn + Uvicorn)    │
                               └──────┬──────┬──────┬──────┘
                                      │      │      │
            ┌─────────────────────────┘      │      └─────────────────────────┐
            │                                │                                │
            ▼                                ▼                                ▼
┌────────────────────────┐      ┌────────────────────────┐      ┌────────────────────────┐
│  PostgreSQL Database   │      │  Pinecone Vector Store │      │   Google Gemini API    │
│  - Users & Auth        │      │  - Semantic Chunks     │      │  - Query Rewriting     │
│  - Documents & Chunks  │      │  - Dense Embeddings    │      │  - Answer Synthesis    │
│  - Chat Sessions       │      │  - Document Metadata   │      │  - Grounded Citations  │
└────────────────────────┘      └────────────────────────┘      └────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS, Lucide Icons, `@tailwindcss/typography`, `react-markdown`, `remark-gfm` |
| **Backend** | Python 3.11, FastAPI, Gunicorn, Uvicorn, SQLAlchemy, Alembic, Pydantic v2 |
| **AI / Machine Learning** | Google Gemini API (`gemini-1.5-flash`), `sentence-transformers` (`bge-small-en-v1.5`), PyTorch, PyPDF |
| **Vector Engine** | Pinecone Serverless |
| **Relational Database** | PostgreSQL 16 (or SQLite for quick local test) |
| **DevOps & Containers** | Docker, Docker Compose, Multi-stage builds, Alpine base images |

---

## 🚀 Quickstart with Docker

The fastest way to launch the entire stack (Database + Backend + Frontend) is with **Docker Compose**:

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/enterprise-rag.git
cd enterprise-rag
```

### 2. Configure Environment Variables
Copy `.env.example` and set your API keys:
```bash
cp .env.example .env
```

Edit `.env` and fill in your keys:
```env
# Required API Keys
PINECONE_API_KEY=your_pinecone_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=generate_a_random_32_character_secret_key
```

### 3. Build & Run
```bash
docker compose up --build -d
```

### 4. Access the Application
* **Frontend Application**: [http://localhost:3000/chat](http://localhost:3000/chat)
* **Backend API Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check**: [http://localhost:8000/readyz](http://localhost:8000/readyz)

---

## 💻 Manual Local Development Setup

If you want to develop without Docker:

### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure backend environment
cp ../.env.example .env  # Add your DB URL, Pinecone & Gemini keys

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn src.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend

# Install Node packages
npm install

# Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/users/register` | Register a new user account |
| `POST` | `/users/login` | Authenticate and obtain JWT bearer token |
| `GET` | `/users/me` | Fetch authenticated user profile |
| `POST` | `/documents/upload` | Upload and vectorize PDF document |
| `GET` | `/documents/` | List all documents owned by user |
| `DELETE`| `/documents/{id}` | Delete document and remove associated Pinecone vectors |
| `GET` | `/conversations/` | Retrieve conversation history for active user |
| `DELETE`| `/conversations/{id}` | Delete a conversation thread and its messages |
| `POST` | `/chat/ask` | Send query, retrieve relevant chunks, and stream synthesized answer |
| `GET` | `/healthz` | Liveness health check probe |
| `GET` | `/readyz` | Readiness probe verifying live database connection |

---

## ⚙️ Environment Variables Reference

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/enterprise_rag` |
| `SECRET_KEY` | **Yes** | Secret key for JWT signature | `a_super_secret_random_string_32_chars` |
| `ALGORITHM` | No | JWT encryption algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Session token lifetime | `1440` (24 hours) |
| `PINECONE_API_KEY` | **Yes** | Pinecone vector database API key | `pcsk_...` |
| `PINECONE_INDEX_NAME` | No | Pinecone index name | `enterprise-rag` |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key | `AIzaSy...` |
| `ALLOWED_ORIGINS` | No | Whitelisted CORS origins | `http://localhost:3000,https://app.knowvia.com` |
| `NEXT_PUBLIC_API_URL` | **Yes** | Public endpoint of backend API | `http://localhost:8000` |

---

## ☁️ Production Deployment

### Recommended Strategy: Serverless / Cloud Managed
- **Frontend**: Deploy to **[Vercel](https://vercel.com)** with `NEXT_PUBLIC_API_URL` set to your backend domain.
- **Backend**: Deploy to **[Google Cloud Run](https://cloud.google.com/run)** or **[Render](https://render.com)** using [`backend/Dockerfile`](backend/Dockerfile).
- **Database**: Managed PostgreSQL on **[Neon](https://neon.tech)** or **[Supabase](https://supabase.com)**.
- **Vector DB**: **[Pinecone Serverless](https://www.pinecone.io)**.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <b>Built with ❤️ by Anshul Anuragi</b>
</div>
