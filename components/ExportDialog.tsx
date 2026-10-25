"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/lib/icons";

export type ExportColumn = { key: string; label: string; width?: number };
export type ExportRow = Record<string, string | number>;
export type ExportExplanation = { topic: string; description: string; formula: string };
type Format = "pdf" | "xlsx" | "pptx" | "docx";
type Orientation = "auto" | "portrait" | "landscape";
type VectorNode = { id: number; x: number; y: number; width: number; height: number; type: string; lines: string[]; label: string };
type VectorEdge = { from: number; to: number; points: { x: number; y: number }[] };
type VectorDiagram = { nodes: VectorNode[]; edges: VectorEdge[]; width: number; height: number; minX: number; minY: number };

type Props = {
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  buttonLabel?: string;
  captureSelector?: string;
  explanation?: ExportExplanation[];
};

export default function ExportDialog({ title, subtitle, columns, rows, buttonLabel = "Export report", captureSelector, explanation = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const [moduleId, setModuleId] = useState(title.toLowerCase().includes("fault") ? "01FTA" : title.toLowerCase().includes("block") ? "01RBD" : "01");
  const [project, setProject] = useState("GMRC");
  const [author, setAuthor] = useState("RAMS Engineering Team");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [orientation, setOrientation] = useState<Orientation>("auto");
  const [fitToPage, setFitToPage] = useState(true);
  const [includeExplanation, setIncludeExplanation] = useState(false);
  const generatedAt = new Date();
  const dateLabel = generatedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const safeName = `${moduleId.trim() || "01"}_${project.trim() || "RAMSport"}`.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, "_");

  useEffect(() => {
    if (!open || !captureSelector) { setPreviewImage(null); return; }
    let active = true;
    setPreviewLoading(true);
    captureWorkspace().then(image => { if (active) setPreviewImage(image); }).catch(() => { if (active) setPreviewImage(null); }).finally(() => { if (active) setPreviewLoading(false); });
    return () => { active = false; };
  }, [open, captureSelector]);

  async function captureWorkspace() {
    if (!captureSelector) return null;
    const element = document.querySelector<HTMLElement>(captureSelector);
    if (!element) return null;
    const { toPng } = await import("html-to-image");
    return toPng(element, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true, style: { backgroundImage: "none", backgroundColor: "#ffffff" } });
  }

  async function imageDimensions(dataUrl: string) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = reject;
      image.src = dataUrl;
    });
  }

  function escapeXml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

  function diagramSvg(vector: VectorDiagram) {
    const padding = 28, minX = vector.minX - padding, minY = vector.minY - padding;
    const width = vector.width + padding * 2, height = vector.height + padding * 2;
    const edges = vector.edges.map(edge => `<polyline points="${edge.points.map(point => `${point.x},${point.y}`).join(" ")}" fill="none" stroke="#305269" stroke-width="2.2" stroke-linejoin="round"/>`).join("");
    const nodes = vector.nodes.map(node => {
      const gate = node.type.startsWith("gate ") || node.type === "event basic";
      const shape = gate ? `<ellipse cx="${node.x + node.width / 2}" cy="${node.y + node.height / 2}" rx="${node.width / 2}" ry="${node.height / 2}" fill="#fff" stroke="#31566f" stroke-width="1.5"/>` : `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="3" fill="#fff" stroke="#31566f" stroke-width="1.5"/><path d="M${node.x} ${node.y + 31}H${node.x + node.width}" stroke="#c5d3dd"/>`;
      const text = node.lines.slice(0, 4).map((line, index) => `<text x="${node.x + node.width / 2}" y="${node.y + 20 + index * 22}" text-anchor="middle" font-family="Aptos,Arial,sans-serif" font-size="${index === 0 ? 13 : 11}" font-weight="${index === 0 ? 600 : 500}" fill="${index === 1 ? "#b42b34" : index === 2 ? "#087a8d" : index === 3 ? "#b85a19" : "#18384e"}">${escapeXml(line)}</text>`).join("");
      const label = node.label ? `<text x="${node.x + node.width / 2}" y="${node.y + node.height + 17}" text-anchor="middle" font-family="Aptos,Arial,sans-serif" font-size="12" font-weight="600" fill="#233f54">${escapeXml(node.label)}</text>` : "";
      return `<g>${shape}${text}${label}</g>`;
    }).join("");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}"><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#fff"/>${edges}${nodes}</svg>`;
  }

  function svgDataUrl(vector: VectorDiagram) { return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(diagramSvg(vector))))}`; }

  async function renderDiagramPng(vector: VectorDiagram, targetWidth = 1800) {
    const source = svgDataUrl(vector), ratio = vector.height / vector.width;
    const image = new Image(); image.src = source; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = targetWidth; canvas.height = Math.max(240, Math.round(targetWidth * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("The diagram canvas could not be created.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png", 1);
  }

  function dataUrlBytes(dataUrl: string) {
    const binary = atob(dataUrl.split(",")[1] ?? "");
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  function pathPoints(path: string) {
    const tokens = path.match(/[MLHV]|-?\d+(?:\.\d+)?/g) ?? [];
    const points: { x: number; y: number }[] = [];
    let index = 0, x = 0, y = 0, command = "";
    while (index < tokens.length) {
      if (/^[MLHV]$/.test(tokens[index])) command = tokens[index++];
      if (command === "M" || command === "L") { x = Number(tokens[index++]); y = Number(tokens[index++]); points.push({ x, y }); }
      else if (command === "H") { x = Number(tokens[index++]); points.push({ x, y }); }
      else if (command === "V") { y = Number(tokens[index++]); points.push({ x, y }); }
      else index += 1;
    }
    return points;
  }

  function collectVectorDiagram(): VectorDiagram | null {
    if (!captureSelector) return null;
    const canvas = document.querySelector<HTMLElement>(captureSelector); if (!canvas) return null;
    const nodes = [...canvas.querySelectorAll<HTMLElement>("[data-export-node]")].map(node => {
      const label = node.querySelector<HTMLElement>(".component-name")?.innerText.trim() ?? "";
      return { id: Number(node.dataset.exportId), x: node.offsetLeft, y: node.offsetTop, width: node.offsetWidth, height: node.offsetHeight, type: node.dataset.exportType ?? "block", lines: node.innerText.split("\n").map(line => line.trim()).filter(line => Boolean(line) && line !== label).slice(0, 5), label };
    });
    const edges = [...canvas.querySelectorAll<SVGPathElement>("[data-export-edge]")].map(path => ({ from: Number(path.dataset.exportFrom), to: Number(path.dataset.exportTo), points: pathPoints(path.getAttribute("d") ?? "") })).filter(edge => edge.points.length > 1);
    if (!nodes.length) return null;
    const allX = [...nodes.flatMap(node => [node.x, node.x + node.width]), ...edges.flatMap(edge => edge.points.map(point => point.x))];
    const allY = [...nodes.flatMap(node => [node.y, node.y + node.height + (node.label ? 22 : 0)]), ...edges.flatMap(edge => edge.points.map(point => point.y))];
    const minX = Math.min(...allX), minY = Math.min(...allY), maxX = Math.max(...allX), maxY = Math.max(...allY);
    return { nodes, edges, minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
  }

  function resolvedOrientation(diagram: VectorDiagram | null): "portrait" | "landscape" {
    if (orientation !== "auto") return orientation;
    if (!diagram || diagram.nodes.length <= 5) return "portrait";
    const portraitScale = Math.min(188 / diagram.width, 150 / diagram.height);
    const landscapeScale = Math.min(275 / diagram.width, 104 / diagram.height);
    return portraitScale >= landscapeScale * .78 ? "portrait" : "landscape";
  }

  function flowExplanation(diagram: VectorDiagram | null): ExportExplanation[] {
    if (!diagram) return [];
    const rowByReference = new Map(rows.map(row => [String(row.reference), row]));
    const nodeName = (id: number) => diagram.nodes.find(node => node.id === id)?.lines[0] ?? `Block ${id}`;
    return diagram.edges.map((edge, index) => {
      const from = nodeName(edge.from), to = nodeName(edge.to);
      const fromAvailability = Number(String(rowByReference.get(from)?.availability ?? "0").replace("%", "")) / 100;
      const toAvailability = Number(String(rowByReference.get(to)?.availability ?? "0").replace("%", "")) / 100;
      const output = fromAvailability && toAvailability ? fromAvailability * toAvailability : 0;
      return { topic: `Step ${index + 1}: ${from} to ${to}`, description: `${from} feeds ${to} through the drawn connection. The intermediate series result is ${output ? `${(output * 100).toFixed(6)}%` : "calculated from the registered values"}.`, formula: `A(${from}→${to}) = A(${from}) × A(${to})` };
    });
  }

  function completeExplanation(diagram: VectorDiagram | null = null) {
    const transferPages = rows.length > 8 ? [{ topic: "Transfer references", description: `Large fault tree continuation references T1–T${Math.ceil(rows.length / 8) - 1} are used when the diagram is divided across A4 pages. Each matching transfer reference continues the same logical branch.`, formula: "Transfer reference only — logic is unchanged" }] : [];
    return [...flowExplanation(diagram), ...explanation, ...transferPages];
  }

  async function generate() {
    setBusy(true);
    setError("");
    try {
      if (format === "pdf") await exportPdf();
      if (format === "xlsx") await exportExcel();
      if (format === "pptx") await exportPowerPoint();
      if (format === "docx") await exportWord();
      setOpen(false);
    } catch (reason) {
      console.error(reason);
      setError("The export could not be generated. Check the active diagram and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function exportPdf() {
    const { jsPDF } = await import("jspdf");
    const vector = collectVectorDiagram();
    const diagram = vector ? null : await captureWorkspace();
    const document = new jsPDF({ orientation: resolvedOrientation(vector), unit: "mm", format: "a4", compress: true });
    const pageWidth = document.internal.pageSize.getWidth();
    const pageHeight = document.internal.pageSize.getHeight();
    document.setFillColor(9, 21, 38);
    document.rect(0, 0, pageWidth, 28, "F");
    document.setFillColor(0, 166, 189);
    document.rect(0, 28, pageWidth, 2, "F");
    document.setTextColor(255);
    document.setFont("helvetica", "bold");
    document.setFontSize(16);
    document.text("RAMSport", 12, 12);
    document.setFontSize(12);
    document.text(title, 12, 22);
    document.setFont("helvetica", "normal");
    document.setFontSize(7);
    document.text(`${project}  |  ${author}  |  ${dateLabel}`, pageWidth - 12, 20, { align: "right" });
    let tableStart = 37;
    if (vector) {
      const availableWidth = pageWidth - 22, availableHeight = pageHeight - 112;
      const scale = Math.min(availableWidth / vector.width, availableHeight / vector.height, .25);
      const offsetX = 11 + (availableWidth - vector.width * scale) / 2;
      const offsetY = 36;
      document.setDrawColor(48, 82, 105); document.setLineWidth(.45);
      for (const edge of vector.edges) for (let index = 1; index < edge.points.length; index += 1) {
        const from = edge.points[index - 1], to = edge.points[index];
        document.line(offsetX + (from.x - vector.minX) * scale, offsetY + (from.y - vector.minY) * scale, offsetX + (to.x - vector.minX) * scale, offsetY + (to.y - vector.minY) * scale);
      }
      for (const node of vector.nodes) {
        const x = offsetX + (node.x - vector.minX) * scale, y = offsetY + (node.y - vector.minY) * scale, width = node.width * scale, height = node.height * scale;
        document.setFillColor(255, 255, 255); document.setDrawColor(49, 86, 111);
        if (node.type === "event basic") document.circle(x + width / 2, y + height / 2, Math.min(width, height) / 2, "FD");
        else if (node.type.startsWith("gate ")) document.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, "FD");
        else document.roundedRect(x, y, width, height, 1.2, 1.2, "FD");
        document.setTextColor(25, 55, 74); document.setFontSize(Math.max(7, Math.min(10, height * 1.45)));
        node.lines.slice(0, 4).forEach((line, index) => document.text(line.slice(0, 38), x + width / 2, y + 4 + index * 3.5, { align: "center", maxWidth: Math.max(8, width - 3) }));
        if (node.label) { document.setFont("helvetica", "bold"); document.setFontSize(Math.max(7, Math.min(9, height * 1.2))); document.text(node.label.slice(0, 48), x + width / 2, y + height + 4, { align: "center", maxWidth: Math.max(12, width + 8) }); document.setFont("helvetica", "normal"); }
      }
      tableStart = Math.min(pageHeight - 55, offsetY + vector.height * scale + 7);
      const { default: autoTable } = await import("jspdf-autotable");
      autoTable(document, { startY: tableStart, head: [columns.map(column => column.label)], body: rows.map(row => columns.map(column => String(row[column.key] ?? ""))), theme: "grid", styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [218, 225, 232], lineWidth: .2, textColor: [34, 51, 68] }, headStyles: { fillColor: [16, 52, 72], textColor: [255, 255, 255], fontStyle: "bold" } });
    } else if (diagram) {
      const dimensions = await imageDimensions(diagram);
      const availableWidth = pageWidth - 20;
      const availableHeight = pageHeight - 105;
      const scale = Math.min(availableWidth / dimensions.width, availableHeight / dimensions.height);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      document.addImage(diagram, "PNG", (pageWidth - width) / 2, 35, width, height, undefined, "FAST");
      const { default: autoTable } = await import("jspdf-autotable");
      autoTable(document, { startY: 39 + height, head: [columns.map(column => column.label)], body: rows.map(row => columns.map(column => String(row[column.key] ?? ""))), theme: "grid", styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [218, 225, 232], lineWidth: .2, textColor: [34, 51, 68] }, headStyles: { fillColor: [16, 52, 72], textColor: [255, 255, 255], fontStyle: "bold" } });
    } else {
      const { default: autoTable } = await import("jspdf-autotable");
      autoTable(document, {
        startY: 37,
        head: [columns.map(column => column.label)],
        body: rows.map(row => columns.map(column => String(row[column.key] ?? ""))),
        theme: "grid",
        styles: { fontSize: columns.length > 8 ? 6 : 7.5, cellPadding: 2, lineColor: [218, 225, 232], lineWidth: .2, textColor: [34, 51, 68], overflow: "linebreak" },
        headStyles: { fillColor: [16, 52, 72], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 248, 250] },
      });
    }
    if (includeExplanation && completeExplanation(vector).length) {
      document.addPage("a4", "portrait");
      document.setTextColor(19, 48, 67); document.setFont("helvetica", "bold"); document.setFontSize(15); document.text("Method and formula reference", 14, 20);
      const { default: autoTable } = await import("jspdf-autotable");
      autoTable(document, { startY: 28, head: [["Flow step", "Calculation explanation", "Formula"]], body: completeExplanation(vector).map(item => [item.topic, item.description, item.formula]), theme: "grid", styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" }, headStyles: { fillColor: [16, 52, 72], textColor: [255, 255, 255] }, columnStyles: { 0: { cellWidth: 42 }, 1: { cellWidth: 93 }, 2: { cellWidth: 46 } } });
    }
    document.setFontSize(7);
    document.setTextColor(105, 120, 136);
    document.text("Controlled engineering document · Generated by RAMSport", 10, pageHeight - 6);
    document.save(`${safeName}.pdf`);
  }

  async function exportExcel() {
    const vector = collectVectorDiagram();
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = author; workbook.company = "RAMSport"; workbook.title = title; workbook.subject = subtitle; workbook.created = generatedAt;
    const sheet = workbook.addWorksheet("RBD Report", { pageSetup: { paperSize: 9, orientation: resolvedOrientation(vector), fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: .3, right: .3, top: .4, bottom: .4, header: .15, footer: .15 } } });
    const lastColumn = Math.max(1, columns.length);
    sheet.mergeCells(1, 1, 1, lastColumn); sheet.getCell(1, 1).value = `RAMSport · ${title}`;
    sheet.mergeCells(2, 1, 2, lastColumn); sheet.getCell(2, 1).value = `${project} · ${author} · ${dateLabel}`;
    sheet.getRow(1).height = 28; sheet.getRow(2).height = 20;
    sheet.getCell(1, 1).font = { name: "Aptos Display", size: 17, bold: true, color: { argb: "FFFFFFFF" } }; sheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF091526" } };
    sheet.getCell(2, 1).font = { name: "Aptos", size: 9, color: { argb: "FF31566F" } };
    let tableStart = 6;
    if (vector) {
      const diagramPng = await renderDiagramPng(vector, 2000);
      const imageId = workbook.addImage({ base64: diagramPng, extension: "png" });
      const imageWidth = 1120, imageHeight = Math.min(620, Math.max(260, Math.round(imageWidth * vector.height / vector.width)));
      sheet.addImage(imageId, { tl: { col: 0, row: 3 }, ext: { width: imageWidth, height: imageHeight }, editAs: "oneCell" });
      tableStart = 5 + Math.ceil(imageHeight / 20);
      for (let row = 4; row < tableStart; row += 1) sheet.getRow(row).height = 15;
    }
    const headingRow = sheet.getRow(tableStart); columns.forEach((column, index) => { const cell = headingRow.getCell(index + 1); cell.value = column.label; cell.font = { name: "Aptos", size: 9, bold: true, color: { argb: "FFFFFFFF" } }; cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF103448" } }; cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }; cell.border = { bottom: { style: "thin", color: { argb: "FFCBD7E0" } } }; });
    headingRow.height = 28;
    rows.forEach((row, rowIndex) => { const excelRow = sheet.getRow(tableStart + rowIndex + 1); columns.forEach((column, columnIndex) => { const cell = excelRow.getCell(columnIndex + 1); cell.value = row[column.key] ?? ""; cell.font = { name: "Aptos", size: 9, color: { argb: "FF263748" } }; cell.alignment = { vertical: "middle", wrapText: true }; cell.border = { bottom: { style: "hair", color: { argb: "FFD9E1E8" } } }; }); excelRow.height = 22; });
    columns.forEach((column, index) => { sheet.getColumn(index + 1).width = Math.max(15, Math.min(32, (column.width ?? 18) * .75)); });
    if (includeExplanation) {
      const steps = completeExplanation(vector), start = tableStart + rows.length + 3;
      sheet.mergeCells(start, 1, start, lastColumn); sheet.getCell(start, 1).value = "Calculation flow"; sheet.getCell(start, 1).font = { bold: true, size: 12, color: { argb: "FF17394F" } };
      steps.forEach((item, index) => { const row = sheet.getRow(start + index + 1); row.getCell(1).value = item.topic; row.getCell(2).value = item.description; row.getCell(3).value = item.formula; row.height = 34; });
    }
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeName}.xlsx`);
  }

  async function exportPowerPoint() {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const vector = collectVectorDiagram();
    const presentation = new PptxGenJS();
    presentation.layout = "LAYOUT_WIDE";
    const page = { width: 13.333, height: 7.5 };
    presentation.author = author;
    presentation.company = "RAMSport";
    presentation.subject = subtitle;
    presentation.title = title;
    const slide = presentation.addSlide();
    slide.background = { color: "F4F7FA" };
    slide.addShape(presentation.ShapeType.rect, { x: 0, y: 0, w: page.width, h: .72, fill: { color: "091526" }, line: { color: "091526" } });
    slide.addShape(presentation.ShapeType.rect, { x: 0, y: .72, w: page.width, h: .05, fill: { color: "00A6BD" }, line: { color: "00A6BD" } });
    slide.addText("RAMSport", { x: .35, y: .13, w: 1.5, h: .25, color: "FFFFFF", fontFace: "Aptos", fontSize: 17, bold: true, margin: 0 });
    slide.addText(title, { x: 1.8, y: .14, w: Math.max(3.2, page.width - 4.9), h: .3, color: "FFFFFF", fontFace: "Aptos", fontSize: 14, bold: true, margin: 0 });
    slide.addText(`${project} · ${dateLabel}`, { x: page.width - 3.1, y: .18, w: 2.75, h: .22, color: "AFC4D0", fontFace: "Aptos", fontSize: 8, align: "right", margin: 0 });
    const diagram = vector ? null : await captureWorkspace();
    if (vector) {
      const area = { x: .35, y: 1.02, w: page.width - .7, h: page.height - 1.7 };
      const scale = Math.min(area.w / vector.width, area.h / vector.height);
      const offsetX = area.x + (area.w - vector.width * scale) / 2, offsetY = area.y + (area.h - vector.height * scale) / 2;
      for (const [edgeIndex, edge] of vector.edges.entries()) {
        const from = edge.points[0], to = edge.points.at(-1)!;
        const fromX = offsetX + (from.x - vector.minX) * scale, fromY = offsetY + (from.y - vector.minY) * scale;
        const toX = offsetX + (to.x - vector.minX) * scale, toY = offsetY + (to.y - vector.minY) * scale;
        const connectorShape = edge.points.length > 2 ? "bentConnector3" : presentation.ShapeType.line;
        slide.addShape(connectorShape as typeof presentation.ShapeType.line, { objectName: `RBD Connector ${edgeIndex + 1}`, x: Math.min(fromX, toX), y: Math.min(fromY, toY), w: Math.max(.001, Math.abs(toX - fromX)), h: Math.max(.001, Math.abs(toY - fromY)), line: { color: "305269", width: 1.4 }, fill: { color: "FFFFFF", transparency: 100 } });
      }
      for (const [nodeIndex, node] of vector.nodes.entries()) {
        const x = offsetX + (node.x - vector.minX) * scale, y = offsetY + (node.y - vector.minY) * scale, w = node.width * scale, h = node.height * scale;
        const shape = node.type === "event basic" || node.type.startsWith("gate ") ? presentation.ShapeType.ellipse : presentation.ShapeType.roundRect;
        slide.addShape(shape, { objectName: `RBD Block ${nodeIndex + 1}`, x, y, w, h, fill: { color: "FFFFFF" }, line: { color: "31566F", width: 1.3 } });
        slide.addText(node.lines.slice(0, 4).join("\n"), { objectName: `RBD Block Text ${nodeIndex + 1}`, x: x + .03, y: y + .03, w: Math.max(.1, w - .06), h: Math.max(.1, h - .06), fontFace: "Aptos", fontSize: Math.max(8, Math.min(11, h * 15)), color: "19374A", align: "center", valign: "middle", margin: .02, fit: "shrink" });
        if (node.label) slide.addText(node.label, { x: x - .08, y: y + h + .03, w: w + .16, h: .24, fontFace: "Aptos", fontSize: Math.max(8, Math.min(10, h * 13)), bold: true, color: "233F54", align: "center", margin: 0, fit: "shrink" });
      }
    } else if (diagram) {
      const dimensions = await imageDimensions(diagram);
      const area = { x: .35, y: 1.02, w: page.width - .7, h: page.height - 1.7 };
      const scale = Math.min(area.w / dimensions.width, area.h / dimensions.height);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      slide.addImage({ data: diagram, x: area.x + (area.w - width) / 2, y: area.y + (area.h - height) / 2, w: width, h: height });
    } else {
      const tableRows = [
        columns.map(column => ({ text: column.label, options: { bold: true, color: "FFFFFF", fill: { color: "103448" } } })),
        ...rows.slice(0, 18).map(row => columns.map(column => ({ text: String(row[column.key] ?? "") }))),
      ];
      slide.addTable(tableRows, { x: .35, y: 1.05, w: page.width - .7, h: page.height - 1.8, border: { pt: .5, color: "D9E1E8" }, fontFace: "Aptos", fontSize: 8, color: "263748", fill: { color: "FFFFFF" }, margin: .04 });
    }
    slide.addText(vector ? "Generated by RAMSport - diagram blocks, labels and connectors are editable PowerPoint objects." : "Generated by RAMSport - diagram can be moved, resized or annotated.", { x: .35, y: page.height - .28, w: page.width - .7, h: .15, color: "718093", fontFace: "Aptos", fontSize: 7, margin: 0 });
    if (includeExplanation && completeExplanation(vector).length) {
      const referenceSlide = presentation.addSlide(); referenceSlide.background = { color: "FFFFFF" };
      referenceSlide.addText("Method and Formula Reference", { x: .5, y: .35, w: 12.2, h: .4, fontFace: "Aptos", fontSize: 20, bold: true, color: "17394F", margin: 0 });
      const referenceRows = [
        ["Topic", "Definition", "Formula"].map(text => ({ text, options: { bold: true, color: "FFFFFF", fill: { color: "103448" } } })),
        ...completeExplanation(vector).map(item => [item.topic, item.description, item.formula].map(text => ({ text }))),
      ];
      referenceSlide.addTable(referenceRows, { x: .5, y: 1, w: page.width - 1, border: { pt: .6, color: "CBD7E0" }, fontFace: "Aptos", fontSize: 9, color: "263748", fill: { color: "FFFFFF" }, margin: .08 });
    }
    await presentation.writeFile({ fileName: `${safeName}.pptx` });
  }

  async function exportWord() {
    const { AlignmentType, Document, HeadingLevel, ImageRun, Packer, PageOrientation, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
    const vector = collectVectorDiagram();
    const diagramImage = vector ? await renderDiagramPng(vector, 2400) : await captureWorkspace();
    const outputOrientation = resolvedOrientation(vector);
    const imageWidth = outputOrientation === "portrait" ? 620 : 880;
    const imageHeight = vector ? Math.min(outputOrientation === "portrait" ? 700 : 470, Math.round(imageWidth * vector.height / vector.width)) : Math.round(imageWidth * .6);
    const explanationChildren = includeExplanation && completeExplanation(vector).length ? [
      new Paragraph({ text: "Calculation Flow and Formula Reference", heading: HeadingLevel.HEADING_1 }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ tableHeader: true, children: ["Flow step", "Calculation explanation", "Formula"].map(value => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: value, bold: true })] })] })) }),
        ...completeExplanation(vector).map(item => new TableRow({ children: [item.topic, item.description, item.formula].map(value => new TableCell({ children: [new Paragraph(value)] })) })),
      ] }),
    ] : [];
    const diagramRun = diagramImage ? new ImageRun(vector ? { data: svgDataUrl(vector), type: "svg", fallback: { data: dataUrlBytes(diagramImage), type: "png" }, transformation: { width: imageWidth, height: Math.max(120, imageHeight) } } : { data: dataUrlBytes(diagramImage), type: "png", transformation: { width: imageWidth, height: Math.max(120, imageHeight) } }) : null;
    const diagramChildren = diagramRun ? [new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [new TableCell({ children: [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 180, after: 180 }, children: [diagramRun] })] })] })] })] : [];
    const document = new Document({ creator: author, title, subject: subtitle, sections: [{ properties: { page: { size: { orientation: outputOrientation === "portrait" ? PageOrientation.PORTRAIT : PageOrientation.LANDSCAPE } } }, children: [
      new Paragraph({ children: [new TextRun({ text: "RAMSport", bold: true, color: "008A9E", size: 30 })] }),
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: subtitle }),
      ...diagramChildren,
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ tableHeader: true, children: columns.map(column => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: column.label, bold: true })] })] })) }),
        ...rows.map(row => new TableRow({ children: columns.map(column => new TableCell({ children: [new Paragraph(String(row[column.key] ?? ""))] })) })),
      ] }),
      ...explanationChildren,
    ] }] });
    downloadBlob(await Packer.toBlob(document), `${safeName}.docx`);
  }

  function downloadBlob(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const formats: { id: Format; label: string; description: string }[] = [
    { id: "pdf", label: "PDF", description: captureSelector ? "High-resolution fitted diagram" : "Controlled tabular report" },
    { id: "xlsx", label: "XLSX", description: "One sheet: diagram followed by results" },
    { id: "pptx", label: "PPTX", description: captureSelector ? "Editable blocks and native connectors" : "Editable presentation table" },
    { id: "docx", label: "DOCX", description: "Sharp vector diagram and results table" },
  ];
  const outputPageLabel = format === "pptx" ? "Standard widescreen (16:9)" : format === "xlsx" ? "Single worksheet" : "A4";

  return <>
    <button className="secondary-button" onClick={() => setOpen(true)}><Icons.upload/> {buttonLabel}</button>
    {open && <div className="export-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header><div><p className="eyebrow">DOCUMENT CONTROL</p><h2 id="export-title">Export professional report</h2><p>Create a clear engineering deliverable from the active diagram.</p></div><button className="dialog-close" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
        <div className="export-dialog-body"><div className="export-main"><h3>Choose format</h3><div className="format-grid export-four">{formats.map(item => <button key={item.id} className={`${format === item.id ? "selected " : ""}${item.id === "xlsx" ? "excel" : item.id === "docx" ? "word" : item.id}`} onClick={() => setFormat(item.id)}><span>{item.label}</span><strong>{item.label} export</strong><small>{item.description}</small>{item.id === "pdf" && <i>Recommended</i>}</button>)}</div>
          <h3>Report details</h3><div className="export-fields"><label>Module / diagram ID<input value={moduleId} onChange={event => setModuleId(event.target.value)}/></label><label>Project code<input value={project} onChange={event => setProject(event.target.value)}/></label><label>Prepared by<input value={author} onChange={event => setAuthor(event.target.value)}/></label><label>Output file<input value={`${safeName}.${format}`} readOnly/></label></div>
          <h3>Page output</h3><div className="export-options"><label>Output layout<select value={outputPageLabel} disabled><option>{outputPageLabel}</option></select></label>{format !== "pptx" && <label>Orientation<select value={orientation} onChange={event => setOrientation(event.target.value as Orientation)}><option value="auto">Automatic</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>}<label className="export-check"><input type="checkbox" checked={fitToPage} onChange={event => setFitToPage(event.target.checked)}/><span><b>Compact fit to output</b><small>Reduce the complete diagram proportionally while keeping text readable.</small></span></label><label className="export-check"><input type="checkbox" checked={includeExplanation} onChange={event => setIncludeExplanation(event.target.checked)}/><span><b>Export calculation flow</b><small>Add block-to-block steps, intermediate results and formula references.</small></span></label></div>
        </div><aside className="export-preview"><div className={`preview-page ${format === "pptx" || orientation === "landscape" ? "landscape" : ""}`}><div className="preview-header"><b>RAMSport</b><span>{format.toUpperCase()} PREVIEW</span></div><h4>{title}</h4><p>{subtitle}</p><dl><div><dt>PROJECT</dt><dd>{project}</dd></div><div><dt>OUTPUT</dt><dd>{outputPageLabel}{format !== "pptx" && ` · ${orientation === "auto" ? "Automatic" : orientation}`}</dd></div><div><dt>FIT</dt><dd>{fitToPage ? "Compact" : "Standard"}</dd></div><div><dt>RECORDS</dt><dd>{rows.length}</dd></div></dl>{previewImage ? <img className="preview-diagram" src={previewImage} alt="Export diagram preview"/> : <div className="preview-table">{previewLoading ? <em>Rendering diagram preview…</em> : <><i/><i/><i/><i/><i/></>}</div>}<footer>{includeExplanation ? "Diagram + calculation flow" : "Diagram and engineering data"}</footer></div><span>Preview · {outputPageLabel}</span></aside></div>
        {error && <div className="export-error">{error}</div>}
        <footer className="dialog-footer"><div><Icons.shield/><span>The generated file includes document-control metadata.</span></div><button className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" onClick={generate} disabled={busy}>{busy ? "Generating…" : `Generate ${format.toUpperCase()}`}</button></footer>
      </section>
    </div>}
  </>;
}
