"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  Download,
  FileText,
  Copy,
  Check,
  Code,
  Sun,
  Moon,
  ExternalLink,
  Network,
  Compass,
  FileCode,
  Info,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { api } from "@/lib/api";
import { MindMapResponse } from "@/types/api";
import {
  computeNotebookLMLayout,
  computeEdrawMindBilateralLayout,
  PositionedNode,
  PositionedEdge,
  RawMindMapNode,
} from "@/utils/mindmapLayout";
import {
  compileNodesToMermaid,
  buildMermaidLiveUrl,
  MermaidSubMode,
} from "@/utils/mermaidCompiler";
import {
  exportDiagramAsSVG,
  exportDiagramAsPNG,
  exportDiagramAsPDF,
} from "@/utils/mindmapExport";

export type StudioVisualMode = "notebooklm" | "edrawmind" | "mermaid";

function StudioContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mindmapId = searchParams.get("id");

  // State
  const [mindMapData, setMindMapData] = useState<MindMapResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active Modes & Theme
  const [visualMode, setVisualMode] = useState<StudioVisualMode>("edrawmind");
  const [canvasTheme, setCanvasTheme] = useState<"dark" | "light">("light");
  const [mermaidSubMode, setMermaidSubMode] = useState<MermaidSubMode>("mindmap");
  const [isMermaidDrawerOpen, setIsMermaidDrawerOpen] = useState<boolean>(false);
  const [customMermaidCode, setCustomMermaidCode] = useState<string>("");
  const [mermaidRenderedSvg, setMermaidRenderedSvg] = useState<string>("");
  const [mermaidError, setMermaidError] = useState<string | null>(null);
  const [showSummariesOnPills, setShowSummariesOnPills] = useState<boolean>(true);

  // Pan & Zoom
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Collapse State
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<PositionedNode | null>(null);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const mermaidContainerRef = useRef<HTMLDivElement>(null);

  // Load Mind Map from Cache / API
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setLoadError(null);

      // Check localStorage first for instant retrieval
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("knowvia_active_mindmap");
          if (cached) {
            const parsed = JSON.parse(cached) as MindMapResponse;
            if (!mindmapId || parsed.id === mindmapId) {
              setMindMapData(parsed);
              setIsLoading(false);
              return;
            }
          }
        } catch {
          // ignore cache read error
        }
      }

      // If ID provided, fetch from backend
      if (mindmapId) {
        try {
          const res = await api.getMindMap(mindmapId);
          setMindMapData(res);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to load Mind Map";
          setLoadError(msg);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
        setLoadError("No active Mind Map specified. Please generate one from Document Validation.");
      }
    }

    loadData();
  }, [mindmapId]);

  // Sync Default Canvas Theme per mode
  useEffect(() => {
    if (visualMode === "edrawmind") {
      setCanvasTheme("light");
    } else {
      setCanvasTheme("dark");
    }
  }, [visualMode]);

  // Convert raw flat nodes
  const rawNodes: RawMindMapNode[] = useMemo(() => {
    if (!mindMapData?.nodes) return [];
    return mindMapData.nodes.map((n) => ({
      id: n.id,
      parent_id: n.parent_id,
      label: n.label,
      summary: n.summary,
      level: n.level,
      page_numbers: n.page_numbers,
      source_ids: n.source_ids,
      can_expand_more: n.can_expand_more,
    }));
  }, [mindMapData]);

  // Compute Layout based on active visual mode
  const { nodes: positionedNodes, edges: positionedEdges, bounds } = useMemo(() => {
    if (rawNodes.length === 0) {
      return {
        nodes: [] as PositionedNode[],
        edges: [] as PositionedEdge[],
        bounds: { width: 1200, height: 800, minX: 0, minY: 0 },
      };
    }

    if (visualMode === "edrawmind") {
      const res = computeEdrawMindBilateralLayout(rawNodes, collapsedIds);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      res.nodes.forEach((n) => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
      });
      return {
        nodes: res.nodes,
        edges: res.edges,
        bounds: {
          width: res.width,
          height: res.height,
          minX: minX === Infinity ? 0 : minX,
          minY: minY === Infinity ? 0 : minY,
        },
      };
    }

    // Default to NotebookLM Layout
    const res = computeNotebookLMLayout(rawNodes, collapsedIds, showSummariesOnPills);
    let minX = Infinity;
    let minY = Infinity;
    res.nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
    });
    return {
      nodes: res.nodes,
      edges: res.edges,
      bounds: {
        width: res.width,
        height: res.height,
        minX: minX === Infinity ? 0 : minX,
        minY: minY === Infinity ? 0 : minY,
      },
    };
  }, [rawNodes, collapsedIds, visualMode, showSummariesOnPills]);

  // Sync & compile Mermaid Code
  useEffect(() => {
    if (rawNodes.length > 0) {
      const code = compileNodesToMermaid(rawNodes, mermaidSubMode);
      setCustomMermaidCode(code);
    }
  }, [rawNodes, mermaidSubMode]);

  // Dynamically Render Mermaid.js in browser
  useEffect(() => {
    if (visualMode !== "mermaid" || !customMermaidCode) return;

    let isMounted = true;
    async function renderMermaid() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: canvasTheme === "dark" ? "dark" : "default",
          securityLevel: "loose",
          mindmap: {
            useMaxWidth: false,
            padding: 20,
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
          },
        });

        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, customMermaidCode);
        if (isMounted) {
          setMermaidRenderedSvg(svg);
          setMermaidError(null);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : "Mermaid compilation error";
          setMermaidError(msg);
        }
      }
    }

    renderMermaid();
    return () => {
      isMounted = false;
    };
  }, [customMermaidCode, visualMode, canvasTheme]);

  // Fit to screen helper
  const fitView = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    if (visualMode === "mermaid") {
      setZoom(1);
      setPan({ x: 20, y: 20 });
      return;
    }

    const contentW = Math.max(200, bounds.width);
    const contentH = Math.max(200, bounds.height);

    const pad = 60;
    const scaleX = (clientWidth - pad * 2) / contentW;
    const scaleY = (clientHeight - pad * 2) / contentH;
    const bestZoom = Math.min(1.2, Math.max(0.18, Math.min(scaleX, scaleY)));

    setZoom(bestZoom);

    if (visualMode === "edrawmind") {
      // Center on center node (1400, bounds.height / 2)
      const targetCenterX = 1400;
      const targetCenterY = bounds.height / 2;
      setPan({
        x: clientWidth / 2 - targetCenterX * bestZoom,
        y: clientHeight / 2 - targetCenterY * bestZoom,
      });
    } else {
      // Align left root with margin
      setPan({
        x: 60,
        y: Math.max(20, (clientHeight - contentH * bestZoom) / 2),
      });
    }
  }, [bounds, visualMode]);

  // Initial fit view on data load or layout mode change
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView();
    }, 150);
    return () => clearTimeout(timer);
  }, [visualMode, mindMapData?.id, fitView]);

  // Pan interaction
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  // Wheel zoom centered on cursor
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = e.clientX - rect.left;
    const cursorY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newZoom = Math.min(2.5, Math.max(0.12, zoom * zoomFactor));

    setPan({
      x: cursorX - (cursorX - pan.x) * (newZoom / zoom),
      y: cursorY - (cursorY - pan.y) * (newZoom / zoom),
    });
    setZoom(newZoom);
  };

  // Branch collapse toggles
  const toggleCollapse = (nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const expandAll = () => setCollapsedIds(new Set());
  const collapseToLevel2 = () => {
    const next = new Set<string>();
    rawNodes.forEach((n) => {
      if (n.level >= 2) next.add(n.id);
    });
    setCollapsedIds(next);
  };

  // Exports
  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    exportDiagramAsSVG(svgRef.current, `${title}.svg`);
  };

  const handleExportPNG = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    try {
      await exportDiagramAsPNG(svgRef.current, `${title}.png`, {
        theme: canvasTheme,
        width: bounds.width + 160,
        height: bounds.height + 160,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    try {
      await exportDiagramAsPDF(svgRef.current, `${title}.pdf`, {
        theme: canvasTheme,
        width: bounds.width + 160,
        height: bounds.height + 160,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyMermaid = () => {
    navigator.clipboard.writeText(customMermaidCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadMMD = () => {
    const blob = new Blob([customMermaidCode], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mindMapData?.title || "diagram"}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openMermaidLive = () => {
    const url = buildMermaidLiveUrl(customMermaidCode, canvasTheme === "dark" ? "dark" : "default");
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#0B0D11] text-slate-100 font-sans select-none">
      {/* ======================================================== */}
      {/* 1. TOP STUDIO HEADER BAR                                  */}
      {/* ======================================================== */}
      <header className="h-14 border-b border-white/10 bg-[#0E121B] px-4 flex items-center justify-between shrink-0 z-30 shadow-md">
        {/* Left: Brand + Mindmap Title */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors border border-white/10"
            title="Return to Knowvia Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white tracking-wide">
                  Knowvia Studio
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Pro Engine
                </span>
              </div>
              <h1 className="text-xs text-slate-300 truncate max-w-[280px] sm:max-w-[420px]">
                {mindMapData?.title || "Interactive Concept Mind Map"}
              </h1>
            </div>
          </div>

          {mindMapData?.nodes && (
            <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono bg-white/[0.04] border border-white/10 text-slate-400">
              {mindMapData.nodes.length} Nodes
            </span>
          )}
        </div>

        {/* Center: 3 Primary Visualization Modes */}
        <div className="hidden lg:flex items-center p-1 bg-black/40 border border-white/10 rounded-xl">
          <button
            onClick={() => setVisualMode("notebooklm")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === "notebooklm"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>01 NotebookLM Tree</span>
          </button>

          <button
            onClick={() => setVisualMode("edrawmind")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === "edrawmind"
                ? "bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>02 EdrawMind Rainbow</span>
          </button>

          <button
            onClick={() => setVisualMode("mermaid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === "mermaid"
                ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/30"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>03 Mermaid.js Live</span>
          </button>
        </div>

        {/* Right: Actions Toolbar */}
        <div className="flex items-center gap-1.5">
          {/* Theme Toggle */}
          <button
            onClick={() => setCanvasTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/10"
            title={`Switch to ${canvasTheme === "dark" ? "Archival White / Light" : "Dark"} Canvas`}
          >
            {canvasTheme === "dark" ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-indigo-400" />}
          </button>

          {/* Toggle Mermaid Drawer */}
          {visualMode === "mermaid" && (
            <button
              onClick={() => setIsMermaidDrawerOpen(!isMermaidDrawerOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isMermaidDrawerOpen
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                  : "bg-white/[0.04] text-slate-300 border-white/10 hover:bg-white/[0.08]"
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editor</span>
            </button>
          )}

          {/* Show summaries toggle in NotebookLM mode */}
          {visualMode === "notebooklm" && (
            <button
              onClick={() => setShowSummariesOnPills(!showSummariesOnPills)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                showSummariesOnPills
                  ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                  : "bg-white/[0.04] text-slate-400 border-white/10"
              }`}
              title="Toggle inline concept summary text inside node pills"
            >
              Summaries
            </button>
          )}

          {/* Collapse presets */}
          <button
            onClick={expandAll}
            className="hidden sm:inline-flex px-2 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/10"
          >
            Expand
          </button>
          <button
            onClick={collapseToLevel2}
            className="hidden md:inline-flex px-2 py-1.5 rounded-lg text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/10"
          >
            Level 2
          </button>

          {/* Export SVG */}
          <button
            onClick={handleExportSVG}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/10 flex items-center gap-1"
            title="Download crisp SVG Vector diagram"
          >
            <Download className="w-3.5 h-3.5 text-indigo-400" />
            <span>SVG</span>
          </button>

          {/* Export PNG */}
          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/10 flex items-center gap-1"
            title="Download 2x Retina PNG image"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>PNG</span>
          </button>

          {/* Export PDF */}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/10 flex items-center gap-1"
            title="Download Landscape PDF"
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDF</span>
          </button>

          {/* Open in Mermaid.live */}
          <button
            onClick={openMermaidLive}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-sm flex items-center gap-1.5"
            title="Open in official Mermaid.live online editor"
          >
            <span>Mermaid.live</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Secondary Mobile Switcher Bar */}
      <div className="lg:hidden flex items-center justify-around p-2 bg-[#0E121B] border-b border-white/10 shrink-0">
        <button
          onClick={() => setVisualMode("notebooklm")}
          className={`px-3 py-1 text-xs rounded-lg ${visualMode === "notebooklm" ? "bg-indigo-600 text-white" : "text-slate-400"}`}
        >
          NotebookLM
        </button>
        <button
          onClick={() => setVisualMode("edrawmind")}
          className={`px-3 py-1 text-xs rounded-lg ${visualMode === "edrawmind" ? "bg-amber-600 text-white" : "text-slate-400"}`}
        >
          EdrawMind Rainbow
        </button>
        <button
          onClick={() => setVisualMode("mermaid")}
          className={`px-3 py-1 text-xs rounded-lg ${visualMode === "mermaid" ? "bg-cyan-600 text-white" : "text-slate-400"}`}
        >
          Mermaid Studio
        </button>
      </div>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE CANVAS                                  */}
      {/* ======================================================== */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex">
        {/* Left Mermaid Live Drawer */}
        {visualMode === "mermaid" && isMermaidDrawerOpen && (
          <aside className="w-96 h-full bg-[#0E131F]/95 border-r border-white/10 backdrop-blur-md flex flex-col z-20 shadow-2xl animate-in slide-in-from-left duration-200 shrink-0">
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Mermaid Source Code
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopyMermaid}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/[0.08]"
                  title="Copy code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={handleDownloadMMD}
                  className="p-1 rounded text-slate-300 hover:text-white hover:bg-white/[0.08]"
                  title="Download .mmd file"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Sub-mode selector */}
            <div className="p-2 border-b border-white/10 flex items-center gap-1 bg-black/20">
              <button
                onClick={() => setMermaidSubMode("mindmap")}
                className={`flex-1 py-1 rounded text-[11px] font-medium text-center ${
                  mermaidSubMode === "mindmap" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Radial
              </button>
              <button
                onClick={() => setMermaidSubMode("flowchart_lr")}
                className={`flex-1 py-1 rounded text-[11px] font-medium text-center ${
                  mermaidSubMode === "flowchart_lr" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Tree (LR)
              </button>
              <button
                onClick={() => setMermaidSubMode("flowchart_td")}
                className={`flex-1 py-1 rounded text-[11px] font-medium text-center ${
                  mermaidSubMode === "flowchart_td" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Hierarchy (TD)
              </button>
            </div>

            <textarea
              value={customMermaidCode}
              onChange={(e) => setCustomMermaidCode(e.target.value)}
              className="flex-1 p-3 bg-transparent font-mono text-[11.5px] text-slate-200 resize-none focus:outline-none focus:ring-1 focus:ring-cyan-500/50 leading-relaxed"
              spellCheck={false}
            />

            {mermaidError && (
              <div className="p-2.5 bg-red-950/60 border-t border-red-500/30 text-red-300 text-[11px]">
                <p className="font-semibold">Syntax error:</p>
                <p className="font-mono mt-0.5 truncate">{mermaidError}</p>
              </div>
            )}
          </aside>
        )}

        {/* Interactive Infinite Canvas Container */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          style={{
            backgroundColor: canvasTheme === "light" ? "#F8FAFC" : "#0B0D11",
            cursor: isPanning ? "grabbing" : "grab",
          }}
          className="relative flex-1 w-full h-full overflow-hidden transition-colors duration-200"
        >
          {/* Subtle Grid Pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.25]"
            style={{
              backgroundImage:
                canvasTheme === "light"
                  ? "radial-gradient(#94A3B8 1px, transparent 1px)"
                  : "radial-gradient(#334155 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* SVG Diagram Canvas for NotebookLM and EdrawMind */}
          {visualMode !== "mermaid" && (
            <svg
              ref={svgRef}
              className="w-full h-full absolute inset-0 overflow-visible"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
              }}
            >
              <defs>
                <filter id="studio-glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <filter id="studio-node-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
                </filter>
              </defs>

              {/* 1. EDGES */}
              <g className="edges-layer">
                {positionedEdges.map((edge) => (
                  <path
                    key={edge.id}
                    d={edge.path}
                    fill="none"
                    stroke={edge.color}
                    strokeWidth={edge.isUnderlineEdge ? 2 : 2.5}
                    strokeOpacity={canvasTheme === "light" ? 0.95 : 0.8}
                    strokeLinecap="round"
                  />
                ))}
              </g>

              {/* 2. NODES */}
              <g className="nodes-layer">
                {positionedNodes.map((node) => {
                  const isRoot = node.direction === "center" || node.level === 0;
                  const isMainBranch = node.level === 1;
                  const isSelected = selectedNode?.id === node.id;
                  const hasKids = node.childrenIds.length > 0;

                  // Render Mode: EdrawMind Detailed Academic
                  if (visualMode === "edrawmind") {
                    if (isRoot) {
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            width={node.width}
                            height={node.height}
                            rx={12}
                            fill="#1E293B"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            filter="url(#studio-node-shadow)"
                          />
                          {node.wrappedLabel.map((line, i) => (
                            <text
                              key={i}
                              x={node.width / 2}
                              y={24 + i * 20}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={13}
                              fontWeight="bold"
                            >
                              {line}
                            </text>
                          ))}
                        </g>
                      );
                    }

                    if (isMainBranch) {
                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                          }}
                          className="cursor-pointer"
                        >
                          <rect
                            width={node.width}
                            height={node.height}
                            rx={node.height / 2}
                            fill={node.color}
                            stroke={isSelected ? "#FFFFFF" : node.color}
                            strokeWidth={isSelected ? 3 : 1}
                            filter="url(#studio-node-shadow)"
                          />
                          {node.wrappedLabel.map((line, i) => (
                            <text
                              key={i}
                              x={node.width / 2}
                              y={node.height / 2 + 5 + (i - (node.wrappedLabel.length - 1) / 2) * 16}
                              textAnchor="middle"
                              fill="#FFFFFF"
                              fontSize={12}
                              fontWeight="600"
                            >
                              {line}
                            </text>
                          ))}

                          {/* Collapse button */}
                          {hasKids && (
                            <circle
                              cx={node.direction === "right" ? node.width : 0}
                              cy={node.height / 2}
                              r={8}
                              fill="#FFFFFF"
                              stroke={node.color}
                              strokeWidth={2}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse(node.id);
                              }}
                              className="cursor-pointer hover:scale-125 transition-transform"
                            />
                          )}
                        </g>
                      );
                    }

                    // Level 2+ EdrawMind Underline Node with full academic summary
                    const isRight = node.direction === "right";
                    return (
                      <g
                        key={node.id}
                        transform={`translate(${node.x}, ${node.y})`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedNode(node);
                        }}
                        className="cursor-pointer group"
                      >
                        {/* Background hover card */}
                        <rect
                          width={node.width}
                          height={node.height}
                          rx={6}
                          fill={canvasTheme === "light" ? "rgba(255,255,255,0.85)" : "#131826"}
                          stroke={isSelected ? node.color : "transparent"}
                          strokeWidth={2}
                          filter="url(#studio-node-shadow)"
                        />

                        {/* EdrawMind Signature Bottom Underline in branch color */}
                        <line
                          x1={0}
                          y1={node.height}
                          x2={node.width}
                          y2={node.height}
                          stroke={node.color}
                          strokeWidth={2.5}
                        />

                        {/* Title text */}
                        {node.wrappedLabel.map((line, i) => (
                          <text
                            key={i}
                            x={12}
                            y={18 + i * 18}
                            fill={canvasTheme === "light" ? "#0F172A" : "#F8FAFC"}
                            fontSize={11.5}
                            fontWeight="bold"
                          >
                            {line}
                          </text>
                        ))}

                        {/* Full academic summary sentence */}
                        {node.wrappedSummary.map((line, i) => (
                          <text
                            key={`s-${i}`}
                            x={12}
                            y={18 + node.wrappedLabel.length * 18 + 4 + i * 14}
                            fill={canvasTheme === "light" ? "#475569" : "#94A3B8"}
                            fontSize={10}
                            fontStyle="italic"
                          >
                            {line}
                          </text>
                        ))}

                        {/* Collapse Port */}
                        {hasKids && (
                          <g
                            transform={`translate(${isRight ? node.width : 0}, ${node.height / 2})`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCollapse(node.id);
                            }}
                            className="hover:scale-125 transition-transform"
                          >
                            <circle r={6.5} fill={node.color} />
                            <text
                              textAnchor="middle"
                              y={3}
                              fill="#FFFFFF"
                              fontSize={9}
                              fontWeight="bold"
                            >
                              {node.isExpanded ? "−" : "+"}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  }

                  // Default Mode: NotebookLM Left-to-Right Pill Nodes
                  const isLeaf = !hasKids;
                  const pillFill = isRoot
                    ? "#1E2235"
                    : isLeaf
                    ? canvasTheme === "light"
                      ? "#ECFDF5"
                      : "#162D24"
                    : canvasTheme === "light"
                    ? "#EEF2FF"
                    : "#22273D";

                  const pillStroke = isSelected
                    ? "#38BDF8"
                    : isRoot
                    ? "#6366F1"
                    : isLeaf
                    ? canvasTheme === "light"
                      ? "#10B981"
                      : "#2F5E49"
                    : canvasTheme === "light"
                    ? "#818CF8"
                    : "#3E4668";

                  const textCol = isRoot
                    ? "#FFFFFF"
                    : isLeaf
                    ? canvasTheme === "light"
                      ? "#065F46"
                      : "#6EE7B7"
                    : canvasTheme === "light"
                    ? "#1E1B4B"
                    : "#E2E8F0";

                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedNode(node);
                      }}
                      className="cursor-pointer group"
                    >
                      <rect
                        width={node.width}
                        height={node.height}
                        rx={node.wrappedSummary.length > 0 ? 12 : node.height / 2}
                        fill={pillFill}
                        stroke={pillStroke}
                        strokeWidth={isSelected ? 2.5 : 1.5}
                        filter="url(#studio-node-shadow)"
                      />

                      {/* Status indicator dot */}
                      <circle
                        cx={14}
                        cy={node.wrappedSummary.length > 0 ? 16 : node.height / 2}
                        r={2.5}
                        fill={pillStroke}
                      />

                      {/* Label Lines */}
                      {node.wrappedLabel.map((line, i) => (
                        <text
                          key={i}
                          x={24}
                          y={
                            node.wrappedSummary.length > 0
                              ? 18 + i * 16
                              : node.height / 2 + 4 + (i - (node.wrappedLabel.length - 1) / 2) * 15
                          }
                          fill={textCol}
                          fontSize={11.5}
                          fontWeight={node.level <= 1 ? "600" : "500"}
                        >
                          {line}
                        </text>
                      ))}

                      {/* Summary Lines in NotebookLM pill */}
                      {node.wrappedSummary.map((line, i) => (
                        <text
                          key={`sub-${i}`}
                          x={24}
                          y={20 + node.wrappedLabel.length * 16 + 4 + i * 13}
                          fill={canvasTheme === "light" ? "#64748B" : "#94A3B8"}
                          fontSize={9.5}
                        >
                          {line}
                        </text>
                      ))}

                      {/* Expand / Collapse Port */}
                      {hasKids && (
                        <g
                          transform={`translate(${node.width}, ${node.height / 2})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleCollapse(node.id);
                          }}
                          className="hover:scale-125 transition-transform"
                        >
                          <circle
                            r={7.5}
                            fill={canvasTheme === "light" ? "#FFFFFF" : "#1A1E2E"}
                            stroke={pillStroke}
                            strokeWidth={1.5}
                          />
                          <text
                            textAnchor="middle"
                            y={3}
                            fill={canvasTheme === "light" ? "#334155" : "#CBD5E1"}
                            fontSize={9}
                            fontWeight="bold"
                          >
                            {node.isExpanded ? "−" : `+${node.childrenIds.length}`}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}

          {/* Mode 3: Mermaid Live Rendered Container */}
          {visualMode === "mermaid" && (
            <div
              ref={mermaidContainerRef}
              className="w-full h-full p-8 flex items-center justify-center overflow-auto"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
              dangerouslySetInnerHTML={{ __html: mermaidRenderedSvg }}
            />
          )}

          {/* Loading or Error Overlays */}
          {isLoading && (
            <div className="absolute inset-0 bg-[#0B0D11]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
              <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-xs font-semibold text-white">Loading Mind Map Studio...</p>
            </div>
          )}

          {loadError && (
            <div className="absolute inset-0 bg-[#0B0D11]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 p-6 text-center">
              <Info className="w-8 h-8 text-amber-400" />
              <p className="text-sm font-semibold text-white">{loadError}</p>
              <Link
                href="/"
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Return to Workspace
              </Link>
            </div>
          )}

          {/* ======================================================== */}
          {/* 3. BOTTOM-RIGHT ZOOM DOCK                                */}
          {/* ======================================================== */}
          <div className="absolute bottom-5 right-5 z-20 flex items-center gap-1.5 p-1.5 bg-[#0E121B]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
            <button
              onClick={() => setZoom((z) => Math.max(0.15, z * 0.85))}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-semibold px-2 text-slate-300 min-w-[50px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-[1px] h-5 bg-white/10 mx-1" />
            <button
              onClick={fitView}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors flex items-center gap-1 text-xs font-medium"
              title="Fit View"
            >
              <Maximize className="w-4 h-4" />
              <span className="hidden sm:inline">Fit</span>
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 40, y: 40 });
              }}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/[0.08] transition-colors"
              title="Reset Zoom"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* ======================================================== */}
          {/* 4. BOTTOM-LEFT CONCEPT INSPECTOR TOAST                   */}
          {/* ======================================================== */}
          {selectedNode && (
            <div className="absolute bottom-5 left-5 max-w-md z-20 p-4 bg-[#0E131F]/95 backdrop-blur-2xl border border-indigo-500/30 rounded-2xl shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Level {selectedNode.level}
                  </span>
                  <h4 className="text-xs font-bold text-white truncate max-w-[220px]">
                    {selectedNode.label}
                  </h4>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  ✕
                </button>
              </div>

              {selectedNode.page_numbers && selectedNode.page_numbers.length > 0 && (
                <p className="text-[10px] font-mono text-cyan-400 mt-1">
                  Grounding: Page {selectedNode.page_numbers.join(", ")}
                </p>
              )}

              <p className="text-xs text-slate-300 leading-relaxed mt-2 max-h-28 overflow-y-auto pr-1">
                {selectedNode.summary || "No specific detailed description provided for this concept."}
              </p>

              <div className="mt-3 flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                <button
                  onClick={() => {
                    const text = `${selectedNode.label}: ${selectedNode.summary || ""}`;
                    navigator.clipboard.writeText(text);
                  }}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>

                <button
                  onClick={() => {
                    // Navigate back to chat with focused query
                    router.push(`/?ask=${encodeURIComponent(`Explain "${selectedNode.label}" in detail based on the document.`)}`);
                  }}
                  className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 shadow-sm"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Ask in Chat</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MindMapStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="w-screen h-screen bg-[#0B0D11] flex items-center justify-center text-white">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
        </div>
      }
    >
      <StudioContent />
    </Suspense>
  );
}
