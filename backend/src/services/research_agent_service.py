import os
import re
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Annotated, TypedDict, List, Dict, Any, Optional

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage, ToolMessage
from langchain_core.tools import tool
from langchain_community.tools import WikipediaQueryRun
from langchain_community.utilities import WikipediaAPIWrapper
from tavily import TavilyClient

from src.core.config import settings
from src.services.retrieval_service import retrieve_chunks

logger = logging.getLogger("knowvia.research_agent")

# Directories
BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPORTS_DIR = BACKEND_ROOT / "reports"
NOTES_DIR = BACKEND_ROOT / "research_notes"

REPORTS_DIR.mkdir(parents=True, exist_ok=True)
NOTES_DIR.mkdir(parents=True, exist_ok=True)


def clean_report_filename(raw_title: str) -> str:
    """
    Cleans title following the strict naming rule:
    Sentence case, 3 to 6 words, under 50 characters, only letters, numbers,
    and single spaces (no hyphens/underscores/punctuation), ending in .md.
    """
    title = raw_title.replace(".md", "").strip()
    # Replace any punctuation/symbols with space
    cleaned = re.sub(r"[^A-Za-z0-9 ]+", " ", title)
    words = [w for w in cleaned.split() if w]

    if len(words) > 6:
        words = words[:6]
    elif len(words) < 3 and words:
        words = words + ["Research", "Report"][:3 - len(words)]
    elif not words:
        words = ["Knowvia", "Research", "Report"]

    first_word = words[0].capitalize()
    rest_words = [w.lower() if not (len(w) > 1 and w.isupper()) else w for w in words[1:]]
    result = " ".join([first_word] + rest_words)
    if len(result) > 46:
        result = result[:46].rsplit(" ", 1)[0]
    return f"{result}.md"


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    topic: str
    tool_round: int


