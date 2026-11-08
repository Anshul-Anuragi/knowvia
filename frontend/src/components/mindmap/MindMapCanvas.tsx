"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Download,
  Trash2,
  MessageSquare,
  Sparkles,
  FileText,
  Loader2,
  RefreshCw,
  FolderPlus,
  FolderMinus,
} from "lucide-react";
import { useChat } from "@/context/ChatContext";
import { MindMapNode } from "@/types/api";
import { wrapTextLines } from "@/utils/mindmapLayout";
import { exportDiagramAsSVG, exportDiagramAsPNG, exportDiagramAsPDF } from "@/utils/mindmapExport";

interface MindMapCanvasProps {
  isFullscreen?: boolean;
}

interface LayoutNode extends MindMapNode {
  x: number;
  y: number;
  width: number;
  height: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  visibleChildrenCount: number;
  totalChildrenCount: number;
  wrappedLabel: string[];
}

export default function MindMapCanvas({ isFullscreen = false }: MindMapCanvasProps) {
  const {
    mindMapData,
    isMindMapLoading,
    selectedMindMapNode,
    setSelectedMindMapNode,
    expandMindMapNode,
    deleteMindMap,
    generateMindMap,
    sendMessage,
    isMindMapFullscreen,
    setIsMindMapFullscreen,
  } = useChat();

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pan & Zoom state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 40, y: 40 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Collapse state for branches
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState<boolean>(false);

  // Build tree & child mappings
  const { childrenMap, parentMap, nodeMap } = useMemo(() => {
    const cMap = new Map<string, MindMapNode[]>();
    const pMap = new Map<string, string>();
    const nMap = new Map<string, MindMapNode>();

    if (!mindMapData || !mindMapData.nodes) {
      return { childrenMap: cMap, parentMap: pMap, nodeMap: nMap };
    }

    mindMapData.nodes.forEach((node) => {
      nMap.set(node.id, node);
      if (node.parent_id) {
        pMap.set(node.id, node.parent_id);
        const list = cMap.get(node.parent_id) || [];
        list.push(node);
        cMap.set(node.parent_id, list);
      }
    });

    return { childrenMap: cMap, parentMap: pMap, nodeMap: nMap };
  }, [mindMapData]);

  // Smart initial collapse: in sidebar mode, keep Level >= 2 collapsed so it fits neatly;
  // in fullscreen mode, expand all for maximum rich visual overview.
  useEffect(() => {
    if (!mindMapData?.nodes || mindMapData.nodes.length === 0) return;

    if (!isFullscreen && mindMapData.nodes.length > 12) {
      const defaultCollapsed = new Set<string>();
      mindMapData.nodes.forEach((n) => {
        if (n.level >= 2 && childrenMap.has(n.id)) {
          defaultCollapsed.add(n.id);
        }
      });
      setCollapsedIds(defaultCollapsed);
    } else {
      setCollapsedIds(new Set());
    }
  }, [mindMapData?.id, mindMapData?.nodes, isFullscreen, childrenMap]);

  // Responsive Bottom-Up Tidy Tree Layout Algorithm
  const { layoutNodes, connections, treeBounds } = useMemo(() => {
    if (!mindMapData || !mindMapData.nodes || mindMapData.nodes.length === 0) {
      return {
        layoutNodes: [] as LayoutNode[],
        connections: [] as { id: string; x1: number; y1: number; x2: number; y2: number }[],
        treeBounds: { minX: 0, minY: 0, maxX: 800, maxY: 500 },
      };
    }

    const nodeHeight = isFullscreen ? 38 : 32;
    const startX = 30;

    // 1. Pre-calculate dynamic box widths per depth level so levels never collide
    const levelMaxWidth = new Map<number, number>();
    mindMapData.nodes.forEach((n) => {
      const lines = wrapTextLines(n.label, isFullscreen ? 32 : 24);
      const longest = Math.max(...lines.map((l) => l.length), 10);
      const w = Math.max(isFullscreen ? 180 : 160, Math.min(340, Math.round(longest * 7.6 + 44)));
      levelMaxWidth.set(n.level, Math.max(levelMaxWidth.get(n.level) || 0, w));
    });

    const levelXOffset = new Map<number, number>();
    let currentX = startX;
    for (let l = 0; l <= 6; l++) {
      levelXOffset.set(l, currentX);
      const maxW = levelMaxWidth.get(l) || 200;
      currentX += maxW + (isFullscreen ? 70 : 55);
    }

    let leafYCounter = 40;
    const computedMap = new Map<string, LayoutNode>();

    const rootNode =
      mindMapData.nodes.find((n) => n.id === "root" || !n.parent_id) ||
      mindMapData.nodes[0];

    // Post-order traversal to calculate Y coordinates bottom-up
    function layoutSubtree(node: MindMapNode): LayoutNode {
      const allChildren = childrenMap.get(node.id) || [];
      const hasChildren = allChildren.length > 0;
      const isCollapsed = collapsedIds.has(node.id);

      // Clean multi-line wrapping so ZERO labels are cut off with "..."
      const wrappedLabel = wrapTextLines(node.label, isFullscreen ? 32 : 24);
      const longestLine = Math.max(...wrappedLabel.map((l) => l.length), 10);
      const width = Math.max(
        isFullscreen ? 180 : 160,
        Math.min(340, Math.round(longestLine * 7.6 + 44))
      );
      const height = Math.max(nodeHeight, 14 + wrappedLabel.length * 16);
      const x = levelXOffset.get(node.level) || (startX + node.level * 220);

      let y = 0;
      let visibleChildren: LayoutNode[] = [];

      const rowHeight = height + (isFullscreen ? 20 : 14);

      if (!hasChildren || isCollapsed) {
        y = leafYCounter;
        leafYCounter += rowHeight;
      } else {
        visibleChildren = allChildren.map((child) => layoutSubtree(child));
        if (visibleChildren.length > 0) {
          const firstY = visibleChildren[0].y;
          const lastY = visibleChildren[visibleChildren.length - 1].y;
          y = (firstY + lastY) / 2;
        } else {
          y = leafYCounter;
          leafYCounter += rowHeight;
        }
      }

      const layoutItem: LayoutNode = {
        ...node,
        x,
        y,
        width,
        height,
        hasChildren,
        isCollapsed,
        visibleChildrenCount: visibleChildren.length,
        totalChildrenCount: allChildren.length,
        wrappedLabel,
      };

      computedMap.set(node.id, layoutItem);
      return layoutItem;
    }

    layoutSubtree(rootNode);

    const layoutList = Array.from(computedMap.values());

    // Generate Cubic Bézier connections
    const conns: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
    layoutList.forEach((parent) => {
      if (parent.hasChildren && !parent.isCollapsed) {
        const children = childrenMap.get(parent.id) || [];
        children.forEach((child) => {
          const childLayout = computedMap.get(child.id);
          if (childLayout) {
            conns.push({
              id: `${parent.id}->${child.id}`,
              x1: parent.x + parent.width,
              y1: parent.y + parent.height / 2,
              x2: childLayout.x,
              y2: childLayout.y + childLayout.height / 2,
            });
          }
        });
      }
    });

    // Compute precise bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    layoutList.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.width);
      maxY = Math.max(maxY, n.y + n.height);
    });

    return {
      layoutNodes: layoutList,
      connections: conns,
      treeBounds: {
        minX: minX === Infinity ? 0 : minX,
        minY: minY === Infinity ? 0 : minY,
        maxX: maxX === -Infinity ? 800 : maxX,
        maxY: maxY === -Infinity ? 500 : maxY,
      },
    };
  }, [mindMapData, childrenMap, collapsedIds, isFullscreen]);

  // Viewport Centering & Left-Anchor Helper (ensures Root node is NEVER cut off)
  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth <= 0 || clientHeight <= 0) return;

    const contentWidth = Math.max(100, treeBounds.maxX - treeBounds.minX);
    const contentHeight = Math.max(100, treeBounds.maxY - treeBounds.minY);

    const padding = isFullscreen ? 50 : 25;
    const availableWidth = Math.max(80, clientWidth - padding * 2);
    const availableHeight = Math.max(80, clientHeight - padding * 2);

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    const optimalZoom = Math.min(scaleX, scaleY);

    // Zoom limits: from 0.18 to 1.15
    const targetZoom = Math.min(1.15, Math.max(0.18, optimalZoom));

    // Anchor root node cleanly to left edge (30px) so it is NEVER cut off
    const panX = 30;
    const contentCenterY = (treeBounds.minY + treeBounds.maxY) / 2;
    const panY = Math.max(20, clientHeight / 2 - contentCenterY * targetZoom);

    setZoom(targetZoom);
    setPan({ x: panX, y: panY });
  }, [treeBounds, isFullscreen]);

  // Auto-fit on initial render, treeBounds update, or fullscreen change
  useEffect(() => {
    if (mindMapData?.nodes && mindMapData.nodes.length > 0) {
      fitToScreen();
    }
  }, [mindMapData?.id, mindMapData?.nodes, treeBounds, fitToScreen]);

  // ResizeObserver: auto-adjust whenever panel width is dragged or changed
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      fitToScreen();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [fitToScreen]);

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left click only
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(2.5, Math.max(0.15, prev * zoomFactor)));
  };

  // Toggle node collapse/expand
  const toggleNodeCollapse = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  const expandAll = () => {
    setCollapsedIds(new Set());
  };

  const collapseToLevel1 = () => {
    const newCollapsed = new Set<string>();
    mindMapData?.nodes.forEach((n) => {
      if (n.level >= 1 && childrenMap.has(n.id)) {
        newCollapsed.add(n.id);
      }
    });
    setCollapsedIds(newCollapsed);
  };

  const collapseToLevel2 = () => {
    const newCollapsed = new Set<string>();
    mindMapData?.nodes.forEach((n) => {
      if (n.level >= 2 && childrenMap.has(n.id)) {
        newCollapsed.add(n.id);
      }
    });
    setCollapsedIds(newCollapsed);
  };

  // Node styling matching exact NotebookLM depth palette
  const getNodeTheme = (level: number, isSelected: boolean) => {
    if (level === 0 || level === 1) {
      // Slate-Indigo (NotebookLM Root & Primary Pillar)
      return {
        fill: "#24293E",
        stroke: isSelected ? "#818CF8" : "#4A567D",
        strokeWidth: isSelected ? 2.5 : 1.2,
        textColor: "#F8FAFC",
        badgeBg: "rgba(129, 140, 248, 0.25)",
        badgeText: "#A5B4FC",
        glow: isSelected ? "drop-shadow(0 0 12px rgba(99, 102, 241, 0.6))" : "none",
      };
    } else if (level === 2) {
      // Deep Slate-Teal (NotebookLM Sub-Branches)
      return {
        fill: "#1A2634",
        stroke: isSelected ? "#38BDF8" : "#354C64",
        strokeWidth: isSelected ? 2.5 : 1.2,
        textColor: "#E2E8F0",
        badgeBg: "rgba(56, 189, 248, 0.25)",
        badgeText: "#7DD3FC",
        glow: isSelected ? "drop-shadow(0 0 12px rgba(56, 189, 248, 0.6))" : "none",
      };
    } else {
      // Signature NotebookLM Sage / Emerald Green (Level 3+ Leaf Nodes)
      return {
        fill: "#172E24",
        stroke: isSelected ? "#34D399" : "#285240",
        strokeWidth: isSelected ? 2.5 : 1.2,
        textColor: "#D1FAE5",
        badgeBg: "rgba(52, 211, 153, 0.25)",
        badgeText: "#6EE7B7",
        glow: isSelected ? "drop-shadow(0 0 12px rgba(52, 211, 153, 0.6))" : "none",
      };
    }
  };

  // Export Vector SVG
  const exportSVG = () => {
    if (!svgRef.current) return;
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    exportDiagramAsSVG(svgRef.current, `${title}.svg`);
  };

  // Export high-res Retina PNG
  const exportPNG = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    try {
      await exportDiagramAsPNG(svgRef.current, `${title}.png`, {
        theme: "dark",
        width: treeBounds.maxX + 120,
        height: treeBounds.maxY + 120,
      });
    } catch (err) {
      console.error("Export PNG failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Export high-res Landscape PDF
  const exportPDF = async () => {
    if (!svgRef.current) return;
    setIsExporting(true);
    const title = mindMapData?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "mindmap";
    try {
      await exportDiagramAsPDF(svgRef.current, `${title}.pdf`, {
        theme: "dark",
        width: treeBounds.maxX + 120,
        height: treeBounds.maxY + 120,
      });
    } catch (err) {
      console.error("Export PDF failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  // Open Dedicated Fullscreen Studio
  const openStudio = (popup = false) => {
    if (mindMapData && typeof window !== "undefined") {
      try {
        localStorage.setItem("knowvia_active_mindmap", JSON.stringify(mindMapData));
      } catch {}
    }
    const id = mindMapData?.id || "";
    const url = `/mindmap-studio${id ? `?id=${encodeURIComponent(id)}` : ""}`;
    if (popup) {
      window.open(url, "KnowviaMindMapStudio", "width=1440,height=900,menubar=no,toolbar=no,location=no,status=no");
    } else {
      window.open(url, "_blank");
    }
  };

  // One-Click "Ask in Chat" action
  const handleAskInChat = () => {
    if (!selectedMindMapNode) return;
    const parentId = parentMap.get(selectedMindMapNode.id);
    const parentNode = parentId ? nodeMap.get(parentId) : null;
    const parentContext = parentNode ? ` in the context of "${parentNode.label}"` : "";

    const question = `Discuss what the selected sources say about "${selectedMindMapNode.label}"${parentContext}. Provide concrete facts, citations, and practical insights.`;
    sendMessage(question);
    if (isMindMapFullscreen) {
      setIsMindMapFullscreen(false);
    }
  };

  const getCacheBadge = () => {
    if (!mindMapData) return null;
    if (mindMapData.cache_source === "redis") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          ⚡ Redis Cache
        </span>
      );
    } else if (mindMapData.cache_source === "postgres") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono">
          🗄️ Neon DB
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-[10px] font-mono">
          <Sparkles className="w-3 h-3 text-indigo-400" />
          ✦ Generated
        </span>
      );
    }
  };

  const totalNodesCount = mindMapData?.nodes?.length || 0;
  const visibleNodesCount = layoutNodes.length;

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className={`relative w-full h-full bg-[#0B0D11] overflow-hidden select-none cursor-grab active:cursor-grabbing ${
        isFullscreen ? "fixed inset-0 z-50 flex flex-col" : "flex flex-col"
      }`}
    >
      {/* Top Header Controls Bar */}
      <div className="z-30 px-3 py-2 bg-[#0B0D11]/90 backdrop-blur-xl border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
            <h3 className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-[200px]">
              {mindMapData?.title || "Concept Mind Map"}
            </h3>
          </div>
          {getCacheBadge()}
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            {visibleNodesCount === totalNodesCount
              ? `${totalNodesCount} nodes`
              : `${visibleNodesCount}/${totalNodesCount} nodes`}
          </span>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Zoom Controls */}
          <div className="flex items-center bg-white/[0.04] border border-white/10 rounded-lg p-0.5 mr-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(2.5, z * 1.15))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08]"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.15, z * 0.85))}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08]"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fitToScreen}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.08]"
              title="Fit Entire Mind Map to Screen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-400 font-mono px-1">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          {/* Expand / Collapse All */}
          <button
            onClick={expandAll}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10"
            title="Expand All Nodes (Full Tree)"
          >
            Expand All
          </button>
          <button
            onClick={collapseToLevel2}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 hidden md:inline-block"
            title="Collapse Leaf Nodes (Show Level 1 & 2)"
          >
            Level 2
          </button>
          <button
            onClick={collapseToLevel1}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 hidden lg:inline-block"
            title="Collapse Sub-branches (Show Pillars only)"
          >
            Pillars
          </button>

          {/* Regenerate Fresh */}
          <button
            onClick={() => generateMindMap(true)}
            disabled={isMindMapLoading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.08] border border-white/10"
            title="Force Regenerate Entire Mind Map"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isMindMapLoading ? "animate-spin text-indigo-400" : ""}`}
            />
          </button>

          {/* Save SVG */}
          <button
            onClick={exportSVG}
            disabled={isExporting}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 flex items-center gap-1"
            title="Download crisp Vector SVG"
          >
            <Download className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">SVG</span>
          </button>

          {/* Save PNG */}
          <button
            onClick={exportPNG}
            disabled={isExporting}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 flex items-center gap-1"
            title="Download Full Mind Map as High-Res PNG"
          >
            <Download className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">PNG</span>
          </button>

          {/* Save PDF */}
          <button
            onClick={exportPDF}
            disabled={isExporting}
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/10 flex items-center gap-1"
            title="Download Landscape PDF"
          >
            <FileText className="w-3 h-3 text-emerald-400" />
            <span className="hidden sm:inline">PDF</span>
          </button>

          {/* Delete Mind Map */}
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to delete this saved mind map?")) {
                deleteMindMap();
              }
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10"
            title="Delete Mind Map"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Dedicated Fullscreen Studio Launcher */}
          <div className="relative group/studio">
            <button
              onClick={() => openStudio(false)}
              className="p-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 shadow-sm flex items-center gap-1 transition-all"
              title="Open Standalone Mind Map Studio in New Tab"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <div className="absolute right-0 top-full mt-1 hidden group-hover/studio:flex flex-col bg-[#0F1424] border border-white/15 rounded-xl p-1 z-50 shadow-2xl min-w-[150px] animate-in fade-in duration-100">
              <button
                onClick={() => openStudio(false)}
                className="px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-200 hover:bg-white/[0.08] hover:text-white rounded-lg flex items-center justify-between"
              >
                <span>⛶ Open New Tab</span>
                <span className="text-[9px] text-indigo-400 font-mono">↗</span>
              </button>
              <button
                onClick={() => openStudio(true)}
                className="px-2.5 py-1.5 text-left text-[11px] font-medium text-slate-200 hover:bg-white/[0.08] hover:text-white rounded-lg flex items-center justify-between"
              >
                <span>🗔 Pop-out Window</span>
                <span className="text-[9px] text-cyan-400 font-mono">⧉</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Interactive SVG Canvas */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            transition: isPanning ? "none" : "transform 0.08s ease-out",
          }}
        >
          {/* Subtle Grid Pattern */}
          <defs>
            <pattern id="mindmap-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.75" fill="#1E2436" opacity="0.6" />
            </pattern>
          </defs>
          <rect
            x={-3000}
            y={-3000}
            width={treeBounds.maxX + 6000}
            height={treeBounds.maxY + 6000}
            fill="url(#mindmap-grid)"
          />

          {/* Render Cubic Bézier Connector Curves */}
          <g className="connections">
            {connections.map((c) => {
              const mx = (c.x1 + c.x2) / 2;
              const pathD = `M ${c.x1} ${c.y1} C ${mx} ${c.y1}, ${mx} ${c.y2}, ${c.x2} ${c.y2}`;
              return (
                <path
                  key={c.id}
                  d={pathD}
                  stroke="#475569"
                  strokeWidth="1.5"
                  strokeOpacity="0.75"
                  fill="none"
                />
              );
            })}
          </g>

          {/* Render Interactive Mind Map Nodes */}
          <g className="nodes">
            {layoutNodes.map((node) => {
              const isSelected = selectedMindMapNode?.id === node.id;
              const theme = getNodeTheme(node.level, isSelected);

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x}, ${node.y})`}
                  className="cursor-pointer group"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedMindMapNode(node);
                  }}
                  onDoubleClick={(e) => {
                    if (node.hasChildren) {
                      toggleNodeCollapse(node.id, e);
                    }
                  }}
                >
                  {/* Outer Pill Body */}
                  <rect
                    width={node.width}
                    height={node.height}
                    rx={node.height / 2}
                    fill={theme.fill}
                    stroke={theme.stroke}
                    strokeWidth={theme.strokeWidth}
                    style={{ filter: theme.glow }}
                    className="transition-all duration-150 group-hover:brightness-110"
                  />

                  {/* Level / Status dot */}
                  <circle
                    cx={14}
                    cy={node.height / 2}
                    r={2.5}
                    fill={theme.badgeText}
                    opacity={0.85}
                  />

                  {/* Node Label Text with clean multi-line wrapping (zero clipping) */}
                  {node.wrappedLabel.map((line, i) => (
                    <text
                      key={i}
                      x={22}
                      y={node.height / 2 + 4 + (i - (node.wrappedLabel.length - 1) / 2) * 15}
                      fill={theme.textColor}
                      fontSize={isFullscreen ? 11.5 : 10.5}
                      fontWeight={node.level <= 1 ? "600" : "500"}
                      fontFamily="ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont"
                      style={{ userSelect: "none" }}
                    >
                      {line}
                    </text>
                  ))}

                  {/* Circular Branch Collapse / Expand Port (Right Edge) */}
                  {node.hasChildren && (
                    <g
                      transform={`translate(${node.width}, ${node.height / 2})`}
                      onClick={(e) => toggleNodeCollapse(node.id, e)}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <title>
                        {node.isCollapsed
                          ? `Click to expand ${node.totalChildrenCount} sub-topics`
                          : "Click to collapse branch"}
                      </title>
                      <circle
                        r={8}
                        fill={node.isCollapsed ? "#312E81" : "#1E2436"}
                        stroke={node.isCollapsed ? "#818CF8" : "#64748B"}
                        strokeWidth={1.5}
                        className="hover:stroke-indigo-400"
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fill={node.isCollapsed ? "#C7D2FE" : "#94A3B8"}
                        fontSize={8.5}
                        fontWeight="bold"
                        fontFamily="monospace"
                        style={{ userSelect: "none" }}
                      >
                        {node.isCollapsed ? `+${node.totalChildrenCount}` : `−`}
                      </text>
                    </g>
                  )}

                  {/* Leaf Node Lazy Expand Action Port (+) */}
                  {!node.hasChildren && node.can_expand_more && (
                    <g
                      transform={`translate(${node.width}, ${node.height / 2})`}
                      onClick={(e) => {
                        e.stopPropagation();
                        expandMindMapNode(node.id);
                      }}
                      className="cursor-pointer hover:scale-125 transition-transform"
                    >
                      <title>Deepen this concept with RAG retrieval</title>
                      <circle
                        r={7.5}
                        fill="#162D24"
                        stroke="#2F5E49"
                        strokeWidth={1.5}
                        className="hover:stroke-emerald-400"
                      />
                      <text
                        x={0}
                        y={3}
                        textAnchor="middle"
                        fill="#6EE7B7"
                        fontSize={9}
                        fontWeight="bold"
                        fontFamily="monospace"
                        style={{ userSelect: "none" }}
                      >
                        +
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Loading Overlay */}
        {isMindMapLoading && (
          <div className="absolute inset-0 bg-[#0B0D11]/60 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-40 animate-in fade-in">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            <div className="text-center">
              <p className="text-xs font-semibold text-white">Synthesizing Mind Map...</p>
              <p className="text-[11px] text-slate-400">Two-tier Redis Cloud & Neon DB synchronization</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Concept Inspector Bar */}
      {selectedMindMapNode && (
        <div className="z-30 p-3 bg-[#0B1026]/95 backdrop-blur-2xl border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xl animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Level {selectedMindMapNode.level}
              </span>
              <h4 className="text-xs font-bold text-white truncate">
                {selectedMindMapNode.label}
              </h4>
              {selectedMindMapNode.page_numbers && selectedMindMapNode.page_numbers.length > 0 && (
                <span className="text-[10px] font-mono text-slate-400">
                  Page {selectedMindMapNode.page_numbers.join(", ")}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-300 leading-snug line-clamp-2">
              {selectedMindMapNode.summary || "No specific summary provided for this concept."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Toggle collapse for selected node if it has children */}
            {childrenMap.has(selectedMindMapNode.id) && (
              <button
                onClick={() => toggleNodeCollapse(selectedMindMapNode.id)}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/10 flex items-center gap-1.5 transition-all"
              >
                {collapsedIds.has(selectedMindMapNode.id) ? (
                  <>
                    <FolderPlus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Expand Branch</span>
                  </>
                ) : (
                  <>
                    <FolderMinus className="w-3.5 h-3.5 text-slate-400" />
                    <span>Collapse Branch</span>
                  </>
                )}
              </button>
            )}

            {/* Lazy Deepen Button if leaf and expand is enabled */}
            {selectedMindMapNode.can_expand_more && (
              <button
                onClick={() => expandMindMapNode(selectedMindMapNode.id)}
                disabled={isMindMapLoading}
                className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Deepen Branch</span>
              </button>
            )}

            {/* One-Click Ask in Chat */}
            <button
              onClick={handleAskInChat}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white shadow-md shadow-indigo-600/30 flex items-center gap-1.5 transition-all active:scale-95"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>💬 Ask in Chat</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
