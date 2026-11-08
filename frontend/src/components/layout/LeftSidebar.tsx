"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  MessageSquare,
  Database,
  FileText,
  Clock,
  Plus,
  Trash2,
  LogOut,
  LogIn,
  BrainCircuit,
  SlidersHorizontal,
  Check,
  Sparkles,
  Sliders,
  PanelLeftClose,
  ChevronRight,
  User as UserIcon,
  Settings as SettingsIcon,
  HelpCircle,
  BookOpen,
  ShieldCheck,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { formatRelativeTime } from "@/lib/utils";
import DocInfoModal from "@/components/modals/DocInfoModal";

export default function LeftSidebar() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const {
    conversations,
    activeConversationId,
    selectConversation,
    createNewConversation,
    deleteConversation,
    setIsKnowledgeBaseOpen,
    setIsSettingsOpen,
    setIsUpgradeModalOpen,
    setIsCustomizationOpen,
    userDocuments,
    selectedDocumentIds,
    toggleDocumentSelection,
    toggleSelectAllDocuments,
    isLeftSidebarOpen,
    toggleLeftSidebar,
    leftSidebarWidth,
    setLeftSidebarWidth,
  } = useChat();

  const [activeTab, setActiveTab] = useState<"chat" | "sources">("chat");
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLearnMoreOpen, setIsLearnMoreOpen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<"about" | "docs" | "privacy" | "terms" | null>(null);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
        setIsLearnMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Resizing logic for Left Sidebar with cursor
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startWidth = leftSidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(210, Math.min(480, startWidth + delta));
      setLeftSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  if (!isLeftSidebarOpen) {
    return null;
  }

  const getInitials = (name?: string) => {
    if (!name) return "AN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const isAllSelected =
    userDocuments.length > 0 &&
    selectedDocumentIds.length === userDocuments.length;

  return (
    <>
      <aside
        style={{ width: `${leftSidebarWidth}px` }}
        className="h-screen flex flex-col justify-between border-r border-white/10 bg-[#060919]/90 backdrop-blur-2xl select-none z-20 shrink-0 relative transition-[width] duration-75"
      >
        {/* Resize Handle on Right Edge */}
        <div
          onMouseDown={startResizing}
          className={`absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-indigo-500/50 transition-colors z-40 ${
            isResizing ? "bg-indigo-500 w-1 shadow-lg shadow-indigo-500/50" : ""
          }`}
          title="Drag to resize sidebar"
        />

        {/* Top Section */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Brand Header with Collapse Toggle Button */}
          <div className="p-4 flex items-center justify-between border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                <BrainCircuit className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white">Knowvia</span>
                  <span className="text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    RAG
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium leading-none mt-0.5">
                  Enterprise AI
                </p>
              </div>
            </div>

            {/* Sidebar Collapse Toggle Button */}
            <button
              onClick={toggleLeftSidebar}
              title="Collapse sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* New Chat Button */}
          <div className="p-3">
            <button
              onClick={() => {
                setActiveTab("chat");
                createNewConversation();
              }}
              className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-xs flex items-center justify-between shadow-lg shadow-indigo-600/20 transition-all duration-200 border border-indigo-400/30 group active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-200" />
                <span>New chat</span>
              </div>
              <kbd className="text-[10px] bg-black/30 border border-white/20 px-1.5 py-0.5 rounded text-indigo-200 font-mono">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Main Navigation Tabs */}
          <nav className="px-3 py-1 space-y-1">
            <button
              onClick={() => setActiveTab("chat")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "chat"
                  ? "bg-white/[0.08] text-indigo-300 border border-indigo-500/30 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare className={`w-4 h-4 ${activeTab === "chat" ? "text-indigo-400" : "text-slate-400"}`} />
                <span>Chat</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {conversations.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("sources")}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === "sources"
                  ? "bg-white/[0.08] text-violet-300 border border-violet-500/30 shadow-sm"
                  : "text-slate-300 hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FileText className={`w-4 h-4 ${activeTab === "sources" ? "text-violet-400" : "text-slate-400"}`} />
                <span>Sources</span>
              </div>
              {userDocuments.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 font-mono">
                  {selectedDocumentIds.length}/{userDocuments.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setIsKnowledgeBaseOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors group"
            >
              <Database className="w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-colors" />
              <span>Knowledge Base</span>
            </button>

            {/* Customization Option (Replaced Settings) */}
            <button
              onClick={() => setIsCustomizationOpen(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.04] transition-colors group"
            >
              <Sliders className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              <span>Customization</span>
            </button>
          </nav>

          {/* Tab Content: Recent Conversations OR Sources Document Selector */}
          {activeTab === "chat" ? (
            /* Recent Conversations List */
            <div className="px-3 pt-3 pb-2 flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Conversations
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {conversations.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 pr-1 -mr-1">
                {conversations.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 italic">
                    No conversations yet. Start a new chat!
                  </div>
                ) : (
                  conversations.map((c) => {
                    const isActive = activeConversationId === c.id;
                    return (
                      <div
                        key={c.id}
                        onClick={() => selectConversation(c.id)}
                        className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-all ${
                          isActive
                            ? "bg-white/[0.08] text-white border-l-2 border-indigo-500 font-medium shadow-sm"
                            : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]"
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="truncate">{c.title || "New Conversation"}</p>
                          <span className="text-[10px] text-slate-500 block">
                            {formatRelativeTime(c.created_at)}
                          </span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                          title="Delete conversation"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Sources Option: Uploaded Documents with Checkboxes (Image 3) */
            <div className="px-3 pt-3 pb-2 flex-1 flex flex-col min-h-0">
              {/* Header: Sparkles, Sliders, 'Select all', Checkbox */}
              <div className="flex items-center justify-between px-2.5 py-2 mb-2 rounded-lg bg-white/[0.03] border border-white/5">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">Select all</span>
                </div>
                <button
                  type="button"
                  onClick={toggleSelectAllDocuments}
                  className="w-4 h-4 rounded-md border border-slate-500 hover:border-slate-300 flex items-center justify-center transition-all bg-transparent focus:outline-none"
                  title={isAllSelected ? "Deselect all" : "Select all"}
                >
                  {isAllSelected && <Check className="w-3 h-3 text-white stroke-[2.5]" />}
                </button>
              </div>

              {/* Documents List */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
                {userDocuments.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500 space-y-2">
                    <p className="italic">No documents uploaded yet.</p>
                    <button
                      onClick={() => setIsKnowledgeBaseOpen(true)}
                      className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                    >
                      Upload your first PDF
                    </button>
                  </div>
                ) : (
                  userDocuments.map((doc) => {
                    const isSelected = selectedDocumentIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => toggleDocumentSelection(doc.id)}
                        className={`flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-white/[0.06] border-white/10 text-white"
                            : "bg-transparent border-transparent hover:bg-white/[0.03] text-slate-300"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="px-1 py-0.5 rounded text-[10px] font-black text-red-500 border border-red-500/80 bg-red-500/10 tracking-tight shrink-0 font-sans">
                            PDF
                          </span>
                          <span
                            className="text-xs truncate font-medium text-slate-200"
                            title={doc.filename}
                          >
                            {doc.filename}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDocumentSelection(doc.id);
                          }}
                          className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all focus:outline-none ${
                            isSelected
                              ? "bg-slate-200 text-black border-slate-200"
                            : "border-slate-500 hover:border-slate-300 bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <Check className="w-3 h-3 text-black stroke-[3]" />
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {userDocuments.length > 0 && (
                <div className="pt-2 px-1 text-[10px] text-slate-500 text-center font-mono border-t border-white/5 mt-1">
                  {selectedDocumentIds.length === 0
                    ? "No documents selected (all searched)"
                    : `${selectedDocumentIds.length} of ${userDocuments.length} document${selectedDocumentIds.length > 1 ? "s" : ""} selected for chat`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Bar (Bottom) - Matching Image 1 */}
        <div className="p-3 border-t border-white/[0.08] relative" ref={profileRef}>
          {/* Profile Card Popup (Opens when clicking profile) */}
          {isProfileMenuOpen && (
            <div className="absolute bottom-full left-3 mb-2 w-64 rounded-2xl bg-[#0e1328]/90 backdrop-blur-2xl border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-200">
              {/* Header inside popup */}
              <div className="flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.04] transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                    {user?.name ? getInitials(user.name) : "AN"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white truncate">
                      {user?.name || "Anuragi"}
                    </p>
                    <p className="text-[10px] text-slate-400 capitalize">
                      {user?.subscription_tier || "Free"}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>

              <div className="border-t border-white/[0.08] my-1" />

              {/* Upgrade plan */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsUpgradeModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Upgrade plan</span>
              </button>

              {/* Profile */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                <UserIcon className="w-4 h-4 text-slate-400" />
                <span>Profile</span>
              </button>

              {/* Settings */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                <SettingsIcon className="w-4 h-4 text-slate-400" />
                <span>Settings</span>
              </button>

              {/* Learn more option with second card / flyout */}
              <div className="relative">
                <button
                  onClick={() => setIsLearnMoreOpen(!isLearnMoreOpen)}
                  onMouseEnter={() => setIsLearnMoreOpen(true)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors ${
                    isLearnMoreOpen
                      ? "bg-white/[0.08] text-white"
                      : "hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-4 h-4 text-cyan-400" />
                    <span>Learn more</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* Second Card Flyout: About Aqvon, Docs, Privacy, Terms */}
                {isLearnMoreOpen && (
                  <div
                    onMouseLeave={() => setIsLearnMoreOpen(false)}
                    className="absolute left-full bottom-0 ml-2 w-60 rounded-2xl bg-[#0e1328]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 space-y-1 text-slate-200"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-white/[0.06] mb-1">
                      Resources & Legal
                    </div>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLearnMoreOpen(false);
                        setInfoModalType("about");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>About Aqvon</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLearnMoreOpen(false);
                        setInfoModalType("docs");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                      <span>Read documentation</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLearnMoreOpen(false);
                        setInfoModalType("privacy");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Privacy policy</span>
                    </button>

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsLearnMoreOpen(false);
                        setInfoModalType("terms");
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs hover:bg-white/[0.06] hover:text-white transition-colors text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span>Terms of services</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Help */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setInfoModalType("docs");
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <HelpCircle className="w-4 h-4 text-slate-400" />
                  <span>Help</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>

              <div className="border-t border-white/[0.08] my-1" />

              {/* Log out */}
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Log out</span>
              </button>
            </div>
          )}

          {/* Profile Bar Button matching Image 1 */}
          {isAuthenticated && user ? (
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex-1 flex items-center gap-2.5 p-1.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all text-left min-w-0"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-bold flex items-center justify-center text-xs shrink-0">
                  {getInitials(user.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">
                    {user.name}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize truncate">
                    {user.subscription_tier || "Free"}
                  </p>
                </div>
              </button>

              {/* Upgrade Button matching Image 1 */}
              <button
                onClick={() => setIsUpgradeModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 transition-all shrink-0 active:scale-95"
              >
                Upgrade
              </button>
            </div>
          ) : (
            <button
              onClick={openAuthModal}
              className="w-full py-2 px-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white text-xs font-medium border border-white/10 flex items-center justify-center gap-2 transition-all"
            >
              <LogIn className="w-4 h-4 text-indigo-400" />
              <span>Sign In / Register</span>
            </button>
          )}
        </div>
      </aside>

      {/* Secondary Doc Info Modal */}
      <DocInfoModal
        isOpen={infoModalType !== null}
        onClose={() => setInfoModalType(null)}
        type={infoModalType}
      />
    </>
  );
}