async def run_knowvia_research_agent(
    topic: str,
    user_id: Optional[str] = None,
    selected_document_ids: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Executes the single-agent LangGraph Research Agent.
    Combines:
      - 5 Bound Tools (get_current_date, search_uploaded_documents, tavily_search, wikipedia, save_report)
      - Resilient Gemini Model Pool with automatic fallbacks (.with_fallbacks)
      - Epistemic honesty & executive BLUF report synthesis
    """
    clean_doc_ids = [str(d).strip() for d in (selected_document_ids or []) if d]
    tool_tracker: List[Dict[str, Any]] = []
    collected_sources: List[Dict[str, Any]] = []
    saved_report_info: Dict[str, str] = {
        "filename": "",
        "path": "",
        "content": ""
    }

    # ==============================================================
    # 1. BOUND TOOLS DEFINITION (Request-Scoped)
    # ==============================================================

    @tool
    def get_current_date() -> str:
        """Returns today's date (YYYY-MM-DD) so all timeline reasoning is anchored to 2026."""
        now_str = datetime.now().strftime("%Y-%m-%d")
        tool_tracker.append({"tool": "get_current_date", "status": "completed", "output": now_str})
        return now_str

    @tool
    def search_uploaded_documents(query: str) -> str:
        """
        Searches internal uploaded PDF documents in Knowvia Pinecone vector index
        for relevant passages, facts, metrics, and architecture details.
        """
        step = {"tool": "search_uploaded_documents", "query": query, "status": "running"}
        tool_tracker.append(step)

        if not clean_doc_ids:
            step["status"] = "completed"
            step["output"] = "No uploaded documents selected."
            return "No uploaded documents are currently selected by the user. Rely on web search and Wikipedia."

        try:
            chunks = retrieve_chunks(query=query, top_k=5, document_ids=clean_doc_ids)
            if not chunks:
                step["status"] = "completed"
                step["output"] = "0 chunks found"
                return f"No relevant internal document chunks found for query: '{query}'."

            formatted = []
            for idx, c in enumerate(chunks, 1):
                filename = c.get("filename") or "Document.pdf"
                text = c.get("text", "").strip()
                formatted.append(f"[Internal Doc: {filename}]:\n{text}")

                # Record source
                collected_sources.append({
                    "title": filename,
                    "document_name": filename,
                    "document_id": c.get("document_id"),
                    "text": text[:200],
                    "is_internal": True,
                    "url": None
                })

            step["status"] = "completed"
            step["output"] = f"{len(chunks)} chunks retrieved"
            return "\n\n".join(formatted)
        except Exception as e:
            logger.warning(f"Error in search_uploaded_documents: {e}")
            step["status"] = "error"
            step["error"] = str(e)
            return f"Internal document search encountered an issue: {str(e)}. Use web search and Wikipedia."

    @tool
    def tavily_search(query: str) -> str:
        """
        Searches the live web via Tavily Search engine for real-time news, verified 2026 facts,
        and primary source URLs.
        """
        step = {"tool": "tavily_search", "query": query, "status": "running"}
        tool_tracker.append(step)

        api_key = settings.TAVILY_API_KEY or os.getenv("TAVILY_API_KEY")
        if not api_key:
            step["status"] = "skipped"
            step["output"] = "Tavily API key not configured"
            return "Tavily web search unavailable (no API key configured). Rely on Wikipedia and uploaded documents."

        try:
            client = TavilyClient(api_key=api_key)
            res = client.search(query=query, max_results=5)
            results = res.get("results", [])
            if not results:
                step["status"] = "completed"
                step["output"] = "0 web results"
                return f"No web search results found for query: '{query}'."

            formatted = []
            for r in results:
                title = r.get("title", "Web Source")
                url = r.get("url", "")
                content = r.get("content", "")
                formatted.append(f"Source: {title} ({url})\nSnippet: {content}")

                collected_sources.append({
                    "title": title,
                    "url": url,
                    "text": content[:200],
                    "is_internal": False
                })

            step["status"] = "completed"
            step["output"] = f"{len(results)} web results retrieved"
            return "\n\n".join(formatted)
        except Exception as e:
            logger.warning(f"Tavily search failed for query '{query}': {e}")
            step["status"] = "degraded"
            step["error"] = str(e)
            return f"Tavily search unavailable: {str(e)}. Proceed using Wikipedia and uploaded documents."

    @tool
    def wikipedia(query: str) -> str:
        """
        Searches Wikipedia for foundational definitions, historical background,
        and established technical or industry knowledge.
        """
        step = {"tool": "wikipedia", "query": query, "status": "running"}
        tool_tracker.append(step)

        try:
            wiki_runner = WikipediaQueryRun(api_wrapper=WikipediaAPIWrapper(top_k_results=2))
            res = wiki_runner.run(query)
            step["status"] = "completed"
            step["output"] = "Wikipedia summary retrieved"

            collected_sources.append({
                "title": f"Wikipedia: {query}",
                "url": f"https://en.wikipedia.org/wiki/{query.replace(' ', '_')}",
                "text": (res or "")[:200],
                "is_internal": False
            })
            return res or "No Wikipedia article found."
        except Exception as e:
            logger.warning(f"Wikipedia search failed for query '{query}': {e}")
            step["status"] = "error"
            step["error"] = str(e)
            return f"Wikipedia query error: {str(e)}"

    @tool
    def save_report(title: str, content: str) -> str:
        """
        Saves the finalized Markdown report to backend/reports/{clean_title}.md
        and research notes to backend/research_notes/{clean_title}/notes.md.
        """
        clean_name = clean_report_filename(title)
        report_file = REPORTS_DIR / clean_name
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(content)

        # Save structured research notes
        notes_sub = NOTES_DIR / clean_name.replace(".md", "")
        notes_sub.mkdir(parents=True, exist_ok=True)
        with open(notes_sub / "notes.md", "w", encoding="utf-8") as f:
            f.write(f"# Research Notes: {clean_name}\n\nGenerated: {datetime.now().isoformat()}\nTopic: {topic}\n\n{content}")

        saved_report_info["filename"] = clean_name
        saved_report_info["path"] = f"reports/{clean_name}"
        saved_report_info["content"] = content

        tool_tracker.append({
            "tool": "save_report",
            "filename": clean_name,
            "status": "completed"
        })
        return f"✅ Report saved successfully as: {clean_name}"

    tools = [get_current_date, search_uploaded_documents, tavily_search, wikipedia, save_report]
    tool_node = ToolNode(tools)

    # ==============================================================
    # 2. RESILIENT GEMINI MODEL POOL WITH .with_fallbacks()
    # ==============================================================
    api_key = settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY or os.getenv("GOOGLE_API_KEY")

    raw_candidates = [
        settings.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-flash-latest",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
        "gemini-1.5-flash",
    ]
    seen_models = set()
    model_order = [m for m in raw_candidates if m and not (m in seen_models or seen_models.add(m))]

    llm_instances = []
    for m in model_order:
        try:
            inst = ChatGoogleGenerativeAI(
                model=m,
                max_retries=1,
                google_api_key=api_key,
                temperature=0.3
            ).bind_tools(tools)
            llm_instances.append(inst)
        except Exception as e:
            logger.warning(f"Could not bind model {m}: {e}")

    if not llm_instances:
        # Fallback basic model
        llm_instances = [
            ChatGoogleGenerativeAI(
                model="gemini-2.5-flash",
                max_retries=1,
                google_api_key=api_key
            ).bind_tools(tools)
        ]

    llm = llm_instances[0].with_fallbacks(llm_instances[1:]) if len(llm_instances) > 1 else llm_instances[0]

    # ==============================================================
    # 3. AGENT NODE & CONDITIONAL ROUTING
    # ==============================================================
    system_prompt = f"""You are Knowvia AI's Lead Research & Intelligence Agent, combining rigorous epistemic verification with high-impact executive report synthesis.

Topic to research: {topic}

DISCIPLINE & VERIFICATION RULES (from researcher.md):
1. Call get_current_date FIRST so all timeline reasoning is accurate in 2026.
2. If internal documents are available, call search_uploaded_documents to retrieve private facts and figures first.
3. Use tavily_search and wikipedia to gather external facts, authoritative benchmarks, and current 2026 data.
4. Keep search queries concise (under 6 words). Never repeat identical queries.
5. Strict Epistemic Honesty: Distinguish confirmed facts from speculation. If sources conflict, explicitly state the contradiction. Never invent statistics, citations, or URLs.
6. Maximum 6 tool-call rounds. When you have sufficient evidence, stop searching and write the report.

REPORT SYNTHESIS RULES (from report-writer.md):
Your final output MUST follow this exact structure:

# {{Compelling ~6-word title with active verb in sentence case}}

{{BLUF Paragraph (Bottom Line Up Front)}}
Immediately below the title (no subheader!), write a dense 5 to 8 sentence paragraph leading with the primary finding, quantitative metrics, commercial/technical significance, and core takeaway. A busy executive reading ONLY this paragraph must walk away fully informed.

## {{Narrative signpost header with specific insight or metric}}
(Provide 3 to 4 sections total in sentence case—e.g. "Hybrid indexing cuts retrieval latency by 42 percent", NOT generic labels like "Detailed Analysis".)
- Write in dense, clear active prose with **bold key facts, metrics, and technical components** for rapid executive scanning.
- Avoid hedging words ("may", "might", "possibly"). State verified facts directly.
- Strict Inline Citations: Every major factual claim or metric MUST have an immediate inline citation:
  * For web sources: ([Source Title](URL))
  * For internal documents: ([Doc: filename.pdf, p. X])

## Conclusion
1 to 2 concise paragraphs stating novel forward-looking implications and strategic recommendations only (zero repetition of earlier text).

FINAL STEP:
Before completing, call save_report(title=..., content=...) with a clean 3-6 word title in sentence case and the complete Markdown report content.
"""

    def agent_node(state: AgentState):
        current_round = state.get("tool_round", 0) + 1
        messages = [SystemMessage(content=system_prompt)] + state["messages"]

        if current_round >= 6:
            messages.append(HumanMessage(content="You have reached the maximum search rounds. Synthesize your final executive report now and call save_report."))

        response = llm.invoke(messages)
        return {"messages": [response], "tool_round": current_round}

    def should_continue(state: AgentState):
        if state.get("tool_round", 0) >= 7:
            return END
        last_msg = state["messages"][-1]
        if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
            return "tools"
        return END

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", agent_node)
    workflow.add_node("tools", tool_node)
    workflow.add_edge(START, "agent")
    workflow.add_conditional_edges("agent", should_continue, {"tools": "tools", END: END})
    workflow.add_edge("tools", "agent")

    app = workflow.compile()

    # ==============================================================
    # 4. EXECUTION
    # ==============================================================
    initial_messages = [HumanMessage(content=f"Please research and write a comprehensive executive intelligence report on: {topic}")]
    result = await app.ainvoke({
        "messages": initial_messages,
        "topic": topic,
        "tool_round": 0
    })

    # Extract final text report
    final_answer = ""
    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and msg.content:
            if isinstance(msg.content, str) and msg.content.strip():
                final_answer = msg.content.strip()
                break
            elif isinstance(msg.content, list):
                parts = []
                for p in msg.content:
                    if isinstance(p, dict) and "text" in p:
                        parts.append(p["text"])
                    elif isinstance(p, str):
                        parts.append(p)
                if parts:
                    final_answer = "\n".join(parts).strip()
                    break

    # If save_report was called, we have saved_report_info["content"]
    if saved_report_info.get("content"):
        if not final_answer or len(final_answer) < len(saved_report_info["content"]):
            final_answer = saved_report_info["content"]

    # Fallback auto-save if save_report tool wasn't invoked
    if not saved_report_info.get("filename"):
        clean_name = clean_report_filename(topic)
        report_file = REPORTS_DIR / clean_name
        with open(report_file, "w", encoding="utf-8") as f:
            f.write(final_answer)
        saved_report_info["filename"] = clean_name
        saved_report_info["path"] = f"reports/{clean_name}"
        saved_report_info["content"] = final_answer
        tool_tracker.append({
            "tool": "save_report",
            "filename": clean_name,
            "status": "completed"
        })

    # Deduplicate sources
    unique_sources = []
    seen_urls = set()
    for s in collected_sources:
        identifier = s.get("url") or s.get("title")
        if identifier and identifier not in seen_urls:
            seen_urls.add(identifier)
            unique_sources.append(s)

    return {
        "answer": final_answer,
        "report_filename": saved_report_info["filename"],
        "report_path": saved_report_info["path"],
        "tool_steps": tool_tracker,
        "sources": unique_sources
    }

