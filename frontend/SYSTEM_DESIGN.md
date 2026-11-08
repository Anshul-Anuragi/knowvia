# Knowvia AI — End-to-End System Design & Workflow

## 1. Overview

Knowvia AI is an **Enterprise Retrieval-Augmented Generation (RAG) platform** built with a **Next.js 14 frontend** and a **FastAPI backend** (`http://127.0.0.1:8000`). It enables users to upload PDF documents, ask grounded questions with verified citations, generate executive research reports via a LangGraph agent, and visualize knowledge as interactive mind maps.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                │
│  Browser (Next.js 14 · React 18 · TypeScript · Tailwind CSS)       │
└─────────────────────────────────────────────────────────────────────┘
                                      │ HTTPS / fetch + JWT Bearer
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / BACKEND                          │
│                  FastAPI @ http://127.0.0.1:8000                    │
│                                                                     │
│  ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐        │
│  │ /users   │ │ /conversations│ │ /chat    │ │ /documents   │        │
│  │ Auth     │ │ History     │ │ RAG Q&A  │ │ KB Mgmt      │        │
│  └──────────┘ └─────────────┘ └──────────┘ └──────────────┘        │
│                                                                     │
│  ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌──────────────┐        │
│  │ /mindmap │ │ /research   │ │ /subscriptions│ │ /healthz   │        │
│  │ MindMap  │ │ LangGraph   │ │ Billing  │ │ Health Probes│        │
│  └──────────┘ └─────────────┘ └──────────┘ └──────────────┘        │
└─────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────┬───────┼───────┬─────────┐
                    ▼         ▼       ▼       ▼         ▼
           ┌────────────┐ ┌───────┐ ┌───────┐ ┌────────┐ ┌──────┐
           │ PostgreSQL │ │ Redis │ │Pinecone│ │ Gemini │ │Tavily│
           │ (Neon DB)  │ │Cloud  │ │Vector  │ │ 1.5 LLM│ │Search│
           └────────────┘ └───────┘ └────────┘ └────────┘ └──────┘
