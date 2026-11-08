"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  FileText,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FolderDown,
  Globe,
  Database,
  Calendar,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import jsPDF from "jspdf";
import { Message, ToolStep } from "@/types/api";
import { useChat } from "@/context/ChatContext";

interface ResearchReportCardProps {
  message: Message;
}

export default function ResearchReportCard({ message }: ResearchReportCardProps) {
  const { focusCitation, setIsRightPanelOpen } = useChat();
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const filename = message.report_filename || "Research Report.md";
  const toolSteps: ToolStep[] = message.tool_steps || [];

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMd = () => {
    const blob = new Blob([message.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 45;
      const maxLineWidth = pageWidth - margin * 2;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(24, 28, 48);

      const titleLines = doc.splitTextToSize(filename.replace(".md", ""), maxLineWidth);
      doc.text(titleLines, margin, 50);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Knowvia AI Research Agent • Generated ${new Date().toLocaleDateString()} • Verified Citations`,
        margin,
        75
      );

      doc.setDrawColor(203, 213, 225);
      doc.line(margin, 85, pageWidth - margin, 85);

      doc.setFont("times", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);

      // Clean lines for PDF rendering
      const cleanContent = message.content
        .replace(/^#\s+.*/m, "")
        .replace(/\[\d+\]/g, "")
        .trim();

      const splitText = doc.splitTextToSize(cleanContent, maxLineWidth);
      let cursorY = 105;
      const lineHeight = 16;
      const pageHeight = doc.internal.pageSize.getHeight();

      for (let i = 0; i < splitText.length; i++) {
        if (cursorY + lineHeight > pageHeight - margin) {
          doc.addPage();
          cursorY = margin;
        }
        doc.text(splitText[i], margin, cursorY);
        cursorY += lineHeight;
      }

      doc.save(`${filename.replace(".md", "")}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getToolIcon = (toolName: string) => {
    switch (toolName) {
      case "get_current_date":
        return <Calendar className="w-3.5 h-3.5 text-amber-400" />;
      case "search_uploaded_documents":
        return <Database className="w-3.5 h-3.5 text-cyan-400" />;
      case "tavily_search":
        return <Globe className="w-3.5 h-3.5 text-indigo-400" />;
      case "wikipedia":
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
      case "save_report":
        return <FolderDown className="w-3.5 h-3.5 text-violet-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const citationMarkdownComponents = {
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => {
      if (href?.startsWith("#cite-")) {
        const citeNum = parseInt(href.replace("#cite-", ""), 10);
        return (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              focusCitation(citeNum);
            }}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#181a1f] hover:bg-[#282b34] text-[#a0a6b2] hover:text-white border border-white/10 hover:border-cyan-400/60 text-[11px] font-sans font-medium align-middle mx-0.5 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            {citeNum}
          </button>
        );
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-cyan-400 hover:text-cyan-300 underline font-medium break-all"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className="w-full rounded-3xl bg-[#090D22]/90 backdrop-blur-2xl border border-indigo-500/30 p-5 md:p-6 shadow-2xl relative space-y-4 animate-in fade-in duration-200">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-400" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-mono font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                LangGraph Research Report
              </span>
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                Verified Synthesis
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono mt-0.5 truncate">
              <span className="text-slate-400">📁</span>
              <span className="text-white font-medium truncate">
                reports/{filename}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
          <button
            onClick={handleDownloadMd}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all active:scale-95"
            title="Download Raw Markdown Report (.md)"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Download .MD</span>
          </button>

          <button
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all active:scale-95"
            title="Export Clean Printable PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Save as PDF</span>
          </button>

          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white border border-white/10 transition-all active:scale-95"
            title="Copy Report Content"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Collapsible Agent Tool Execution Trace */}
      {toolSteps.length > 0 && (
        <div className="rounded-2xl bg-black/40 border border-white/5 overflow-hidden">
          <button
            onClick={() => setIsTraceOpen(!isTraceOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs text-slate-300 hover:text-white hover:bg-white/[0.02] transition-colors font-mono"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-semibold text-slate-200">
                🔍 Agent Tool Trace ({toolSteps.length} steps executed)
              </span>
            </div>
            {isTraceOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {isTraceOpen && (
            <div className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-white/5">
              {toolSteps.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between gap-2 text-[11px] font-mono py-1 px-2 rounded-lg bg-white/[0.02] border border-white/5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getToolIcon(step.tool)}
                    <span className="font-semibold text-slate-200">{step.tool}</span>
                    {step.query && (
                      <span className="text-slate-400 truncate italic">
                        &quot;{step.query}&quot;
                      </span>
                    )}
                    {step.filename && (
                      <span className="text-cyan-300 truncate">
                        &rarr; {step.filename}
                      </span>
                    )}
                  </div>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>{step.status}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Executive Report Content */}
      <div className="markdown-body font-serif text-[15px] text-slate-200 leading-relaxed tracking-normal space-y-4">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={citationMarkdownComponents}
        >
          {message.content}
        </ReactMarkdown>
      </div>

      {/* Bottom Sources Ribbon if present */}
      {message.sources && message.sources.length > 0 && (
        <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5 font-mono text-[11px]">
            <Globe className="w-3.5 h-3.5 text-indigo-400" />
            <span>Grounded across {message.sources.length} primary references</span>
          </div>

          <button
            onClick={() => setIsRightPanelOpen(true)}
            className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline"
          >
            Inspect in Source Panel &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

