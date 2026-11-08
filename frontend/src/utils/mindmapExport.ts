// frontend/src/utils/mindmapExport.ts
import jsPDF from "jspdf";

export interface ExportDiagramOptions {
  title?: string;
  theme?: "dark" | "light";
  width?: number;
  height?: number;
  scale?: number;
}

/**
 * Downloads raw crisp vector SVG file of the diagram
 */
export function exportDiagramAsSVG(
  svgElement: SVGSVGElement,
  filename = "knowvia-mindmap"
): void {
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgElement);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
    source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
  }

  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a high-resolution Retina 2x PNG of the diagram with background fill
 */
export async function exportDiagramAsPNG(
  svgElement: SVGSVGElement,
  filename = "knowvia-mindmap",
  options: ExportDiagramOptions = {}
): Promise<void> {
  const scale = options.scale || 2;
  const bg = options.theme === "light" ? "#F8FAFC" : "#0B0D11";

  // Use clone to measure unconstrained dimensions
  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.style.transform = "none";
  clone.setAttribute("width", "3600");
  clone.setAttribute("height", "2400");
  document.body.appendChild(clone);
  const bbox = clone.getBBox();
  document.body.removeChild(clone);

  const canvasWidth = options.width || Math.max(1200, Math.ceil(bbox.width + Math.max(0, bbox.x) + 120));
  const canvasHeight = options.height || Math.max(800, Math.ceil(bbox.height + Math.max(0, bbox.y) + 120));

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * scale;
  canvas.height = canvasHeight * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = url;
  });

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const imgData = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = imgData;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Downloads landscape vector/bitmap-embedded PDF of the diagram
 */
export async function exportDiagramAsPDF(
  svgElement: SVGSVGElement,
  filename = "knowvia-mindmap",
  options: ExportDiagramOptions = {}
): Promise<void> {
  const bg = options.theme === "light" ? "#F8FAFC" : "#0B0D11";

  const clone = svgElement.cloneNode(true) as SVGSVGElement;
  clone.style.transform = "none";
  clone.setAttribute("width", "3600");
  clone.setAttribute("height", "2400");
  document.body.appendChild(clone);
  const bbox = clone.getBBox();
  document.body.removeChild(clone);

  const canvasWidth = options.width || Math.max(1200, Math.ceil(bbox.width + Math.max(0, bbox.x) + 120));
  const canvasHeight = options.height || Math.max(800, Math.ceil(bbox.height + Math.max(0, bbox.y) + 120));

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth * 2;
  canvas.height = canvasHeight * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(2, 2);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = url;
  });

  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "px",
    format: [canvasWidth, canvasHeight],
  });

  pdf.addImage(imgData, "PNG", 0, 0, canvasWidth, canvasHeight);
  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