```

---

## 3. Frontend Architecture (`src/`)

### 3.1 Entry & Layout
| File | Role |
|------|------|
| `src/app/layout.tsx` | Root layout. Wraps app in `AuthProvider` + `ChatProvider`. Sets dark theme & metadata. |
| `src/app/page.tsx` | Main shell: 3-column layout (`LeftSidebar` | Center `ChatContainer` + `ChatInput` | `RightValidationPanel`) plus all modals. |

### 3.2 Context Layer (React Context)
| Context | Responsibility |
|---------|---------------|
| `AuthContext.tsx` | JWT session: token in `localStorage`, `login`/`register`/`logout`, `getMe`, auto-init on load. |
| `ChatContext.tsx` | Global chat state: conversations, messages, streaming typewriter, search mode (`rag` \| `research` \| `deep_research`), document selection, mind map data, health polling every 20s. |

### 3.3 API Client (`src/lib/api.ts`)
Singleton `ApiClient` wrapping `fetch`. Attaches `Authorization: Bearer <token>` from `localStorage`. Handles JSON + `FormData` (PDF upload). Endpoint groups:

1. **`/users/*`** — register, login, getMe, admin, logout
2. **`/conversations/*`** — list, create, get messages, delete
3. **`/chat/ask`** — RAG question answering
4. **`/documents/*`** — list, upload PDF, delete
5. **`/subscriptions/*`** — plans, my subscription, checkout, contact sales
6. **`/mindmap/*`** — generate, expand node, delete
7. **`/research/*`** — run research agent, get reports, download URL
8. **`/healthz`, `/readyz`, `/`** — health probes

### 3.4 UI Components

**Center Workspace**
- `ChatContainer.tsx` — renders streaming AI messages, citation buttons `[1][2]`, feedback (thumbs up/down), copy, starter prompts, `ResearchReportCard`.
- `ChatInput.tsx` — textarea input, PDF upload, mode selector (RAG / Research / Deep Research), send button, upload toast.

**Right Panel**
- `RightValidationPanel.tsx` — dual tab: **Source Validation** (extracted text chunks with sentence highlighting, confidence %, page number, "Mind Map" chip) and **Mind Map** (embeds `MindMapCanvas`). Resizable width. Fullscreen studio modal.

**Mind Map**
- `MindMapCanvas.tsx` — interactive SVG canvas with tidy-tree bottom-up layout, cubic Bézier connectors, pan/zoom, zoom-to-fit, collapse/expand branches, node-level color theming (slate-indigo root → teal subs → emerald leaves), export to PNG/PDF, "Ask in Chat" from selected node, cache badge (Redis / Postgres / Generated).

**Left Sidebar**
- `LeftSidebar.tsx` — brand header, new chat, nav tabs (Chat / Sources / Knowledge Base / Customization), conversation list, document selector with checkboxes, user profile bar with tier badge, upgrade/settings/help, logout.

**Modals** (`src/components/modals/`)
- `AuthModal`, `UpgradeModal`, `KnowledgeBaseModal`, `SettingsModal`, `CustomizationModal`, `DocInfoModal`

---

## 4. Backend Endpoint Reference

### 4.1 Authentication — `GET/POST /users/*`
- `POST /users/register` — create user (name, email, password) → returns `User`
- `POST /users/login` — returns `Token` (access_token); frontend stores in `localStorage`
- `GET /users/me` — authenticated profile (Bearer)
- `GET /users/admin` — admin dashboard
- `POST /users/logout` — client clears storage

### 4.2 Conversations — `GET/POST/DELETE /conversations/*`
- `GET /conversations/` — list user conversations
- `POST /conversations/` — create new conversation
- `GET /conversations/{id}/messages` — message history
- `DELETE /conversations/{id}` — delete conversation

### 4.3 RAG Chat — `POST /chat/ask`
Request: `conversation_id`, `question`, `mode` (`rag`\|`research`\|`deep_research`), `model`, `document_ids`
Response: `answer`, `sources[]` (each with `document_id`, `document_name`, `page_number`, `extracted_text`, `validated_sentences`, `confidence_score`, `is_verified`, `score`, `citation_index`)

### 4.4 Documents — `GET/POST/DELETE /documents/*`
- `GET /documents/` — list uploaded documents
- `POST /documents/upload` — multipart PDF upload → chunked, embedded (FastEmbed ONNX), indexed to Pinecone
- `DELETE /documents/{id}` — delete document

### 4.5 Subscriptions — `GET/POST /subscriptions/*`
- `GET /subscriptions/plans` — list plans (Free/Pro/Max/Team/Business with limits)
- `GET /subscriptions/me` — user subscription & limits
- `POST /subscriptions/checkout` — Stripe checkout session
- `POST /subscriptions/contact-sales` — enterprise inquiry

### 4.6 Mind Map — `POST/DELETE /mindmap/*`
- `POST /mindmap/generate` — from `document_ids` or `selected_text` + `topic_title`; returns nodes, cache_source (`redis`\|`postgres`\|`generated`)
- `POST /mindmap/expand` — deepen a leaf node (RAG retrieval)
- `DELETE /mindmap/{id}` — delete

### 4.7 Research Agent — `GET/POST /research/*`
- `POST /research/run` — LangGraph agent executes tools (`search_uploaded_documents`, `tavily_search`, `wikipedia`, `get_current_date`, `save_report`) → executive report + tool trace
- `GET /research/reports` — list generated reports
- `GET /research/reports/{filename}/download` — download report

### 4.8 Health — `GET /readyz`, `GET /healthz`, `GET /`
Polled by frontend every 20s; drives `isReady` / `systemHealth` state.

---

## 5. Data Flow Diagrams (Textual)

### 5.1 RAG Q&A Flow
```
User types question in ChatInput
        │
        ▼
ChatContext.sendMessage() ───► createNewConversation (if none)
        │
        ▼
ApiClient.askQuestion(POST /chat/ask)
        │
        ├──────────────────────────────────────────────────────┐
        ▼                                                      │
Backend: vector search Pinecone (doc chunks)                   │
        │                                                      │
        ▼                                                      │
Gemini 1.5 synthesizes answer + citations                      │
        │                                                      │
        ▼                                                      │
Backend returns { answer, sources[] }                          │
        │                                                      │
        ▼                                                      │
ChatContext streamTokens() typewriter (12ms/word)              │
        │                                                      │
        ▼                                                      │
ChatContainer renders message + citation buttons [1][2]        │
        │                                                      │
        ▼                                                      │
User clicks citation ──► RightValidationPanel shows            │
        validated chunk text + confidence + page               │
        │                                                      │
        ▼                                                      │
Optional: "Mind Map" chip ──► generateMindMap(selected_text)   │
        └──────────────────────────────────────────────────────┘
```

### 5.2 Document Upload & Indexing Flow
```
User selects PDF in ChatInput / LeftSidebar Sources
        │
        ▼
ApiClient.uploadDocument(POST /documents/upload, FormData)
        │
        ▼
Backend: save PDF (Supabase/AWS S3/Local)
        │
        ▼
FastEmbed ONNX: chunk text → embed vectors
        │
        ▼
Pinecone: upsert vectors + metadata
        │
        ▼
PostgreSQL/Neon: store document metadata
        │
        ▼
Frontend: refresh documents list; auto-select for RAG
```

### 5.3 LangGraph Research Flow
```
User selects "Research" mode + enters topic
        │
        ▼
ApiClient.runResearch(POST /research/run)
        │
        ▼
LangGraph agent loop:
  ├─ search_uploaded_documents (Pinecone)
  ├─ tavily_search (web)
  ├─ wikipedia
  ├─ get_current_date
  └─ save_report (write .md to disk)
        │
        ▼
Gemini 1.5 synthesizes executive report
        │
        ▼
Backend returns { answer, report_filename, tool_steps[], sources[] }
        │
        ▼
ResearchReportCard: render report + collapsible tool trace
        Download .md / Export PDF (jspdf, client-side)
        Inspect sources in RightValidationPanel
```

### 5.4 Mind Map Flow
```
User clicks "Generate Full Mind Map" (Right Panel) or
"Mind Map" chip on a source chunk
        │
        ▼
ChatContext.generateMindMap(document_ids OR selected_text + topic_title)
        │
        ▼
ApiClient.generateMindMap(POST /mindmap/generate)
        │
        ▼
Backend:
  ├─ Check Redis cache (L1, <2ms)
  ├─ Check Neon/Postgres cache (L2)
  └─ Generate via Gemini → concept tree nodes (levels 0-3)
        │
        ▼
Return { id, title, nodes[], cache_source }
        │
        ▼
MindMapCanvas: tidy-tree layout, pan/zoom, collapse/expand,
level-based color theme, "Ask in Chat" from node,
export PNG / PDF
```

### 5.5 Authentication Flow
```
App loads ──► AuthContext useEffect initAuth()
        │
        ├─ token in localStorage? ──► api.getMe() ──► setUser
        │                                │
        │                                └─ (fail) ──► api.logout()
        │
        ▼ (if no token)
Login/Register modal ──► api.login/register ──► store token + user
        │
        ▼
All subsequent API calls include Authorization: Bearer <token>
```

### 5.6 Health Monitoring Flow
```
ChatContext useEffect ──► api.checkReadiness() (GET /readyz)
        │
        ├─ every 20s (setInterval) ──► update isReady / systemHealth
        │
        ▼
Frontend reflects backend readiness status in UI
```

---

## 6. Infrastructure & Third-Party Services

| Service | Purpose |
|---------|---------|
| **Next.js 14** (App Router) | Frontend framework, SSR/CSR hybrid |
| **React 18** | UI library, Context API for state |
| **Tailwind CSS** | Styling (glassmorphism, dark theme `#060919`) |
| **TypeScript** | Type safety (`src/types/api.ts`) |
| **FastAPI** | Backend API (`127.0.0.1:8000`) |
| **PostgreSQL / Neon DB** | Users, conversations, documents, mind maps, subscriptions |
| **Redis Cloud** | L1 mind map cache (<2ms) |
| **Pinecone** | Vector DB for RAG document embeddings |
| **FastEmbed ONNX** | Local embedding model for document chunking |
| **Gemini 1.5** | LLM for answer synthesis, reports, mind map concepts |
| **Tavily Search API** | Web search tool for research agent |
| **Wikipedia API** | Reference tool for research agent |
| **Supabase / AWS S3 / Local** | PDF file storage |
| **Stripe** | Subscription checkout |
| **jspdf** | Client-side PDF export (reports) |
| **lucide-react** | Iconography |

---

## 7. Security & Auth

- JWT Bearer tokens stored in `localStorage` key `knowvia_token`
- User profile stored under `knowvia_user`
- All mutating endpoints require `Authorization: Bearer <token>`
- `AuthProvider` auto-validates session on load; invalid tokens trigger logout
- Role-based access: `subscription_tier` (`free` \| `pro` \| `max` \| `team` \| `business`), admin endpoint `/users/admin`

---

## 8. Limits by Subscription Tier

Defined in `PlanLimits` / `SubscriptionPlan` types: `max_documents`, `max_file_size_mb`, `max_daily_queries`, `advanced_retrieval`, `priority_support`. Tiers: Free, Pro, Max, Team, Business.

---

## 9. Key Files Summary

```
src/app/layout.tsx        # Providers + root shell
src/app/page.tsx          # 3-column layout + modals
src/lib/api.ts            # API client (all endpoints)
src/types/api.ts          # TypeScript interfaces
src/context/AuthContext.tsx   # JWT session state
src/context/ChatContext.tsx   # Global chat/mindmap/health state
src/components/chat/ChatContainer.tsx  # Message rendering + citations
src/components/chat/ChatInput.tsx      # Input, upload, mode selector
src/components/chat/ResearchReportCard.tsx # Report + tool trace + PDF
src/components/layout/LeftSidebar.tsx    # Conversations, documents, profile
src/components/layout/RightValidationPanel.tsx # Source validation + mind map tabs
src/components/mindmap/MindMapCanvas.tsx   # Interactive SVG mind map
src/components/modals/*.tsx   # Auth, Upgrade, KB, Settings, Customization, DocInfo
```

---

## 10. How to View the Interactive Diagram

Open `WORKFLOW_DIAGRAM.html` in any browser:

- **Scroll** = zoom in/out (centered on mouse)
- **Drag** = pan the canvas
- **Click a node** = open the right detail panel (description, endpoints, stack, data flow, source file)
- **Press `R`** = reset view to center
- **Press `Esc`** = close detail panel

The diagram covers all 20+ components across Client, Frontend, Layout, Context, API, Backend, and Infrastructure layers with every data flow edge.
