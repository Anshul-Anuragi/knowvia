import google.generativeai as genai

from src.core.config import settings


genai.configure(
    api_key=settings.GEMINI_API_KEY
)

CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",  # Fastest verified model (0.9s inference)
    "gemini-3.5-flash",          # Verified robust fallback (3.0s inference)
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite",
    "gemini-3-flash-preview",
    "gemini-3.1-pro-preview",
]


def _call_gemini(prompt: str) -> str:
    last_error = None
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(prompt)
            if res and res.text:
                return res.text.strip()
        except Exception as e:
            last_error = e
            continue
    if last_error:
        raise last_error
    return "I could not generate an answer at this time."


def generate_answer(
    question: str,
    context: list,
    history: str,
    mode: str = "rag"
):
    context_text = ""

    for idx, item in enumerate(context, 1):
        chunk_id = item.get("chunk_id") or f"chunk_{idx:03d}"
        doc_id = item.get("document_id") or ""
        filename = item.get("filename") or doc_id
        page = item.get("page_number") or 1
        context_text += (
            f"[CITATION_ID: {chunk_id} | INDEX: {idx} | DOC_ID: {doc_id} | FILE: {filename} | PAGE: {page}]\n"
            f"{item.get('text')}\n\n"
        )

    if mode == "research":
        prompt = f"""
You are a Real-Time Intelligence & Research Specialist.
Your goal is to provide a comprehensive, fact-filled briefing answering the user's question with current industry insights, practical analysis, and up-to-date perspectives.

If any document context is provided below, incorporate relevant points from it and cite using [1], [2] where applicable. If not, synthesize high-quality, actionable knowledge.

Conversation History:
{history}

Retrieved Document Context:
{context_text}

Current User Question:
{question}

Provide a well-structured research briefing:
"""
    elif mode == "deep_research":
        prompt = f"""
You are an Enterprise Deep Research & Intelligence Analyst.
Your goal is to produce an in-depth, exhaustive, multi-section executive report addressing the user's inquiry thoroughly.

Structure the response with:
1. Executive Summary & Overview
2. Core Architecture & Key Components (with clear bullet points / tables)
3. In-Depth Technical / Strategic Analysis
4. Practical Implications & Best Practices
5. Key Takeaways & Recommendations

If retrieved document context is provided below, ground your findings in it and cite exact references with bracketed numbers like [1], [2].

Conversation History:
{history}

Retrieved Document Context:
{context_text}

Current User Question:
{question}

Comprehensive Report:
"""
    else:
        # Default RAG mode
        prompt = f"""
You are an AI assistant for an Enterprise Document Intelligence system.

Answer the user's question using the retrieved document context.

You may use the conversation history to understand references
such as "it", "this", "that", "explain more", etc.

IMPORTANT RULES:

1. Use the retrieved document context as the source of truth.
2. Do not invent information that is not present in the context.
3. If the answer cannot be found in the provided context, clearly say:
   "I could not find this information in the provided documents."
4. READABILITY & CLARITY: Write answers in crystal-clear, structured, human-friendly format. When discussing formulas, sets, or theoretical concepts, use clean plain text, bold headings, bullet points, and standard Unicode symbols (e.g. Σ, ∪, ε, ∩, ∈, R*, R₁ | R₂) rather than raw LaTeX syntax with backslashes (\\cup, \\bigcup, \\text{...}, $...$).
5. Give a clear and helpful answer.
6. If the user asks for an explanation or example, provide it when
   the information is supported by the documents.
7. Do not mention internal technical terms like Pinecone, embeddings, or relevance scores.
8. CITATIONS: Base your answer strictly on the provided context. Immediately after any sentence or claim supported by a source chunk, insert its exact citation tag in brackets like [chunk_001] or [1] (matching the CITATION_ID or INDEX from the context block). Place citations immediately after the clause or sentence.

Conversation History:
{history}

Retrieved Document Context:
{context_text}

Current User Question:
{question}

Answer:
"""

    return _call_gemini(prompt)