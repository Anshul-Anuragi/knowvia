"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileCheck,
  ShieldAlert,
  Sparkles,
  X,
  Network,
  RefreshCw,
  Database,
  FileText,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  BookOpen,
  Search,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { api } from "@/lib/api";
import { DocumentContentResponse } from "@/types/api";
import MindMapCanvas from "@/components/mindmap/MindMapCanvas";

interface ParsedChunk {
  chunk_id: string;
  page_number: number;
  text: string;
}

export default function RightValidationPanel() {
  const {
    activeSources,
    setActiveExtractedSnippet,
    isRightPanelOpen,
    setIsRightPanelOpen,
    rightSidebarWidth,
    setRightSidebarWidth,
    mindMapData,
    isMindMapLoading,
    mindMapError,
    generateMindMap,
    isMindMapFullscreen,
    userDocuments,
    selectedDocumentIds,
    activeViewerDocId,
    setActiveViewerDocId,
    highlightedChunkId,
    setHighlightedChunkId,
    rightPanelTab,
    setRightPanelTab,
    sendMessage,
  } = useChat();

  const [isResizing, setIsResizing] = useState(false);
  const [validationSubView, setValidationSubView] = useState<"document" | "search">("document");

  // Document live content state & cache
  const [contentCache, setContentCache] = useState<Record<string, DocumentContentResponse>>({});
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);
  const [docLoadError, setDocLoadError] = useState<string | null>(null);

  // AI Source Guide collapse
  const [isGuideExpanded, setIsGuideExpanded] = useState(true);

  // Copy states
  const [isMdCopied, setIsMdCopied] = useState(false);
  const [isQuoteCopied, setIsQuoteCopied] = useState(false);

  // Text selection state for floating action pill
  const [selectedText, setSelectedText] = useState("");
  const [selectionPos, setSelectionPos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const markdownBoxRef = useRef<HTMLDivElement>(null);

  // Resize handler
  const startResizingRight = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(280, Math.min(750, startWidth + delta));
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Determine active document item
  const effectiveDocId = useMemo(() => {
    if (activeViewerDocId) return activeViewerDocId;
    if (selectedDocumentIds.length > 0) return selectedDocumentIds[0];
    if (userDocuments.length > 0) return userDocuments[0].id;
    return null;
  }, [activeViewerDocId, selectedDocumentIds, userDocuments]);

  const activeDocItem = useMemo(() => {
    if (!effectiveDocId) return null;
    return userDocuments.find((d) => d.id === effectiveDocId) || null;
  }, [effectiveDocId, userDocuments]);

  // Selected documents list for switcher tabs
  const switcherDocuments = useMemo(() => {
    if (selectedDocumentIds.length > 0) {
      return userDocuments.filter((d) => selectedDocumentIds.includes(d.id));
    }
    return userDocuments;
  }, [selectedDocumentIds, userDocuments]);

  // Fetch document content when effectiveDocId changes
  useEffect(() => {
    if (!effectiveDocId) return;

    if (contentCache[effectiveDocId]) {
      setDocLoadError(null);
      return;
    }

    let isMounted = true;
    setIsLoadingDoc(true);
    setDocLoadError(null);

    api
      .getDocumentContent(effectiveDocId)
      .then((data) => {
        if (!isMounted) return;
        setContentCache((prev) => ({ ...prev, [effectiveDocId]: data }));
      })
      .catch((err) => {
        if (!isMounted) return;
        setDocLoadError(err?.message || "Failed to load document content");
      })
      .finally(() => {
        if (isMounted) setIsLoadingDoc(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveDocId, contentCache]);

  const currentDocContent = effectiveDocId ? contentCache[effectiveDocId] : null;

  // Parse chunks from full_markdown
  const parsedChunks: ParsedChunk[] = useMemo(() => {
    if (!currentDocContent?.full_markdown) return [];

    const regex = /<div\s+id="([^"]+)"\s+data-page="([^"]+)"[^>]*>([\s\S]*?)<\/div>/gi;
    const list: ParsedChunk[] = [];
    let match;

    while ((match = regex.exec(currentDocContent.full_markdown)) !== null) {
      list.push({
        chunk_id: match[1],
        page_number: parseInt(match[2], 10) || 1,
        text: match[3].trim(),
      });
    }

    if (list.length === 0 && currentDocContent.full_markdown.trim()) {
      list.push({
        chunk_id: "chunk_001",
        page_number: 1,
        text: currentDocContent.full_markdown.trim(),
      });
    }

    return list;
  }, [currentDocContent?.full_markdown]);

  // Auto-scroll to highlighted chunk whenever highlightedChunkId updates
  useEffect(() => {
    if (!highlightedChunkId) return;

    // Switch to live document view if highlighted
    setValidationSubView("document");

    const timer = setTimeout(() => {
      const el = document.getElementById(highlightedChunkId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [highlightedChunkId, effectiveDocId]);

  // Handle Text Selection inside the Live Document Box
  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();

    if (text && text.length >= 3 && markdownBoxRef.current) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      const containerRect = markdownBoxRef.current.getBoundingClientRect();

      if (rect && containerRect) {
        const x = Math.max(
          10,
          Math.min(
            containerRect.width - 250,
            rect.left - containerRect.left + rect.width / 2 - 120
          )
        );
        const y = Math.max(8, rect.top - containerRect.top - 46);
        setSelectedText(text);
        setSelectionPos({ x, y });
        return;
      }
    }

    // Delay clearing so clicks on tooltip buttons register
    setTimeout(() => {
      if (!window.getSelection()?.toString().trim()) {
        setSelectedText("");
        setSelectionPos(null);
      }
    }, 150);
  };

  const handleCopyMarkdown = () => {
    if (!currentDocContent?.full_markdown) return;
    navigator.clipboard.writeText(currentDocContent.full_markdown);
    setIsMdCopied(true);
    setTimeout(() => setIsMdCopied(false), 2000);
  };

  const handleCopySelection = () => {
    if (!selectedText) return;
    const citation = `"${selectedText}" — (${activeDocItem?.filename || "Document"})`;
    navigator.clipboard.writeText(citation);
    setIsQuoteCopied(true);
    setTimeout(() => setIsQuoteCopied(false), 2000);
    setSelectedText("");
    setSelectionPos(null);
  };

  const handleAskAboutSelection = () => {
    if (!selectedText) return;
    const question = `Regarding this passage from ${activeDocItem?.filename || "the document"}: "${selectedText}" — Explain this in detail and provide key technical insights.`;
    sendMessage(question);
    setSelectedText("");
    setSelectionPos(null);
  };

  if (!isRightPanelOpen) {
    return null;
  }

  // Fallback sentence rendering for raw extracted chunks
  const renderHighlightedPassage = (passage: string, validatedPhrases: string[], citationIndex: number) => {
    if (!passage) {
      return <p className="text-xs text-slate-400 italic">No raw context retrieved for this chunk.</p>;
    }

    let formattedContent: React.ReactNode = passage;
    if (validatedPhrases && validatedPhrases.length > 0) {
      try {
        const escaped = validatedPhrases
          .map((p) => p.trim())
          .filter((p) => p.length > 4)
          .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

        if (escaped.length > 0) {
          const regex = new RegExp(`(${escaped.join("|")})`, "gi");
          const parts = passage.split(regex);
          formattedContent = parts.map((part, i) => {
            const isMatch = validatedPhrases.some((vp) => vp.toLowerCase() === part.toLowerCase());
            if (isMatch) {
              return (
                <span key={i} className="bg-slate-800/95 text-slate-100 px-1.5 py-0.5 rounded border border-slate-700/60 shadow-sm leading-relaxed inline mx-0.5">
                  {part}
                </span>
              );
            }
            return <span key={i}>{part}</span>;
          });
        }
      } catch {
        formattedContent = passage;
      }
    }

    return (
      <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
        {formattedContent}
        <span className="inline-flex items-center gap-1 ml-1.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 text-[10px] font-mono font-bold align-baseline">
          [{citationIndex}]
        </span>
      </div>
    );
  };

  return (
    <aside
      id="right-validation-panel"
      ref={containerRef}
      style={{ width: `${rightSidebarWidth}px` }}
      className="h-screen flex flex-col border-l border-white/10 bg-[#060919]/95 backdrop-blur-2xl select-none z-20 shrink-0 overflow-hidden relative transition-[width] duration-75"
    >
      {/* Resize Handle on Left Edge */}
      <div
        onMouseDown={startResizingRight}
        className={`absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-cyan-500/50 transition-colors z-40 ${
          isResizing ? "bg-cyan-500 w-1 shadow-lg shadow-cyan-500/50" : ""
        }`}
        title="Drag to resize panel"
      />

      {/* Top Header & Main Switcher */}
      <div className="p-3 border-b border-white/[0.08] space-y-2.5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-tight">Source Intelligence</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-300 border border-white/10">
              {switcherDocuments.length} docs · {activeSources.length} citations
            </span>
          </div>

          <button
            onClick={() => setIsRightPanelOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Source Validation vs Mind Map */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
          <button
            onClick={() => setRightPanelTab("validation")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              rightPanelTab === "validation"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Source Validation</span>
          </button>

          <button
            onClick={() => setRightPanelTab("mindmap")}
            className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
              rightPanelTab === "mindmap"
                ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Mind Map</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {rightPanelTab === "validation" ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Sub-navigation & Document Switcher Header */}
          <div className="p-2.5 border-b border-white/[0.06] bg-white/[0.02] space-y-2 shrink-0">
            {/* View Sub-Toggle: Live Document vs Search Citations */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-white/[0.03] p-0.5 rounded-lg border border-white/10 text-[11px]">
                <button
                  onClick={() => setValidationSubView("document")}
                  className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 transition-all ${
                    validationSubView === "document"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Live Document</span>
                </button>
                <button
                  onClick={() => setValidationSubView("search")}
                  className={`px-2 py-0.5 rounded-md font-medium flex items-center gap-1 transition-all ${
                    validationSubView === "search"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Search className="w-3 h-3" />
                  <span>Search Hits ({activeSources.length})</span>
                </button>
              </div>

              {/* Copy Full MD Action */}
              {validationSubView === "document" && currentDocContent?.full_markdown && (
                <button
                  onClick={handleCopyMarkdown}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 flex items-center gap-1 transition-all"
                  title="Copy complete document markdown"
                >
                  {isMdCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
                      <span>Copy MD</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Multi-Document Switcher Tabs */}
            {switcherDocuments.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {switcherDocuments.map((doc) => {
                  const isCurrent = effectiveDocId === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => setActiveViewerDocId(doc.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border ${
                        isCurrent
                          ? "bg-indigo-600/30 text-indigo-200 border-indigo-400/60 shadow-sm"
                          : "bg-white/[0.03] text-slate-400 hover:text-white border-white/10 hover:bg-white/[0.06]"
                      }`}
                      title={doc.filename}
                    >
                      <FileText className="w-3 h-3 shrink-0 text-indigo-400" />
                      <span className="truncate max-w-[130px]">{doc.filename}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sub-View Content */}
          {validationSubView === "document" ? (
            /* Live Document Markdown Viewer + Source Guide */
            <div className="flex-1 overflow-y-auto p-3 space-y-3 relative" ref={markdownBoxRef}>
              {/* Floating Selection Tooltip Pill */}
              {selectionPos && selectedText && (
                <div
                  style={{
                    transform: `translate(${selectionPos.x}px, ${selectionPos.y}px)`,
                  }}
                  className="absolute z-50 animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1 p-1 bg-[#181C2E] border border-indigo-500/50 shadow-2xl rounded-xl shadow-indigo-950/80"
                >
                  <button
                    onClick={handleAskAboutSelection}
                    className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-[11px] flex items-center gap-1 shadow-md shadow-indigo-600/40 transition-all active:scale-95"
                  >
                    <Sparkles className="w-3 h-3 text-indigo-200" />
                    <span>✦ Ask Knowvia about selection</span>
                  </button>

                  <button
                    onClick={handleCopySelection}
                    className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-[11px] flex items-center gap-1 transition-all"
                    title="Copy selected passage with citation"
                  >
                    {isQuoteCopied ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3 text-slate-400" />
                    )}
                    <span>{isQuoteCopied ? "Copied" : "Quote"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedText("");
                      setSelectionPos(null);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {isLoadingDoc ? (
                <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-8 text-center space-y-3">
                  <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin mx-auto" />
                  <p className="text-xs font-semibold text-white">Loading Live Document Markdown...</p>
                  <p className="text-[11px] text-slate-400">Checking two-tier Redis & Neon DB cache</p>
                </div>
              ) : docLoadError ? (
                <div className="rounded-xl bg-red-950/40 border border-red-500/30 p-4 text-xs text-red-200">
                  <p className="font-semibold">Error Loading Document</p>
                  <p className="text-[11px] text-red-300 mt-1">{docLoadError}</p>
                </div>
              ) : !currentDocContent ? (
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center space-y-2 mt-4">
                  <BookOpen className="w-7 h-7 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-white">No Document Selected</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Select a PDF from the left sidebar to view its live Markdown, AI Source Guide, and chunk anchors.
                  </p>
                </div>
              ) : (
                <>
                  {/* Collapsible AI Source Guide Card */}
                  {currentDocContent.source_guide && (
                    <div className="bg-[#141827] border border-indigo-500/30 rounded-xl p-3.5 space-y-2.5 shadow-lg shadow-indigo-950/20">
                      <div
                        onClick={() => setIsGuideExpanded(!isGuideExpanded)}
                        className="flex items-center justify-between cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg bg-indigo-500/20 text-indigo-300">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          </div>
                          <span className="text-xs font-bold text-white tracking-tight">✦ AI Source Guide</span>
                        </div>

                        <button className="text-slate-400 hover:text-white p-0.5">
                          {isGuideExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {isGuideExpanded && (
                        <div className="space-y-3 pt-1 border-t border-white/5 animate-in fade-in duration-150">
                          {/* Executive Summary */}
                          <div className="space-y-1">
                            <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-300">Executive Summary</span>
                            <p className="text-xs text-slate-300 leading-relaxed font-sans">
                              {currentDocContent.source_guide.summary}
                            </p>
                          </div>

                          {/* Key Topics Pills */}
                          {currentDocContent.source_guide.key_topics?.length > 0 && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Key Topics</span>
                              <div className="flex flex-wrap gap-1.5 pt-0.5">
                                {currentDocContent.source_guide.key_topics.map((topic, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/10 text-[11px] font-mono text-slate-300"
                                  >
                                    # {topic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Suggested Questions */}
                          {currentDocContent.source_guide.suggested_questions?.length > 0 && (
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-300">Suggested Questions</span>
                              <div className="space-y-1">
                                {currentDocContent.source_guide.suggested_questions.map((question, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => sendMessage(question)}
                                    className="w-full text-left p-2 rounded-lg bg-indigo-950/40 hover:bg-indigo-900/50 border border-indigo-500/20 text-xs text-indigo-200 transition-all flex items-center justify-between group"
                                  >
                                    <span className="line-clamp-2">{question}</span>
                                    <ArrowRight className="w-3 h-3 text-indigo-400 shrink-0 group-hover:translate-x-0.5 transition-transform ml-1" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Live Scrollable Document Markdown Box */}
                  <div
                    id="source-markdown-container"
                    onMouseUp={handleTextSelection}
                    className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2 select-text"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300 truncate max-w-[200px]">
                        {currentDocContent.filename}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {parsedChunks.length} anchored chunks
                      </span>
                    </div>

                    <div className="space-y-2">
                      {parsedChunks.map((chunk) => {
                        const isHighlighted = highlightedChunkId === chunk.chunk_id;

                        return (
                          <div
                            key={chunk.chunk_id}
                            id={chunk.chunk_id}
                            data-page={chunk.page_number}
                            className={`transition-all duration-300 group ${
                              isHighlighted
                                ? "bg-indigo-950/80 border-l-4 border-indigo-400 ring-1 ring-indigo-500/40 px-3 py-2.5 rounded-r-lg shadow-lg shadow-indigo-950/60 my-2.5"
                                : "py-2 px-1 border-b border-white/[0.04] hover:bg-white/[0.02] rounded-lg"
                            }`}
                          >
                            {/* Metadata Header Pill */}
                            <div className="flex items-center justify-between pb-1 text-[10px] font-mono text-slate-500">
                              <span className={isHighlighted ? "text-indigo-300 font-semibold" : "text-slate-400"}>
                                Page {chunk.page_number}
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] ${
                                  isHighlighted
                                    ? "bg-indigo-500/30 text-indigo-200 border border-indigo-400/50"
                                    : "bg-white/[0.04] text-slate-500 border border-white/5"
                                }`}
                              >
                                #{chunk.chunk_id}
                              </span>
                            </div>

                            {/* Markdown Chunk Body */}
                            <div className="text-xs text-slate-300 leading-relaxed font-sans whitespace-pre-wrap">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {chunk.text}
                              </ReactMarkdown>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* Search Grounding View (All Extracted Text Chunks from Chat) */
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeSources.length === 0 ? (
                <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-6 text-center space-y-2 mt-4">
                  <ShieldAlert className="w-7 h-7 text-slate-500 mx-auto" />
                  <p className="text-xs font-semibold text-white">No Search Sources Retrieved</p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Ask a question in chat to view verified search chunks and citation attributions.
                  </p>
                </div>
              ) : (
                <>
                  {/* Quick Jump Ribbon */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {activeSources.map((s, idx) => {
                      const pointNum = s.citation_index || idx + 1;
                      const isHighlighted = highlightedChunkId === (s.chunk_id || `chunk_${String(pointNum).padStart(3, "0")}`);
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setActiveExtractedSnippet(s);
                            if (s.chunk_id) {
                              setHighlightedChunkId(s.chunk_id);
                            }
                            if (s.document_id) {
                              setActiveViewerDocId(s.document_id);
                            }
                            const el = document.getElementById(`source-chunk-${pointNum}`);
                            if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-mono font-semibold transition-all flex items-center gap-1 shrink-0 ${
                            isHighlighted
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-sm"
                              : "bg-white/[0.04] text-slate-400 hover:text-white border border-white/10"
                          }`}
                        >
                          <span>Point [{pointNum}]</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* List of Retrieved Chunks */}
                  <div className="space-y-3">
                    {activeSources.map((s, idx) => {
                      const pointNum = s.citation_index || idx + 1;
                      const isHighlighted = highlightedChunkId === (s.chunk_id || `chunk_${String(pointNum).padStart(3, "0")}`);

                      return (
                        <div
                          key={idx}
                          id={`source-chunk-${pointNum}`}
                          onClick={() => {
                            setActiveExtractedSnippet(s);
                            if (s.chunk_id) {
                              setHighlightedChunkId(s.chunk_id);
                            }
                            if (s.document_id) {
                              setActiveViewerDocId(s.document_id);
                            }
                          }}
                          className={`rounded-2xl p-3.5 space-y-3 transition-all cursor-pointer border ${
                            isHighlighted
                              ? "bg-white/[0.07] border-cyan-500/60 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500/30"
                              : "bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 text-[10px] font-mono font-bold">
                                {pointNum}
                              </span>
                              <span className="text-xs font-semibold text-white truncate max-w-[170px]" title={s.document_name}>
                                {s.document_name}
                              </span>
                            </div>

                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                              {Math.round((s.confidence_score || 0.95) * 100)}% match
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                            <div className="flex items-center gap-2">
                              <span>Page {s.page_number}</span>
                              {s.chunk_id && (
                                <>
                                  <span>•</span>
                                  <span className="text-indigo-300">#{s.chunk_id}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{s.file_size || "1.8 MB"}</span>
                            </div>

                            {s.extracted_text && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRightPanelTab("mindmap");
                                  generateMindMap(true, {
                                    selectedText: s.extracted_text,
                                    topicTitle: `${s.document_name?.replace(".pdf", "")} (P.${s.page_number})`,
                                  });
                                }}
                                className="px-2 py-0.5 rounded bg-indigo-500/10 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/20 text-[10px] font-sans font-medium flex items-center gap-1 transition-all"
                                title="Generate concept mind map of this chunk"
                              >
                                <Sparkles className="w-2.5 h-2.5 text-indigo-400" />
                                <span>✦ Mind Map</span>
                              </button>
                            )}
                          </div>

                          <div className="p-3 rounded-xl bg-black/50 border border-white/5 max-h-64 overflow-y-auto">
                            {renderHighlightedPassage(s.extracted_text, s.validated_sentences, pointNum)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* View 2: NotebookLM-Style Interactive Mind Map Engine (Untouched) */
        <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
          {mindMapData ? (
            <div className="flex-1 w-full h-full min-h-0 relative">
              <MindMapCanvas isFullscreen={false} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 flex flex-col justify-center">
              <div className="rounded-3xl bg-white/[0.03] border border-white/10 p-5 space-y-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 mx-auto flex items-center justify-center shadow-xl shadow-indigo-600/30 ring-1 ring-white/20">
                  <Network className="w-6 h-6 text-white" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-white tracking-tight">Interactive Concept Mind Map</h3>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Synthesize multi-source documents into a 4-level knowledge tree powered by Redis Cloud &amp; Gemini.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">Target Documents</span>
                    <span className="font-mono text-cyan-300 font-semibold">
                      {selectedDocumentIds.length > 0 ? `${selectedDocumentIds.length} Selected` : `${userDocuments.length} Available`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                    <Database className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Two-tier Redis Cloud (&lt;2ms) &amp; Neon DB Cache</span>
                  </div>
                </div>

                {mindMapError && (
                  <div className="p-3 rounded-xl bg-red-950/70 border border-red-500/40 text-red-200 text-xs text-left flex items-start gap-2 leading-relaxed">
                    <span className="text-red-400 font-bold shrink-0">⚠️</span>
                    <span className="flex-1 break-words">{mindMapError}</span>
                  </div>
                )}

                <button
                  onClick={() => generateMindMap(false)}
                  disabled={isMindMapLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 border border-indigo-400/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isMindMapLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Concept Tree...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>✦ Generate Full Mind Map</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Studio Modal Mode (Untouched) */}
      {isMindMapFullscreen && mindMapData && (
        <div className="fixed inset-0 z-50 bg-[#0B0D11] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          <MindMapCanvas isFullscreen={true} />
        </div>
      )}
    </aside>
  );
}
