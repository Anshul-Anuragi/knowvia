// frontend/src/utils/mindmapLayout.ts

export interface RawMindMapNode {
  id: string;
  parent_id: string | null;
  label: string;
  summary?: string;
  level: number;
  page_numbers?: number[];
  source_ids?: string[];
  can_expand_more?: boolean;
}

export interface PositionedNode extends RawMindMapNode {
  x: number;
  y: number;
  width: number;
  height: number;
  direction: "right" | "left" | "center";
  color: string;
  childrenIds: string[];
  isExpanded: boolean;
  wrappedLabel: string[];
  wrappedSummary: string[];
}

export interface PositionedEdge {
  id: string;
  sourceId: string;
  targetId: string;
  path: string;
  color: string;
  isUnderlineEdge?: boolean;
}

export const EDRAWMIND_PALETTE = [
  "#E11D48", // 1. Crimson Red
  "#D97706", // 2. Amber Gold
  "#059669", // 3. Emerald Green
  "#2563EB", // 4. Royal Blue
  "#9333EA", // 5. Violet Purple
  "#0D9488", // 6. Teal
];

/**
 * Word-wraps text into lines of maxChars so SVG <tspan> elements never clip with "..."
 */
export function wrapTextLines(text: string, maxCharsPerLine: number): string[] {
  if (!text) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
    } else if ((current + " " + word).length <= maxCharsPerLine) {
      current += " " + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * STYLE 1: NotebookLM Left-to-Right Tidy Tree Layout (Zero Overlap, Zero "..." Truncation)
 */
export function computeNotebookLMLayout(
  flatNodes: RawMindMapNode[],
  collapsedIds: Set<string>,
  showSummaries = false
): { nodes: PositionedNode[]; edges: PositionedEdge[]; width: number; height: number } {
  const nodeMap = new Map<string, RawMindMapNode>();
  const childrenMap = new Map<string, RawMindMapNode[]>();

  flatNodes.forEach((n) => {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  });

  let root: RawMindMapNode | undefined;
  flatNodes.forEach((n) => {
    if (!n.parent_id || !nodeMap.has(n.parent_id)) {
      if (!root) root = n;
    } else {
      childrenMap.get(n.parent_id)?.push(n);
    }
  });

  if (!root) return { nodes: [], edges: [], width: 800, height: 600 };

  // Pre-calculate dynamic box dimensions based on wrapped text
  const dims = new Map<string, { w: number; h: number; labelLines: string[]; summaryLines: string[] }>();
  flatNodes.forEach((n) => {
    const labelLines = wrapTextLines(n.label, 32);
    const summaryLines = showSummaries && n.summary ? wrapTextLines(n.summary, 38).slice(0, 3) : [];
    const longestLine = Math.max(
      ...labelLines.map((l) => l.length),
      ...summaryLines.map((l) => l.length * 0.85),
      12
    );
    const w = Math.max(190, Math.min(340, Math.round(longestLine * 7.8 + 44)));
    const h = 24 + labelLines.length * 18 + (summaryLines.length > 0 ? summaryLines.length * 15 + 8 : 0);
    dims.set(n.id, { w, h, labelLines, summaryLines });
  });

  // Pass 1: Bottom-up subtree vertical span calculation
  const VERTICAL_GAP = 16;
  const subtreeSpan = new Map<string, number>();

  function calcSpan(nodeId: string): number {
    const d = dims.get(nodeId)!;
    const rawChildren = childrenMap.get(nodeId) || [];
    const isExpanded = !collapsedIds.has(nodeId);

    if (!isExpanded || rawChildren.length === 0) {
      subtreeSpan.set(nodeId, d.h + VERTICAL_GAP);
      return d.h + VERTICAL_GAP;
    }

    let total = 0;
    for (const child of rawChildren) {
      total += calcSpan(child.id);
    }
    const span = Math.max(d.h + VERTICAL_GAP, total);
    subtreeSpan.set(nodeId, span);
    return span;
  }

  calcSpan(root.id);

  // Pass 2: Top-down coordinate assignment
  const positioned: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];
  const HORIZONTAL_GAP = 95;

  function placeNode(nodeId: string, x: number, topY: number, branchColor: string, depth: number): number {
    const raw = nodeMap.get(nodeId)!;
    const d = dims.get(nodeId)!;
    const span = subtreeSpan.get(nodeId)!;
    const rawChildren = childrenMap.get(nodeId) || [];
    const isExpanded = !collapsedIds.has(nodeId);

    let centerY = topY + span / 2;

    if (isExpanded && rawChildren.length > 0) {
      let childTopY = topY;
      const childCenters: number[] = [];
      const nextX = x + d.w + HORIZONTAL_GAP;

      rawChildren.forEach((child, idx) => {
        const cColor = depth === 0 ? EDRAWMIND_PALETTE[idx % EDRAWMIND_PALETTE.length] : branchColor;
        const cCenter = placeNode(child.id, nextX, childTopY, cColor, depth + 1);
        childCenters.push(cCenter);
        childTopY += subtreeSpan.get(child.id)!;
      });

      // Exact midpoint of first and last child
      centerY = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;

      // Create smooth cubic Bezier edges from parent right port to child left edge
      const portX = x + d.w + 10;
      const portY = centerY;

      rawChildren.forEach((child, idx) => {
        const childCenterY = childCenters[idx];
        const midX = (portX + nextX) / 2;
        edges.push({
          id: `e-${nodeId}-${child.id}`,
          sourceId: nodeId,
          targetId: child.id,
          path: `M ${portX} ${portY} C ${midX} ${portY}, ${midX} ${childCenterY}, ${nextX} ${childCenterY}`,
          color: "#64748B",
        });
      });
    }

    positioned.push({
      ...raw,
      x,
      y: centerY - d.h / 2,
      width: d.w,
      height: d.h,
      direction: "right",
      color: branchColor,
      childrenIds: rawChildren.map((c) => c.id),
      isExpanded,
      wrappedLabel: d.labelLines,
      wrappedSummary: d.summaryLines,
    });

    return centerY;
  }

  placeNode(root.id, 60, 60, "#4F5B82", 0);

  const maxX = Math.max(...positioned.map((n) => n.x + n.width), 800) + 100;
  const maxY = Math.max(...positioned.map((n) => n.y + n.height), 600) + 100;

  return { nodes: positioned, edges, width: maxX, height: maxY };
}

