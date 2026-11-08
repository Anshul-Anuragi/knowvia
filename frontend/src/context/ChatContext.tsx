"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Conversation, Message, Source, DocumentItem, MindMapResponse, MindMapNode, MindMapGenerateRequest } from "@/types/api";
import { api } from "@/lib/api";
import { useAuth } from "./AuthContext";

interface ChatContextType {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  isLoadingMessages: boolean;
  isGenerating: boolean;
  streamingAnswer: string;
  streamingSources: Source[];
  searchMode: "rag" | "research" | "deep_research";
  setSearchMode: (mode: "rag" | "research" | "deep_research") => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  activeSources: Source[];
  activeExtractedSnippet: Source | null;
  setActiveExtractedSnippet: (source: Source | null) => void;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (open: boolean) => void;
  // Left sidebar state & resizing
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (open: boolean) => void;
  toggleLeftSidebar: () => void;
  leftSidebarWidth: number;
  setLeftSidebarWidth: (width: number) => void;
  rightSidebarWidth: number;
  setRightSidebarWidth: (width: number) => void;
  // Modals
  isUpgradeModalOpen: boolean;
  setIsUpgradeModalOpen: (open: boolean) => void;
  isKnowledgeBaseOpen: boolean;
  setIsKnowledgeBaseOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  isCustomizationOpen: boolean;
  setIsCustomizationOpen: (open: boolean) => void;
  isReady: boolean;
  systemHealth: { status: string; database?: string } | null;
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createNewConversation: () => Promise<string | null>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (question: string) => Promise<void>;
  focusSource: (source: Source) => void;
  focusCitation: (documentIdOrIndex: string | number, chunkId?: string) => void;
  // Live Document Viewer & Source Validation
  activeViewerDocId: string | null;
  setActiveViewerDocId: (docId: string | null) => void;
  highlightedChunkId: string | null;
  setHighlightedChunkId: (chunkId: string | null) => void;
  rightPanelTab: "validation" | "mindmap";
  setRightPanelTab: (tab: "validation" | "mindmap") => void;
  // Document selection for RAG
  userDocuments: DocumentItem[];
  selectedDocumentIds: string[];
  setSelectedDocumentIds: (ids: string[]) => void;
  toggleDocumentSelection: (id: string) => void;
  toggleSelectAllDocuments: () => void;
  loadDocuments: () => Promise<void>;
  // Mind Map Engine
  mindMapData: MindMapResponse | null;
  isMindMapLoading: boolean;
  mindMapError: string | null;
  generateMindMap: (
    forceRegenerate?: boolean,
    customOptions?: { selectedText?: string; topicTitle?: string }
  ) => Promise<void>;
  expandMindMapNode: (nodeId: string) => Promise<void>;
  deleteMindMap: () => Promise<void>;
  selectedMindMapNode: MindMapNode | null;
  setSelectedMindMapNode: (node: MindMapNode | null) => void;
  isMindMapFullscreen: boolean;
  setIsMindMapFullscreen: (fullscreen: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, openAuthModal } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [streamingAnswer, setStreamingAnswer] = useState<string>("");
  const [streamingSources, setStreamingSources] = useState<Source[]>([]);

  // Search Mode & Models
  const [searchMode, setSearchMode] = useState<"rag" | "research" | "deep_research">("rag");
  const [selectedModel, setSelectedModel] = useState<string>("gemini-1.5-flash");

  // Document Sources & Selection for Chat Scoping
  const [userDocuments, setUserDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);

  // Right panel & grounding
  const [activeSources, setActiveSources] = useState<Source[]>([]);
  const [activeExtractedSnippet, setActiveExtractedSnippet] = useState<Source | null>(null);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<"validation" | "mindmap">("validation");
  const [activeViewerDocId, setActiveViewerDocId] = useState<string | null>(null);
  const [highlightedChunkId, setHighlightedChunkId] = useState<string | null>(null);

  // Sync active viewer document with selection
  useEffect(() => {
    if (selectedDocumentIds.length > 0) {
      if (!activeViewerDocId || !selectedDocumentIds.includes(activeViewerDocId)) {
        setActiveViewerDocId(selectedDocumentIds[0]);
      }
    } else if (userDocuments.length > 0 && !activeViewerDocId) {
      setActiveViewerDocId(userDocuments[0].id);
    }
  }, [selectedDocumentIds, userDocuments, activeViewerDocId]);

