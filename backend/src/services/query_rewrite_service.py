import google.generativeai as genai

from src.core.config import settings


genai.configure(
    api_key=settings.GEMINI_API_KEY
)

import re

CANDIDATE_MODELS = [
    "gemini-flash-lite-latest",  # 0.9s verified
    "gemini-3.5-flash",          # Verified robust fallback
    "gemini-flash-latest",
    "gemini-3.1-flash-lite",
]


def _rewrite_query_gemini(prompt: str, fallback_query: str) -> str:
    for model_name in CANDIDATE_MODELS:
        try:
            m = genai.GenerativeModel(model_name)
            res = m.generate_content(prompt)
            if res and res.text:
                return res.text.strip()
        except Exception:
            continue
    return fallback_query


def create_retrieval_query(
    history: str,
    question: str
):
    if not history or not history.strip():
        return question.strip()

    # Fast-path optimization: if the query is already an explicit standalone question
    # without ambiguous pronouns (e.g. "what is the ragular expression", "explain DFA"),
    # skip the redundant 2-second LLM rewrite roundtrip!
    q_clean = question.strip()
    words = set(re.findall(r"\b[a-z]{2,}\b", q_clean.lower()))
    pronouns = {"it", "this", "that", "they", "them", "these", "those", "he", "she", "his", "her"}
    if not (words & pronouns) and len(words) >= 3:
        return q_clean

    prompt = f"""
You are a search query generator for a RAG system.

Your task is to convert the conversation and the user's
latest question into ONE clear standalone search query.

The query will be used to search a document database.

Do not answer the question.
Do not explain anything.
Return only the search query.

Conversation:
{history}

Latest question:
{question}

Standalone search query:
"""

    return _rewrite_query_gemini(prompt, question)
