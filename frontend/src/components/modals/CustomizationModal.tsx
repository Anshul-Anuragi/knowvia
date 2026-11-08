"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Palette,
  Check,
  Sliders,
  ShieldCheck,
  Globe,
  FileText,
  Code2,
  Cpu,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";

export default function CustomizationModal() {
  const { isCustomizationOpen, setIsCustomizationOpen } = useChat();
  const [activeTab, setActiveTab] = useState<"skills" | "theme">("skills");

  // Skills state
  const [skills, setSkills] = useState({
    hybridRag: true,
    webGrounding: true,
    deepResearch: true,
    phraseVerification: true,
    codeInterpreter: true,
  });

  // Appearance state
  const [selectedTheme, setSelectedTheme] = useState("space-navy");
  const [blurIntensity, setBlurIntensity] = useState("balanced");
  const [typography, setTypography] = useState("serif");

  if (!isCustomizationOpen) return null;

  const toggleSkill = (key: keyof typeof skills) => {
    setSkills((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const themes = [
    {
      id: "space-navy",
      name: "Space Navy (Default)",
      desc: "Deep space navy (#060919) with glowing indigo accents",
      preview: "bg-[#060919] border-indigo-500/40",
      accent: "from-indigo-600 to-violet-600",
    },
    {
      id: "midnight-obsidian",
      name: "Midnight Obsidian",
      desc: "Pure dark slate (#030712) with cyan highlights",
      preview: "bg-[#030712] border-cyan-500/40",
      accent: "from-cyan-600 to-blue-600",
    },
    {
      id: "deep-violet",
      name: "Deep Violet Indigo",
      desc: "Rich galactic violet (#0F0A2A) with purple neon glow",
      preview: "bg-[#0F0A2A] border-purple-500/40",
      accent: "from-purple-600 to-indigo-600",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
      {/* Low-opacity glassmorphic card */}
      <div className="w-full max-w-2xl rounded-2xl bg-[#0B1026]/80 backdrop-blur-2xl border border-white/10 shadow-2xl p-6 text-white relative flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
              <Sliders className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Customization</h2>
              <p className="text-xs text-slate-400">
                Personalize your intelligence skills and interface appearance
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCustomizationOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 pt-4 pb-3 border-b border-white/[0.06]">
          <button
            onClick={() => setActiveTab("skills")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "skills"
                ? "bg-white/[0.08] text-indigo-300 border border-indigo-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Skills</span>
          </button>

          <button
            onClick={() => setActiveTab("theme")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === "theme"
                ? "bg-white/[0.08] text-violet-300 border border-violet-500/30 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
            }`}
          >
            <Palette className="w-3.5 h-3.5 text-violet-400" />
            <span>Theme & Appearance</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {activeTab === "skills" ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Configure specialized cognitive capabilities and analytical engines active during synthesis.
              </p>

              {/* Skill 1: Hybrid RAG */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 mt-0.5">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      Hybrid RAG Vector Grounding
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Dense semantic search and multi-vector retrieval across your indexed PDF documents.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill("hybridRag")}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${
                    skills.hybridRag ? "bg-indigo-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skills.hybridRag ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Skill 2: Web Grounding */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mt-0.5">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      Real-Time Web & News Grounding
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Synthesizes fresh industry trends, real-time facts, and domain updates.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill("webGrounding")}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${
                    skills.webGrounding ? "bg-indigo-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skills.webGrounding ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Skill 3: Deep Research */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 mt-0.5">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      Deep Research & Executive Synthesis
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Generates exhaustive, multi-section architectural and analytical reports.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill("deepResearch")}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${
                    skills.deepResearch ? "bg-indigo-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skills.deepResearch ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Skill 4: Sub-Phrase Verification */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      Sub-Phrase Validation & Hallucination Filter
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Underlines corroborating phrases in raw document snippets with confidence scores.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill("phraseVerification")}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${
                    skills.phraseVerification ? "bg-indigo-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skills.phraseVerification ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {/* Skill 5: Code & Data Analysis */}
              <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 mt-0.5">
                    <Code2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200">
                      Code & Markdown Table Formatter
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                      Renders structured technical tables, formulas, and syntax-highlighted code blocks.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => toggleSkill("codeInterpreter")}
                  className={`w-10 h-5 rounded-full transition-colors relative flex items-center shrink-0 ${
                    skills.codeInterpreter ? "bg-indigo-600" : "bg-white/10"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      skills.codeInterpreter ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Palette Selection */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Color Themes
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {themes.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTheme(t.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? "bg-white/[0.08] border-indigo-500 shadow-md"
                            : "bg-white/[0.02] border-white/10 hover:bg-white/[0.05]"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-white">{t.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                        <p className="text-[10px] text-slate-400 leading-snug">{t.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Glassmorphism Blur Intensity */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Glassmorphism Blur
                </label>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {["Subtle (8px)", "Balanced (16px)", "Ultra (24px)"].map((b, i) => {
                    const val = ["subtle", "balanced", "ultra"][i];
                    const isSel = blurIntensity === val;
                    return (
                      <button
                        key={val}
                        onClick={() => setBlurIntensity(val)}
                        className={`py-2 px-3 rounded-xl border text-center font-medium transition-all ${
                          isSel
                            ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                            : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                        }`}
                      >
                        {b}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Typography */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  AI Response Typography
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setTypography("serif")}
                    className={`py-2.5 px-3 rounded-xl border text-left font-serif transition-all ${
                      typography === "serif"
                        ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">Classic Serif (Active)</div>
                    <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                      Georgia / Cambria elegant reading typography
                    </div>
                  </button>

                  <button
                    onClick={() => setTypography("sans")}
                    className={`py-2.5 px-3 rounded-xl border text-left font-sans transition-all ${
                      typography === "sans"
                        ? "bg-indigo-600/25 border-indigo-500/50 text-indigo-200"
                        : "bg-white/[0.02] border-white/10 text-slate-400 hover:text-white"
                    }`}
                  >
                    <div className="font-semibold text-xs text-white">Modern Sans-Serif</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Clean inter-style sans typography
                    </div>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-white/[0.08] flex items-center justify-between text-xs text-slate-400">
          <span className="text-[11px] italic">
            More customization options and agent skills can be plugged in here.
          </span>
          <button
            onClick={() => setIsCustomizationOpen(false)}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium shadow-md transition-all active:scale-95"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

