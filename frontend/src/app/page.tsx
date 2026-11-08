"use client";

import React from "react";
import LeftSidebar from "@/components/layout/LeftSidebar";
import TopHeader from "@/components/layout/TopHeader";
import RightValidationPanel from "@/components/layout/RightValidationPanel";
import ChatContainer from "@/components/chat/ChatContainer";
import ChatInput from "@/components/chat/ChatInput";
import AuthModal from "@/components/modals/AuthModal";
import UpgradeModal from "@/components/modals/UpgradeModal";
import KnowledgeBaseModal from "@/components/modals/KnowledgeBaseModal";
import SettingsModal from "@/components/modals/SettingsModal";
import CustomizationModal from "@/components/modals/CustomizationModal";

export default function Home() {
  return (
    <main className="flex h-screen w-screen overflow-hidden bg-[#060919] relative">
      {/* Column 1: Left Navigation & History Sidebar */}
      <LeftSidebar />

      {/* Column 2: Center Primary Intelligence Workspace */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden relative">
        <TopHeader />
        <ChatContainer />
        <ChatInput />
      </div>

      {/* Column 3: Right Grounding & Citations Validation Panel */}
      <RightValidationPanel />

      {/* Modals & Dialogs */}
      <AuthModal />
      <UpgradeModal />
      <KnowledgeBaseModal />
      <SettingsModal />
      <CustomizationModal />
    </main>
  );
}
