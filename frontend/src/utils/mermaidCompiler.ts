// frontend/src/utils/mermaidCompiler.ts
import { RawMindMapNode } from "./mindmapLayout";

export type MermaidSubMode = "mindmap" | "flowchart_lr" | "flowchart_td";

/**
 * Strips characters that crash Mermaid's parser (parentheses, brackets, quotes, colons, LaTeX)
 */
export function sanitizeMermaidText(raw: string, maxLen = 58): string {
  if (!raw) return "Concept";
  const cleaned = raw
    .replace(/\$\$[\s\S]*?\$\$/g, "") // remove block LaTeX
    .replace(/\$[^$]*\$/g, "")        // remove inline LaTeX
    .replace(/[\(\)\[\]\{\}"'`<>]/g, " ")
    .replace(/[:;|\\/#&]/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > maxLen ? cleaned.slice(0, maxLen).trim() + "..." : cleaned || "Concept";
}

export function compileNodesToMermaid(
  flatNodes: RawMindMapNode[],
  mode: MermaidSubMode
): string {
  if (!flatNodes || flatNodes.length === 0) {
    return "mindmap\n  root((No Data))";
  }

  const childrenMap = new Map<string, RawMindMapNode[]>();
  const nodeMap = new Map<string, RawMindMapNode>();
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

  if (!root) root = flatNodes[0];

  // Sub-mode 1: Radial Mindmap
  if (mode === "mindmap") {
    const lines: string[] = ["mindmap"];
    lines.push(`  root((${sanitizeMermaidText(root.label, 45)}))`);

    const walkMindmap = (parentId: string, indent: number) => {
      const kids = childrenMap.get(parentId) || [];
      const pad = "  ".repeat(indent);
      for (const k of kids) {
        lines.push(`${pad}${sanitizeMermaidText(k.label, 48)}`);
        walkMindmap(k.id, indent + 1);
      }
    };
    walkMindmap(root.id, 2);
    return lines.join("\n");
  }

  // Sub-mode 2 & 3: Flowchart LR or Flowchart TD with Branch Colors
  const dir = mode === "flowchart_lr" ? "LR" : "TD";
  const lines: string[] = [`flowchart ${dir}`];

  const safeId = (id: string) => "N_" + id.replace(/[^a-zA-Z0-9_]/g, "_");
  lines.push(`  ${safeId(root.id)}(["${sanitizeMermaidText(root.label, 50)}"])`);
  lines.push(`  style ${safeId(root.id)} fill:#1E293B,stroke:#3B82F6,stroke-width:2px,color:#F8FAFC`);

  const branchColors = [
    { fill: "#881337", stroke: "#F43F5E" },
    { fill: "#78350F", stroke: "#F59E0B" },
    { fill: "#064E3B", stroke: "#10B981" },
    { fill: "#1E3A8A", stroke: "#3B82F6" },
    { fill: "#581C87", stroke: "#A855F7" },
  ];

  const mainBranches = childrenMap.get(root.id) || [];
  mainBranches.forEach((branch, idx) => {
    const palette = branchColors[idx % branchColors.length];

    const walkFlow = (parent: RawMindMapNode, current: RawMindMapNode, depth: number) => {
      const pId = safeId(parent.id);
      const cId = safeId(current.id);
      const label = sanitizeMermaidText(current.label, 52);
      lines.push(`  ${pId} --> ${cId}["${label}"]`);
      if (depth === 1) {
        lines.push(
          `  style ${cId} fill:${palette.fill},stroke:${palette.stroke},stroke-width:2px,color:#FFFFFF`
        );
      } else {
        lines.push(
          `  style ${cId} fill:#0F172A,stroke:${palette.stroke},stroke-width:1.5px,color:#E2E8F0`
        );
      }
      const kids = childrenMap.get(current.id) || [];
      kids.forEach((k) => walkFlow(current, k, depth + 1));
    };

    walkFlow(root!, branch, 1);
  });

  return lines.join("\n");
}

/**
 * Builds an official Mermaid.live Editor URL using UTF-8 safe base64 state serialization
 */
export function buildMermaidLiveUrl(mermaidCode: string, theme: "dark" | "default" = "dark"): string {
  const state = {
    code: mermaidCode,
    mermaid: JSON.stringify({ theme }, null, 2),
    autoSync: true,
    updateDiagram: true,
  };
  const json = JSON.stringify(state);
  const base64 =
    typeof window !== "undefined"
      ? window.btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf-8").toString("base64");
  return `https://mermaid.live/edit#base64:${base64}`;
}