  // Left sidebar & resizable widths
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(270);
  const [rightSidebarWidth, setRightSidebarWidth] = useState<number>(320);

  const toggleLeftSidebar = () => setIsLeftSidebarOpen((prev) => !prev);

  // Modals
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);
  const [isKnowledgeBaseOpen, setIsKnowledgeBaseOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isCustomizationOpen, setIsCustomizationOpen] = useState<boolean>(false);

  // Mind Map State
  const [mindMapData, setMindMapData] = useState<MindMapResponse | null>(null);
  const [isMindMapLoading, setIsMindMapLoading] = useState<boolean>(false);
  const [mindMapError, setMindMapError] = useState<string | null>(null);
  const [selectedMindMapNode, setSelectedMindMapNode] = useState<MindMapNode | null>(null);
  const [isMindMapFullscreen, setIsMindMapFullscreen] = useState<boolean>(false);

  // Health
  const [isReady, setIsReady] = useState<boolean>(false);
  const [systemHealth, setSystemHealth] = useState<{ status: string; database?: string } | null>(null);

  // Health probe polling silently
  useEffect(() => {
    const probeHealth = async () => {
      try {
        const res = await api.checkReadiness();
        setIsReady(res.status === "ready");
        setSystemHealth(res);
      } catch {
        setIsReady(false);
        setSystemHealth(null);
      }
    };

    probeHealth();
    const interval = setInterval(probeHealth, 20000);
    return () => clearInterval(interval);
  }, []);

  // Load documents for current user
  const loadDocuments = useCallback(async () => {
    if (!isAuthenticated) {
      setUserDocuments([]);
      setSelectedDocumentIds([]);
      return;
    }
    try {
      const docs = await api.getDocuments();
      setUserDocuments(docs);
      // Auto-select all by default if none selected yet
      setSelectedDocumentIds((prev) => {
        if (prev.length === 0 && docs.length > 0) {
          return docs.map((d) => d.id);
        }
        return prev;
      });
    } catch (err) {
      console.warn("Could not load user documents:", err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const toggleDocumentSelection = (id: string) => {
    setSelectedDocumentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllDocuments = () => {
    if (selectedDocumentIds.length === userDocuments.length && userDocuments.length > 0) {
      setSelectedDocumentIds([]);
    } else {
      setSelectedDocumentIds(userDocuments.map((d) => d.id));
    }
  };

  // Load conversations when authenticated
  const loadConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const list = await api.getConversations();
      setConversations(list);
      if (list.length > 0 && !activeConversationId) {
        setActiveConversationId(list[0].id);
      }
    } catch (err) {
      console.warn("Could not load conversations:", err);
    }
  }, [isAuthenticated, activeConversationId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages whenever active conversation changes
  useEffect(() => {
    if (!activeConversationId || !isAuthenticated) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsLoadingMessages(true);
      try {
        const msgs = await api.getConversationMessages(activeConversationId);
        setMessages(msgs);
        // Find latest assistant message with sources if any
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === "assistant" && msgs[i].sources && msgs[i].sources!.length > 0) {
            setActiveSources(msgs[i].sources!);
            setActiveExtractedSnippet(msgs[i].sources![0]);
            break;
          }
        }
      } catch (err) {
        console.error("Failed to load messages:", err);
      } finally {
        setIsLoadingMessages(false);
      }
    };

    fetchMessages();
  }, [activeConversationId, isAuthenticated]);

  const selectConversation = async (id: string) => {
    if (isGenerating) return;
    setActiveConversationId(id);
  };

  const createNewConversation = async (): Promise<string | null> => {
    if (!isAuthenticated) {
      openAuthModal();
      return null;
    }

    try {
      const newConv = await api.createConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      setActiveSources([]);
      setActiveExtractedSnippet(null);
      return newConv.id;
    } catch (err) {
      console.error("Failed to create conversation:", err);
      return null;
    }
  };

  const deleteConversation = async (id: string) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        const remaining = conversations.filter((c) => c.id !== id);
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
          setActiveSources([]);
          setActiveExtractedSnippet(null);
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const focusSource = (source: Source) => {
    setIsRightPanelOpen(true);
    setActiveExtractedSnippet(source);
    const idx = source.citation_index || 1;
    setTimeout(() => {
      const el = document.getElementById(`source-chunk-${idx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
  };

  const focusCitation = (documentIdOrIndex: string | number, chunkId?: string) => {
    setIsRightPanelOpen(true);
    setRightPanelTab("validation");

    let targetDocId: string | null = null;
    let targetChunkId: string | null = null;

    if (typeof documentIdOrIndex === "string") {
      targetDocId = documentIdOrIndex;
      targetChunkId = chunkId || null;
      const foundSource = activeSources.find(
        (s) =>
          (chunkId && s.chunk_id === chunkId) ||
          (documentIdOrIndex && s.document_id === documentIdOrIndex)
      );
      if (foundSource) {
        setActiveExtractedSnippet(foundSource);
      }
    } else {
      const found =
        activeSources.find((s) => s.citation_index === documentIdOrIndex) ||
        activeSources[documentIdOrIndex - 1];
      if (found) {
        targetDocId = found.document_id;
        targetChunkId = found.chunk_id || `chunk_${String(documentIdOrIndex).padStart(3, "0")}`;
        setActiveExtractedSnippet(found);
      }
    }

    if (targetDocId) {
      setActiveViewerDocId(targetDocId);
    }
    if (targetChunkId) {
      setHighlightedChunkId(targetChunkId);
    }

    setTimeout(() => {
      if (targetChunkId) {
        const el = document.getElementById(targetChunkId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
      if (typeof documentIdOrIndex === "number") {
        const elLegacy = document.getElementById(`source-chunk-${documentIdOrIndex}`);
        if (elLegacy) {
          elLegacy.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, 250);
  };

  const generateMindMap = useCallback(
    async (
      forceRegenerate = false,
      customOptions?: { selectedText?: string; topicTitle?: string }
    ) => {
      if (!isAuthenticated) {
        openAuthModal();
        return;
      }

      const hasSelectedText = !!(customOptions?.selectedText && customOptions.selectedText.trim());

      const docIds =
        selectedDocumentIds.length > 0
          ? selectedDocumentIds
          : userDocuments.map((d) => d.id);

      if (!hasSelectedText && docIds.length === 0) {
        setMindMapError("Please upload or select at least one document or provide text to generate a Mind Map.");
        setIsKnowledgeBaseOpen(true);
        return;
      }

      setIsMindMapLoading(true);
      setMindMapError(null);

      try {
        const payload: MindMapGenerateRequest = hasSelectedText
          ? {
              selected_text: customOptions!.selectedText!.trim(),
              topic_title: customOptions?.topicTitle?.trim() || "Concept Mind Map",
              force_regenerate: forceRegenerate,
            }
          : {
              document_ids: docIds,
              force_regenerate: forceRegenerate,
            };

        const result = await api.generateMindMap(payload);
        setMindMapData(result);
        if (result.nodes && result.nodes.length > 0) {
          setSelectedMindMapNode(result.nodes[0]);
        }
      } catch (err: unknown) {
        let msg = err instanceof Error ? err.message : "Failed to generate mind map";
        if (msg === "Failed to fetch" || msg.includes("NetworkError")) {
          msg = "Backend server is offline or unreachable. Please verify the API is running at " + (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");
        }
        setMindMapError(msg);
      } finally {
        setIsMindMapLoading(false);
      }
    },
    [isAuthenticated, openAuthModal, selectedDocumentIds, userDocuments, setIsKnowledgeBaseOpen]
  );

  const expandMindMapNode = useCallback(
    async (nodeId: string) => {
      if (!mindMapData) return;
      setIsMindMapLoading(true);
      setMindMapError(null);
      try {
        const updated = await api.expandMindMapNode({
          mindmap_id: mindMapData.id,
          node_id: nodeId,
        });
        setMindMapData(updated);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to expand node";
        setMindMapError(msg);
      } finally {
        setIsMindMapLoading(false);
      }
    },
    [mindMapData]
  );

  const deleteMindMap = useCallback(async () => {
    if (!mindMapData) return;
    try {
      await api.deleteMindMap(mindMapData.id);
      setMindMapData(null);
      setSelectedMindMapNode(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete mind map";
      setMindMapError(msg);
    }
  }, [mindMapData]);

  // High-Speed Progressive Typewriter Engine (Sub-500ms Cadence)
  const streamTokens = (
    fullText: string,
    sources: Source[],
    onComplete: () => void
  ) => {
    // Split into natural word & punctuation tokens
    const words = fullText.split(/(\s+)/);
    let currentIndex = 0;
    let accumulated = "";

    const intervalTime = 8; // 8ms fast interval
    const wordsPerTick = 6;  // 6 words per tick for immediate snappy display

    const timer = setInterval(() => {
      if (currentIndex < words.length) {
        const chunk = words.slice(currentIndex, currentIndex + wordsPerTick).join("");
        accumulated += chunk;
        setStreamingAnswer(accumulated);
        currentIndex += wordsPerTick;
      } else {
        clearInterval(timer);
        setStreamingAnswer(fullText);
        onComplete();
      }
    }, intervalTime);
  };

  const sendMessage = async (question: string) => {
    if (!question.trim() || isGenerating) return;

    if (!isAuthenticated) {
      openAuthModal();
      return;
    }

    let currentConvId = activeConversationId;
    if (!currentConvId) {
      currentConvId = await createNewConversation();
      if (!currentConvId) return;
    }

    // Add user message to UI immediately
    const userMsg: Message = {
      role: "user",
      content: question.trim(),
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsGenerating(true);
    setStreamingAnswer("");
    setStreamingSources([]);

    try {
      if (searchMode === "research") {
        const res = await api.runResearch({
          query: question.trim(),
          conversation_id: currentConvId,
          selected_documents: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
        });

        setIsGenerating(false);
        const assistantMsg: Message = {
          role: "assistant",
          content: res.answer,
          created_at: new Date().toISOString(),
          sources: res.sources,
          is_research_report: true,
          report_filename: res.report_filename,
          report_path: res.report_path,
          tool_steps: res.tool_steps,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingAnswer("");
        setStreamingSources([]);
        loadConversations();
        return;
      }

      const response = await api.askQuestion({
        conversation_id: currentConvId,
        question: question.trim(),
        mode: searchMode,
        model: selectedModel,
        document_ids: selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined,
      });

      setStreamingSources(response.sources || []);
      setActiveSources(response.sources || []);
      if (response.sources && response.sources.length > 0) {
        setActiveExtractedSnippet(response.sources[0]);
      }

      // Stream the assistant response smoothly
      streamTokens(response.answer, response.sources || [], () => {
        setIsGenerating(false);
        const assistantMsg: Message = {
          role: "assistant",
          content: response.answer,
          created_at: new Date().toISOString(),
          sources: response.sources,
        };
        setMessages((prev) => [...prev, assistantMsg]);
        setStreamingAnswer("");
        setStreamingSources([]);
        loadConversations(); // refresh title if updated by server
      });
    } catch (err: unknown) {
      setIsGenerating(false);
      setStreamingAnswer("");
      const errorText =
        err instanceof Error ? err.message : "Failed to obtain response from Knowvia AI.";
      const errorMsg: Message = {
        role: "assistant",
        content: `⚠️ **Error Processing Query**: ${errorText}\n\nPlease verify that your document is indexed or try again.`,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        conversations,
        activeConversationId,
        messages,
        isLoadingMessages,
        isGenerating,
        streamingAnswer,
        streamingSources,
        searchMode,
        setSearchMode,
        selectedModel,
        setSelectedModel,
        activeSources,
        activeExtractedSnippet,
        setActiveExtractedSnippet,
        isRightPanelOpen,
        setIsRightPanelOpen,
        isLeftSidebarOpen,
        setIsLeftSidebarOpen,
        toggleLeftSidebar,
        leftSidebarWidth,
        setLeftSidebarWidth,
        rightSidebarWidth,
        setRightSidebarWidth,
        isUpgradeModalOpen,
        setIsUpgradeModalOpen,
        isKnowledgeBaseOpen,
        setIsKnowledgeBaseOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        isCustomizationOpen,
        setIsCustomizationOpen,
        isReady,
        systemHealth,
        loadConversations,
        selectConversation,
        createNewConversation,
        deleteConversation,
        sendMessage,
        focusSource,
        focusCitation,
        // Live Document Viewer & Source Validation
        activeViewerDocId,
        setActiveViewerDocId,
        highlightedChunkId,
        setHighlightedChunkId,
        rightPanelTab,
        setRightPanelTab,
        userDocuments,
        selectedDocumentIds,
        setSelectedDocumentIds,
        toggleDocumentSelection,
        toggleSelectAllDocuments,
        loadDocuments,
        // Mind Map Engine
        mindMapData,
        isMindMapLoading,
        mindMapError,
        generateMindMap,
        expandMindMapNode,
        deleteMindMap,
        selectedMindMapNode,
        setSelectedMindMapNode,
        isMindMapFullscreen,
        setIsMindMapFullscreen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

