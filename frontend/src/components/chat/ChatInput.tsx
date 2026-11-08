"use client";

import React, { useState, useRef, useEffect, ChangeEvent, KeyboardEvent } from "react";
import {
  Send,
  Paperclip,
  Plus,
  FileSearch,
  Globe,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Check,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

export default function ChatInput() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const {
    sendMessage,
    isGenerating,
    searchMode,
    setSearchMode,
    loadConversations,
    loadDocuments,
  } = useChat();

  const [input, setInput] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [uploadToast, setUploadToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);

  // Close plus mode popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSend = () => {
    if (!input.trim() || isGenerating) return;
    sendMessage(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (file.type !== "application/pdf") {
      setUploadToast({
        type: "error",
        message: "Only PDF documents are supported currently.",
      });
      setTimeout(() => setUploadToast(null), 4000);
      return;
    }

    setIsUploading(true);
    setUploadingFileName(file.name);
    setUploadToast(null);

    try {
      await api.uploadDocument(file);
      setUploadToast({
        type: "success",
        message: `Indexed "${file.name}" to vector database successfully!`,
      });
      setTimeout(() => setUploadToast(null), 4000);
      await loadConversations();
      await loadDocuments();
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : "Upload failed";
      setUploadToast({
        type: "error",
        message: `Upload failed: ${errMessage}`,
      });
      setTimeout(() => setUploadToast(null), 4000);
    } finally {
      setIsUploading(false);
      setUploadingFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const modeOptions = [
    {
      id: "rag" as const,
      title: "RAG Search",
      subtitle: "Fast Q&A grounded in your uploaded documents",
      icon: FileSearch,
      iconColor: "text-cyan-400",
      iconBg: "bg-cyan-500/10 border-cyan-500/20",
    },
    {
      id: "research" as const,
      title: "🔬 Research Mode",
      subtitle: "LangGraph Single-Agent Executive Report Generator",
      icon: Globe,
      iconColor: "text-indigo-400",
      iconBg: "bg-indigo-500/10 border-indigo-500/20",
    },
    {
      id: "deep_research" as const,
      title: "Deep Research",
      subtitle: "Exhaustive multi-section intelligence report",
      icon: Sparkles,
      iconColor: "text-amber-400",
      iconBg: "bg-amber-500/10 border-amber-500/20",
    },
  ];

  const getPlaceholder = () => {
    switch (searchMode) {
      case "rag":
        return "Ask anything about your documents...";
      case "research":
        return "Enter research topic (e.g. EU AI Act startup compliance, Quantum drug discovery in 2026)...";
      case "deep_research":
        return "Ask for an exhaustive comprehensive report...";
      default:
        return "Ask anything...";
    }
  };

  const getModeLabel = () => {
    switch (searchMode) {
      case "rag":
        return "RAG Search";
      case "research":
        return "🔬 Research Mode";
      case "deep_research":
        return "Deep Research";
      default:
        return "RAG Search";
    }
  };

  return (
    <div className="p-4 md:px-8 max-w-4xl mx-auto w-full space-y-2.5">
      {/* Live Upload & Indexing Banner */}
      {isUploading && (
        <div className="p-3 rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-200 text-xs flex items-center justify-between backdrop-blur-xl animate-in fade-in duration-200 shadow-lg shadow-cyan-500/10">
          <div className="flex items-center gap-2.5">
            <Loader2 className="w-4 h-4 animate-spin text-cyan-400 shrink-0" />
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-medium text-white">Indexing & vectorizing &ldquo;{uploadingFileName}&rdquo;</span>
              <span className="text-[11px] text-cyan-300/80 font-mono">FastEmbed ONNX • Pinecone Batch Sync</span>
            </div>
          </div>
          <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
            Processing
          </span>
        </div>
      )}

      {/* Upload Toast Notification */}
      {uploadToast && (
        <div
          className={`p-3 rounded-xl border flex items-center justify-between text-xs backdrop-blur-xl animate-in fade-in duration-200 ${
            uploadToast.type === "success"
              ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
              : "bg-red-950/60 border-red-500/40 text-red-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {uploadToast.type === "success" ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400" />
            )}
            <span>{uploadToast.message}</span>
          </div>
          <button
            onClick={() => setUploadToast(null)}
            className="text-xs font-mono opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Glassmorphic Input Dock */}
      <div className="rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 hover:border-indigo-500/30 transition-all shadow-2xl p-2 relative flex flex-col gap-2">
        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="application/pdf"
          className="hidden"
        />

        {/* Text Input Row */}
        <div className="flex items-end gap-2 px-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder-slate-400 resize-none outline-none max-h-40 py-2 px-1 leading-relaxed"
          />

          {/* Send Action Button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || isGenerating}
            className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 shadow-lg ${
              input.trim() && !isGenerating
                ? "bg-gradient-to-tr from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-indigo-600/30 active:scale-95"
                : "bg-white/[0.04] text-slate-500 cursor-not-allowed border border-white/5"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Bottom Toolbar inside the Dock */}
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.05] px-1">
          <div className="flex items-center gap-1.5">
            {/* '+' Mode Selector Popover Button */}
            <div className="relative" ref={plusMenuRef}>
              <button
                onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                title="Select Search & Intelligence Mode"
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center ${
                  isModeMenuOpen
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.06]"
                }`}
              >
                <Plus className={`w-4 h-4 transition-transform duration-200 ${isModeMenuOpen ? "rotate-45" : ""}`} />
              </button>

              {/* Mode Selection Popover Menu */}
              {isModeMenuOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-[#0B1026]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Search & Generation Mode
                  </div>

                  <div className="space-y-1 mt-1">
                    {modeOptions.map((opt) => {
                      const isSelected = searchMode === opt.id;
                      const IconComponent = opt.icon;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => {
                            setSearchMode(opt.id);
                            setIsModeMenuOpen(false);
                          }}
                          className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-left transition-all ${
                            isSelected
                              ? "bg-white/[0.08] text-white border border-indigo-500/30 shadow-sm"
                              : "text-slate-300 hover:bg-white/[0.04] hover:text-white border border-transparent"
                          }`}
                        >
                          <div className={`p-1.5 rounded-lg ${opt.iconBg} border shrink-0 mt-0.5`}>
                            <IconComponent className={`w-4 h-4 ${opt.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold">{opt.title}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                              {opt.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Document Upload Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Upload PDF Document to Knowledge Base"
              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-white/[0.05] transition-colors flex items-center gap-1 text-xs"
            >
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              ) : (
                <Paperclip className="w-4 h-4" />
              )}
            </button>

            {/* Mode Indicator Pill */}
            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-white/[0.04] text-slate-300 border border-white/10 ml-0.5">
              {getModeLabel()}
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            Press <kbd className="bg-white/[0.06] border border-white/10 px-1 py-0.2 rounded text-[10px] text-slate-300">Enter</kbd> to send
          </div>
        </div>
      </div>
    </div>
  );
}
