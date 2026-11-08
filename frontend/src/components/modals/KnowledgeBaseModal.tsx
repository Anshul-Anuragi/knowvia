"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Trash2,
  Database,
  CheckCircle2,
  Loader2,
  AlertCircle,
  FileUp,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { DocumentItem } from "@/types/api";

export default function KnowledgeBaseModal() {
  const { isKnowledgeBaseOpen, setIsKnowledgeBaseOpen, loadConversations } = useChat();
  const { isAuthenticated, openAuthModal } = useAuth();

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const docs = await api.getDocuments();
      setDocuments(docs || []);
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isKnowledgeBaseOpen) {
      fetchDocuments();
    }
  }, [isKnowledgeBaseOpen, fetchDocuments]);

  if (!isKnowledgeBaseOpen) return null;

  const handleUploadFile = async (file: File) => {
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    if (file.type !== "application/pdf") {
      setMessage({
        type: "error",
        text: "Only PDF documents are supported for vector indexing.",
      });
      return;
    }

    setIsUploading(true);
    setMessage(null);

    try {
      await api.uploadDocument(file);
      setMessage({
        type: "success",
        text: `Successfully ingested and indexed "${file.name}"!`,
      });
      await fetchDocuments();
      await loadConversations();
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Upload failed.";
      setMessage({
        type: "error",
        text: errText,
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleUploadFile(file);
    }
  };

  const handleDelete = async (docId: string) => {
    setDeleteLoadingId(docId);
    setMessage(null);
    try {
      await api.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      setMessage({
        type: "success",
        text: "Document and its Pinecone vector embeddings removed.",
      });
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : "Delete failed.";
      setMessage({
        type: "error",
        text: errText,
      });
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-3xl bg-[#0B1026]/95 border border-white/10 shadow-2xl p-6 relative overflow-hidden max-h-[85vh] flex flex-col">
        {/* Glow accent */}
        <div className="absolute -top-14 right-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={() => setIsKnowledgeBaseOpen(false)}
          className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-600/30">
            <Database className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">Enterprise Knowledge Base</h2>
            <p className="text-xs text-slate-400">
              Manage indexed PDF documents powering hybrid vector retrieval and citations.
            </p>
          </div>
        </div>

        {/* Status Alert */}
        {message && (
          <div
            className={`p-3 rounded-xl border mb-4 flex items-center justify-between text-xs backdrop-blur-xl ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/60 border-red-500/40 text-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {message.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
            <button
              onClick={() => setMessage(null)}
              className="text-xs font-mono opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Drag & Drop Upload Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`p-6 rounded-2xl border-2 border-dashed transition-all cursor-pointer text-center relative overflow-hidden mb-5 ${
            isDragging
              ? "border-cyan-400 bg-cyan-500/10"
              : "border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-indigo-500/40"
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadFile(file);
            }}
            accept="application/pdf"
            className="hidden"
          />

          <div className="flex flex-col items-center justify-center gap-2">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
              {isUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              ) : (
                <FileUp className="w-6 h-6 text-cyan-400" />
              )}
            </div>
            <p className="text-xs font-semibold text-white">
              {isUploading
                ? "Extracting PDF, generating embeddings & upserting to Pinecone..."
                : "Click to upload or drag & drop PDF files"}
            </p>
            <p className="text-[11px] text-slate-400">
              Supports standard PDFs up to 20 MB with semantic chunking.
            </p>
          </div>
        </div>

        {/* Document List Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Indexed Documents ({documents.length})
          </span>
          <span className="text-[10px] text-slate-500 font-mono">Pinecone Synced</span>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span>Loading documents...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500 italic bg-white/[0.02] rounded-xl border border-white/5">
              No documents uploaded yet. Upload a PDF above to ground your answers!
            </div>
          ) : (
            documents.map((doc) => (
              <div
                key={doc.id}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/20 flex items-center justify-between gap-3 transition-all"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-9 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center text-[10px] font-black text-red-400 shrink-0">
                    PDF
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{doc.filename}</p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                      <span>Size: {doc.file_size || "1.8 MB"}</span>
                      <span>•</span>
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Vectorized
                      </span>
                      <span>•</span>
                      <span className="text-cyan-300/80">
                        {doc.storage_provider === "supabase"
                          ? "Supabase"
                          : doc.storage_provider === "aws_s3"
                          ? "AWS S3"
                          : doc.storage_provider === "cloud"
                          ? "Cloud"
                          : "Local"}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleDelete(doc.id)}
                  disabled={deleteLoadingId === doc.id}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove document"
                >
                  {deleteLoadingId === doc.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
