"use client";

import React, { useRef, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  BrainCircuit,
  FileText,
  ArrowRight,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import ResearchReportCard from "@/components/chat/ResearchReportCard";

export default function ChatContainer() {
  const { user } = useAuth();
  const {
    messages,
    isGenerating,
    streamingAnswer,
    searchMode,
    activeSources,
    focusSource,
    focusCitation,
    sendMessage,
    setIsRightPanelOpen,
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [likedMap, setLikedMap] = useState<Record<number, "up" | "down" | undefined>>({});

  // Clean LaTeX math into readable typography and converts bracketed citations into interactive badges
  const formatCitationMarkdown = (text: string) => {
    if (!text) return "";

    // 1. Transform raw dense LaTeX symbols into clean, readable Unicode characters
    let formatted = text
      .replace(/\\Sigma/g, "Σ")
      .replace(/\\cup/g, "∪")
      .replace(/\\cap/g, "∩")
      .replace(/\\epsilon/g, "ε")
      .replace(/\\in/g, "∈")
      .replace(/\\mid/g, "|")
      .replace(/\\cdot/g, "·")
      .replace(/\\times/g, "×")
      .replace(/\\rightarrow/g, "→")
      .replace(/\\leftarrow/g, "←")
      .replace(/\\le(q)?/g, "≤")
      .replace(/\\ge(q)?/g, "≥")
      .replace(/\\ne(q)?/g, "≠")
      .replace(/\\infty/g, "∞")
      .replace(/\\dots/g, "…")
      .replace(/\\bigcup_\{i=0\}\^\{\\infty\}/g, "⋃(i=0…∞)")
      .replace(/\\text\{\s*and\s*\}/g, "and")
      .replace(/\\text\{\s*([^\}]+)\s*\}/g, "$1")
      .replace(/\\\{/g, "{")
      .replace(/\\\}/g, "}")
      .replace(/R_1/g, "R₁")
      .replace(/R_2/g, "R₂")
      .replace(/R\^0/g, "R⁰")
      .replace(/R\^i/g, "Rⁱ")
      .replace(/R\^\*/g, "R*")
      .replace(/R\^\+/g, "R⁺")
      .replace(/\\/g, "");

    // 2. Remove distracting raw math dollar signs: $R_1 + R_2$ -> R₁ + R₂
    formatted = formatted.replace(/\$([^\$]+)\$/g, "$1");

    // 3. Handle bracketed comma-separated chunk lists: [chunk_221, chunk_255] (with negative lookahead to prevent double-wrapping)
    formatted = formatted.replace(/\[((?:chunk_\d+)(?:\s*,\s*chunk_\d+)+)\](?!\()/g, (_, group) => {
      const parts = group.split(/\s*,\s*/);
      return parts.map((chunkId: string) => `[${chunkId}](#cite-chunk-${chunkId})`).join(" ");
    });

    // 4. Handle bracketed comma-separated numeric citations: [1, 2, 3] or [1,2]
    formatted = formatted.replace(/\[((?:\d+)(?:\s*,\s*\d+)+)\](?!\()/g, (_, group) => {
      const parts = group.split(/\s*,\s*/);
      return parts.map((num: string) => `[${num}](#cite-num-${num})`).join(" ");
    });

    // 5. Handle single chunk citations: [chunk_001] (not already a link)
    formatted = formatted.replace(/\[(chunk_\d+)\](?!\()/g, "[$1](#cite-chunk-$1)");

    // 6. Handle single numeric citations: [1] (not already a link)
    formatted = formatted.replace(/\[(\d+)\](?!\()/g, "[$1](#cite-num-$1)");

    return formatted;
  };

  const citationMarkdownComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("#cite-chunk-")) {
        const chunkId = href.replace("#cite-chunk-", "");
        const source = activeSources.find((s) => s.chunk_id === chunkId);
        const badgeIndex = source?.citation_index || 1;
        const tooltip = source
          ? `${source.document_name} · Page ${source.page_number} · "${source.extracted_text.slice(0, 75).trim()}..."`
          : `Source #${chunkId}`;

        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (source) {
                focusCitation(source.document_id, source.chunk_id || chunkId);
              } else {
                focusCitation(1, chunkId);
              }
            }}
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-400/30 hover:border-indigo-400 text-[11px] font-sans font-semibold align-middle mx-0.5 transition-all shadow-sm active:scale-90 cursor-pointer"
            title={tooltip}
          >
            {badgeIndex}
          </button>
        );
      }

      if (href?.startsWith("#cite-num-")) {
        const citeNum = parseInt(href.replace("#cite-num-", ""), 10);
        const source =
          activeSources.find((s) => s.citation_index === citeNum) ||
          activeSources[citeNum - 1];
        const tooltip = source
          ? `${source.document_name} · Page ${source.page_number} · "${source.extracted_text.slice(0, 75).trim()}..."`
          : `View Citation Point [${citeNum}] in Source Intelligence`;

        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (source) {
                focusCitation(source.document_id, source.chunk_id || `chunk_${String(citeNum).padStart(3, "0")}`);
              } else {
                focusCitation(citeNum);
              }
            }}
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-400/30 hover:border-indigo-400 text-[11px] font-sans font-semibold align-middle mx-0.5 transition-all shadow-sm active:scale-90 cursor-pointer"
            title={tooltip}
          >
            {citeNum}
          </button>
        );
      }

      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline">
          {children}
        </a>
      );
    },
  };

  // Auto scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingAnswer]);

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleFeedback = (index: number, type: "up" | "down") => {
    setLikedMap((prev) => ({
      ...prev,
      [index]: prev[index] === type ? undefined : type,
    }));
  };

  const starterPrompts = [
    {
      title: "Summarize key architectural specifications",
      subtitle: "Extract core technical design and system pipelines",
      tag: "Summary",
      prompt: "Can you provide a structured summary of the key architectural specifications described in the documents?",
    },
    {
      title: "Find security compliance protocols",
      subtitle: "Inspect authentication, role access, and encryption",
      tag: "Security",
      prompt: "What are the security, authentication, and role-based access control measures documented in the knowledge base?",
    },
    {
      title: "Compare pricing and feature tiers",
      subtitle: "Analyze limits, document quotas, and capabilities",
      tag: "Comparison",
      prompt: "Compare the different subscription tiers (Free, Pro, Max, Team, Business) along with their usage limits and capabilities.",
    },
    {
      title: "Generate enterprise intelligence report",
      subtitle: "Synthesize complete cross-document findings",
      tag: "Report",
      prompt: "Generate an executive enterprise intelligence report highlighting key takeaways and action items from the uploaded documents.",
    },
  ];

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
      {/* Empty State / Welcome Hero */}
      {messages.length === 0 && !isGenerating && (
        <div className="max-w-3xl mx-auto py-10 space-y-8 animate-in fade-in zoom-in-95 duration-200">
          <div className="text-center space-y-3">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 shadow-xl shadow-indigo-500/20 ring-1 ring-white/20 mb-2">
              <BrainCircuit className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Enterprise Knowledge Intelligence
            </h1>
            <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
              Synthesize insights across all your company documents with verified citations,
              dense vector search, and zero hallucination.
            </p>
          </div>

          {/* Quick Starter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
            {starterPrompts.map((item, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(item.prompt)}
                className="p-3.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-indigo-500/30 text-left transition-all group flex flex-col justify-between"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20">
                    {item.tag}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 transition-colors group-hover:translate-x-0.5 duration-200" />
                </div>
                <h3 className="text-xs font-semibold text-white group-hover:text-indigo-200 transition-colors">
                  {item.title}
                </h3>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">
                  {item.subtitle}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Render Conversation Messages (ChatGPT / Claude / Gemini Open Style) */}
      {messages.map((msg, idx) => {
        const isUser = msg.role === "user";

        if (isUser) {
          return (
            <div key={idx} className="flex justify-end max-w-3xl mx-auto w-full">
              <div className="flex items-start gap-2.5 max-w-2xl">
                <div className="rounded-2xl px-4 py-2.5 bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white text-sm shadow-md border border-indigo-400/20">
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
                <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 shrink-0 mt-0.5">
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
              </div>
            </div>
          );
        }

        // Assistant Message (Research Report Card vs Standard LLM generation)
        if (msg.is_research_report || msg.report_filename) {
          return (
            <div key={idx} className="max-w-3xl mx-auto w-full py-1">
              <ResearchReportCard message={msg} />
            </div>
          );
        }

        if (!msg.content || !msg.content.trim()) {
          return null;
        }

        return (
          <div key={idx} className="flex items-start gap-3.5 max-w-3xl mx-auto w-full group py-1">
            {/* AI Avatar */}
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shrink-0 mt-1">
              <Sparkles className="w-4 h-4 text-white" />
            </div>

            {/* Generated Message Content */}
            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Pure Synthesized Markdown Answer in Serif */}
              <div className="markdown-body font-serif text-[15px] text-slate-200 leading-relaxed tracking-normal">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={citationMarkdownComponents}
                >
                  {formatCitationMarkdown(msg.content)}
                </ReactMarkdown>
              </div>

              {/* Minimal Action Footer (Copy, Feedback, Sources) */}
              <div className="flex items-center justify-between pt-1 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="p-1.5 rounded-lg hover:bg-white/[0.06] hover:text-white transition-colors"
                    title="Copy Answer"
                  >
                    {copiedIndex === idx ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  <button
                    onClick={() => handleFeedback(idx, "up")}
                    className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ${
                      likedMap[idx] === "up" ? "text-emerald-400" : "hover:text-white"
                    }`}
                    title="Helpful"
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleFeedback(idx, "down")}
                    className={`p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors ${
                      likedMap[idx] === "down" ? "text-red-400" : "hover:text-white"
                    }`}
                    title="Not Helpful"
                  >
                    <ThumbsDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Sources Indicator Pill */}
                {msg.sources && msg.sources.length > 0 && (
                  <button
                    onClick={() => {
                      setIsRightPanelOpen(true);
                      focusSource(msg.sources![0]);
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-xs text-slate-400 hover:text-slate-200 transition-all font-mono"
                  >
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{msg.sources.length} sources</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Active Streaming AI Response (ChatGPT / Gemini / Claude Style) */}
      {isGenerating && (
        <div className="flex items-start gap-3.5 max-w-3xl mx-auto w-full py-1 animate-in fade-in duration-150">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-md shrink-0 mt-1 animate-pulse">
            <Sparkles className="w-4 h-4 text-white" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="markdown-body font-serif text-[15px] text-slate-200 leading-relaxed tracking-normal min-h-[3rem]">
              {streamingAnswer ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={citationMarkdownComponents}
                  >
                    {formatCitationMarkdown(streamingAnswer)}
                  </ReactMarkdown>
                  <span className="inline-block w-2 h-4 bg-cyan-400 ml-1 translate-y-0.5 animate-blink" />
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs italic py-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                  </span>
                  {searchMode === "research" ? (
                    <span className="text-indigo-300 font-medium">
                      🔬 Research Agent running: Checking uploaded sources + Tavily Web + Wikipedia...
                    </span>
                  ) : (
                    <span className="text-slate-400">Synthesizing answer...</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
