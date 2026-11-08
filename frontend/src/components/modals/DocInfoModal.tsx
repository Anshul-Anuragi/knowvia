"use client";

import React from "react";
import { X, ShieldCheck, FileText, Globe, CheckCircle2 } from "lucide-react";

interface DocInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "about" | "docs" | "privacy" | "terms" | null;
}

export default function DocInfoModal({ isOpen, onClose, type }: DocInfoModalProps) {
  if (!isOpen || !type) return null;

  const contentMap = {
    about: {
      title: "About Aqvon & Knowvia AI",
      subtitle: "Enterprise Document Intelligence Platform",
      icon: Globe,
      body: (
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            <strong>Knowvia AI</strong> by <strong>Aqvon</strong> is a next-generation Enterprise Retrieval-Augmented Generation (RAG) platform designed to eliminate hallucinations and synthesize actionable intelligence across organizational knowledge repositories.
          </p>
          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5">
            <h5 className="font-semibold text-white">Core Technology:</h5>
            <ul className="list-disc list-inside space-y-1 text-slate-400">
              <li>High-dimensional vector embeddings with BGE & Pinecone.</li>
              <li>Contextual query rewriting for multi-turn references.</li>
              <li>Sub-phrase verification and source passage grounding.</li>
              <li>Support for extensive PDFs, manuals, and enterprise specs.</li>
            </ul>
          </div>
          <p className="text-[11px] text-slate-400">
            Version 2.4.0-enterprise • Built with Next.js, FastAPI & PostgreSQL.
          </p>
        </div>
      ),
    },
    docs: {
      title: "Documentation & User Guide",
      subtitle: "How to use Knowvia RAG effectively",
      icon: FileText,
      body: (
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            Welcome to the Knowvia documentation. Here is how to get the most out of the system:
          </p>
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="font-semibold text-white">1. Indexing Documents:</span>
              <p className="text-slate-400 mt-0.5">
                Click the Knowledge Base icon or Paperclip in the chat dock to upload your PDF documents. Chunks and embeddings are generated instantly.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="font-semibold text-white">2. Scoped Document Chat:</span>
              <p className="text-slate-400 mt-0.5">
                Navigate to &quot;Sources&quot; in the left sidebar to select specific documents for targeted questions.
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
              <span className="font-semibold text-white">3. Source Validation:</span>
              <p className="text-slate-400 mt-0.5">
                Click citation numbers [1], [2] in answers or the Sources icon to inspect exact extracted passages.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    privacy: {
      title: "Privacy Policy",
      subtitle: "Enterprise data privacy and encryption guarantee",
      icon: ShieldCheck,
      body: (
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Zero Data Leakage & Isolated Tenancy</span>
          </div>
          <p>
            Your uploaded documents and vector embeddings are encrypted at rest using AES-256 and during transit via TLS 1.3. Each user workspace is strictly isolated by UUID tenants.
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Customer documents are never used for foundation model training.</li>
            <li>Pinecone vector namespaces are user-isolated.</li>
            <li>You can delete your documents and embeddings at any time.</li>
          </ul>
        </div>
      ),
    },
    terms: {
      title: "Terms of Service",
      subtitle: "Knowvia Enterprise Service Agreement",
      icon: FileText,
      body: (
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            By utilizing Knowvia AI and Aqvon services, you agree to our standard Enterprise Acceptable Use Policy:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-400">
            <li>Ensure you possess lawful rights to all uploaded proprietary documents.</li>
            <li>Do not upload malicious code, exploits, or illegal content.</li>
            <li>Service availability adheres to a 99.9% uptime SLA for Enterprise tiers.</li>
          </ul>
          <p className="text-[11px] text-slate-500 pt-2">
            Last updated: October 2026 • Aqvon Technologies Inc.
          </p>
        </div>
      ),
    },
  };

  const item = contentMap[type];
  const IconComponent = item.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-[#0B1026]/85 backdrop-blur-2xl border border-white/10 shadow-2xl p-6 text-white relative">
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{item.title}</h3>
              <p className="text-[11px] text-slate-400">{item.subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-4">{item.body}</div>

        <div className="pt-3 border-t border-white/[0.08] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