/**
 * STYLE 2: EdrawMind Bilateral Center-Out Rainbow Academic Layout
 * Splits main branches Right & Left, cascades branch colors, and draws underline-style leaf nodes.
 */
export function computeEdrawMindBilateralLayout(
  flatNodes: RawMindMapNode[],
  collapsedIds: Set<string>
): { nodes: PositionedNode[]; edges: PositionedEdge[]; width: number; height: number } {
  const nodeMap = new Map<string, RawMindMapNode>();
  const childrenMap = new Map<string, RawMindMapNode[]>();

  flatNodes.forEach((n) => {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  });

  let root: RawMindMapNode | undefined;
  flatNodes.forEach((n) => {
    if (!n.parent_id || !nodeMap.has(n.parent_id)) {
      if (!root) root = n;
    } else {
      childrenMap.get(n.parent_id)?.push(n);
    }
  });

  if (!root) return { nodes: [], edges: [], width: 1200, height: 800 };

  // Compute node sizes (Leaf nodes include full academic summary text!)
  const dims = new Map<string, { w: number; h: number; labelLines: string[]; summaryLines: string[] }>();
  flatNodes.forEach((n) => {
    const isRoot = n.id === root!.id;
    const isMainBranch = n.parent_id === root!.id;
    const labelLines = wrapTextLines(n.label, isRoot ? 28 : 34);
    const summaryLines = !isRoot && !isMainBranch && n.summary ? wrapTextLines(n.summary, 44) : [];

    const maxChars = Math.max(
      ...labelLines.map((l) => l.length),
      ...summaryLines.map((l) => l.length * 0.82),
      14
    );
    const w = isRoot
      ? 260
      : Math.max(180, Math.min(360, Math.round(maxChars * 7.2 + 32)));
    const h =
      (isRoot ? 32 : 20) +
      labelLines.length * 18 +
      (summaryLines.length > 0 ? summaryLines.length * 14 + 8 : 0);

    dims.set(n.id, { w, h, labelLines, summaryLines });
  });

  const V_GAP = 18;
  const H_GAP = 85;
  const subtreeSpan = new Map<string, number>();

  function calcSpan(nodeId: string): number {
    const d = dims.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    const isExpanded = !collapsedIds.has(nodeId);
    if (!isExpanded || children.length === 0) {
      subtreeSpan.set(nodeId, d.h + V_GAP);
      return d.h + V_GAP;
    }
    const sum = children.reduce((acc, c) => acc + calcSpan(c.id), 0);
    const span = Math.max(d.h + V_GAP, sum);
    subtreeSpan.set(nodeId, span);
    return span;
  }

  calcSpan(root.id);

  const mainBranches = childrenMap.get(root.id) || [];
  const rightCount = Math.ceil(mainBranches.length / 2);
  const rightBranches = mainBranches.slice(0, rightCount);
  const leftBranches = mainBranches.slice(rightCount);

  const rightTotalSpan = rightBranches.reduce((acc, b) => acc + subtreeSpan.get(b.id)!, 0);
  const leftTotalSpan = leftBranches.reduce((acc, b) => acc + subtreeSpan.get(b.id)!, 0);
  const canvasHeight = Math.max(rightTotalSpan, leftTotalSpan, 700) + 160;
  const centerX = 1400;
  const centerY = canvasHeight / 2;

  const positioned: PositionedNode[] = [];
  const edges: PositionedEdge[] = [];

  const rootDim = dims.get(root.id)!;
  positioned.push({
    ...root,
    x: centerX - rootDim.w / 2,
    y: centerY - rootDim.h / 2,
    width: rootDim.w,
    height: rootDim.h,
    direction: "center",
    color: "#1E293B",
    childrenIds: mainBranches.map((b) => b.id),
    isExpanded: true,
    wrappedLabel: rootDim.labelLines,
    wrappedSummary: [],
  });

  function placeSubtree(
    nodeId: string,
    anchorX: number, // left edge if direction==="right", right edge if direction==="left"
    topY: number,
    dir: "right" | "left",
    color: string,
    depth: number
  ): number {
    const raw = nodeMap.get(nodeId)!;
    const d = dims.get(nodeId)!;
    const span = subtreeSpan.get(nodeId)!;
    const children = childrenMap.get(nodeId) || [];
    const isExpanded = !collapsedIds.has(nodeId);

    const boxX = dir === "right" ? anchorX : anchorX - d.w;
    let nodeCenterY = topY + span / 2;

    if (isExpanded && children.length > 0) {
      let cTop = topY;
      const cCenters: number[] = [];
      const nextAnchorX = dir === "right" ? boxX + d.w + H_GAP : boxX - H_GAP;

      for (const child of children) {
        const cCenter = placeSubtree(child.id, nextAnchorX, cTop, dir, color, depth + 1);
        cCenters.push(cCenter);
        cTop += subtreeSpan.get(child.id)!;
      }

      nodeCenterY = (cCenters[0] + cCenters[cCenters.length - 1]) / 2;

      // EdrawMind style: connect from parent's outer edge/underline to child's inner edge
      const startX = dir === "right" ? boxX + d.w : boxX;
      const startY = depth === 1 ? nodeCenterY : nodeCenterY + d.h / 2;

      children.forEach((child, i) => {
        const childD = dims.get(child.id)!;
        const cCenterY = cCenters[i];
        // Level 2+ nodes sit on an underline at their bottom edge
        const endY = cCenterY + childD.h / 2;
        const endX = nextAnchorX;
        const ctrlX = (startX + endX) / 2;

        edges.push({
          id: `edraw-${nodeId}-${child.id}`,
          sourceId: nodeId,
          targetId: child.id,
          path: `M ${startX} ${startY} C ${ctrlX} ${startY}, ${ctrlX} ${endY}, ${endX} ${endY}`,
          color,
          isUnderlineEdge: true,
        });
      });
    }

    positioned.push({
      ...raw,
      x: boxX,
      y: nodeCenterY - d.h / 2,
      width: d.w,
      height: d.h,
      direction: dir,
      color,
      childrenIds: children.map((c) => c.id),
      isExpanded,
      wrappedLabel: d.labelLines,
      wrappedSummary: d.summaryLines,
    });

    return nodeCenterY;
  }

  // Place Right Branches
  let rTop = centerY - rightTotalSpan / 2;
  rightBranches.forEach((b, idx) => {
    const color = EDRAWMIND_PALETTE[idx % EDRAWMIND_PALETTE.length];
    const bAnchorX = centerX + rootDim.w / 2 + H_GAP + 20;
    const bCenterY = placeSubtree(b.id, bAnchorX, rTop, "right", color, 1);
    rTop += subtreeSpan.get(b.id)!;

    const startX = centerX + rootDim.w / 2;
    const ctrlX = (startX + bAnchorX) / 2;
    edges.push({
      id: `root-${b.id}`,
      sourceId: root!.id,
      targetId: b.id,
      path: `M ${startX} ${centerY} C ${ctrlX} ${centerY}, ${ctrlX} ${bCenterY}, ${bAnchorX} ${bCenterY}`,
      color,
    });
  });

  // Place Left Branches
  let lTop = centerY - leftTotalSpan / 2;
  leftBranches.forEach((b, idx) => {
    const color = EDRAWMIND_PALETTE[(rightCount + idx) % EDRAWMIND_PALETTE.length];
    const bAnchorX = centerX - rootDim.w / 2 - H_GAP - 20;
    const bCenterY = placeSubtree(b.id, bAnchorX, lTop, "left", color, 1);
    lTop += subtreeSpan.get(b.id)!;

    const startX = centerX - rootDim.w / 2;
    const ctrlX = (startX + bAnchorX) / 2;
    edges.push({
      id: `root-${b.id}`,
      sourceId: root!.id,
      targetId: b.id,
      path: `M ${startX} ${centerY} C ${ctrlX} ${centerY}, ${ctrlX} ${bCenterY}, ${bAnchorX} ${bCenterY}`,
      color,
    });
  });

  return { nodes: positioned, edges, width: 2800, height: canvasHeight };
}

