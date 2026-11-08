"use client";

import React from "react";
import { Layers, PanelLeftOpen } from "lucide-react";
import { useChat } from "@/context/ChatContext";

export default function TopHeader() {
  const {
    isRightPanelOpen,
    setIsRightPanelOpen,
    isLeftSidebarOpen,
    toggleLeftSidebar,
  } = useChat();

  return (
    <div className="absolute top-3 left-0 right-0 px-4 flex items-center justify-between pointer-events-none z-30">
      {/* Left: Re-open Left Sidebar toggle button when sidebar is collapsed */}
      <div className="pointer-events-auto">
        {!isLeftSidebarOpen && (
          <button
            onClick={toggleLeftSidebar}
            title="Open Sidebar"
            className="p-2 rounded-xl bg-[#060919]/80 hover:bg-white/[0.08] border border-white/10 text-slate-300 hover:text-white backdrop-blur-xl shadow-lg transition-all flex items-center gap-1.5 text-xs"
          >
            <PanelLeftOpen className="w-4 h-4 text-indigo-400" />
            <span className="font-medium">Sidebar</span>
          </button>
        )}
      </div>

      {/* Right: Source Validation Icon Button */}
      <div className="pointer-events-auto">
        <button
          onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
          title={isRightPanelOpen ? "Close Source Validation Panel" : "Open Source Validation Panel"}
          className={`p-2 rounded-xl border text-xs backdrop-blur-xl transition-all shadow-lg flex items-center justify-center relative ${
            isRightPanelOpen
              ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-200"
              : "bg-[#060919]/80 hover:bg-white/[0.08] border-white/10 text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          {isRightPanelOpen && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
          )}
        </button>
      </div>
    </div>
  );
}
