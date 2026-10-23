"use client";

import { useEffect, useState } from "react";
import { Icons } from "@/lib/icons";

export type ExportColumn = { key: string; label: string; width?: number };
export type ExportRow = Record<string, string | number>;
type Format = "pdf" | "xlsx" | "pptx" | "docx";

type Props = {
  title: string;
  subtitle: string;
  columns: ExportColumn[];
  rows: ExportRow[];
  buttonLabel?: string;
  captureSelector?: string;
};

export default function ExportDialog({ title, subtitle, columns, rows, buttonLabel = "Export report", captureSelector }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const [moduleId, setModuleId] = useState(title.toLowerCase().includes("fault") ? "01FTA" : title.toLowerCase().includes("block") ? "01RBD" : "01");
  const [project, setProject] = useState("GMRC");
  const [author, setAuthor] = useState("RAMS Engineering Team");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
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
    const diagram = await captureWorkspace();
    const document = new jsPDF({ orientation: diagram || columns.length > 7 ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
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
    if (diagram) {
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
    document.setFontSize(7);
    document.setTextColor(105, 120, 136);
    document.text("Controlled engineering document · Generated by RAMSport", 10, pageHeight - 6);
    document.save(`${safeName}.pdf`);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const metadata = [["Project", project], ["Prepared by", author], ["Issue date", dateLabel], ["Record count", rows.length]];
    const data = [["RAMSport", title], [subtitle], [], ...metadata, [], columns.map(column => column.label), ...rows.map(row => columns.map(column => row[column.key] ?? ""))];
    const sheet = XLSX.utils.aoa_to_sheet(data);
    sheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, columns.length - 1) } }, { s: { r: 1, c: 0 }, e: { r: 1, c: Math.max(0, columns.length - 1) } }];
    sheet["!cols"] = columns.map(column => ({ wch: column.width || Math.max(12, column.label.length + 3) }));
    sheet["!autofilter"] = { ref: `A8:${String.fromCharCode(64 + Math.min(columns.length, 26))}${8 + rows.length}` };
    sheet["!freeze"] = { xSplit: 0, ySplit: 8 };
    const control = XLSX.utils.aoa_to_sheet([["RAMSport — Report Control"], ...metadata, [], ["Standards context", "EN 50126 · IEC 61078 · IEC 61025"], ["Classification", "Engineering working document"]]);
    control["!cols"] = [{ wch: 24 }, { wch: 48 }];
    const book = XLSX.utils.book_new();
    book.Props = { Title: title, Subject: subtitle, Author: author, Company: "RAMSport", CreatedDate: generatedAt };
    XLSX.utils.book_append_sheet(book, sheet, "Engineering Data");
    XLSX.utils.book_append_sheet(book, control, "Document Control");
    XLSX.writeFile(book, `${safeName}.xlsx`, { compression: true });
  }

  async function exportPowerPoint() {
    const PptxGenJS = (await import("pptxgenjs")).default;
    const presentation = new PptxGenJS();
    presentation.layout = "LAYOUT_WIDE";
    presentation.author = author;
    presentation.company = "RAMSport";
    presentation.subject = subtitle;
    presentation.title = title;
    const slide = presentation.addSlide();
    slide.background = { color: "F4F7FA" };
    slide.addShape(presentation.ShapeType.rect, { x: 0, y: 0, w: 13.333, h: .72, fill: { color: "091526" }, line: { color: "091526" } });
    slide.addShape(presentation.ShapeType.rect, { x: 0, y: .72, w: 13.333, h: .05, fill: { color: "00A6BD" }, line: { color: "00A6BD" } });
    slide.addText("RAMSport", { x: .35, y: .13, w: 1.5, h: .25, color: "FFFFFF", fontFace: "Aptos", fontSize: 17, bold: true, margin: 0 });
    slide.addText(title, { x: 1.8, y: .14, w: 7.8, h: .3, color: "FFFFFF", fontFace: "Aptos", fontSize: 14, bold: true, margin: 0 });
    slide.addText(`${project} · ${dateLabel}`, { x: 9.7, y: .18, w: 3.2, h: .22, color: "AFC4D0", fontFace: "Aptos", fontSize: 8, align: "right", margin: 0 });
    const diagram = await captureWorkspace();
    if (diagram) {
      const dimensions = await imageDimensions(diagram);
      const area = { x: .35, y: 1.02, w: 12.63, h: 5.9 };
      const scale = Math.min(area.w / dimensions.width, area.h / dimensions.height);
      const width = dimensions.width * scale;
      const height = dimensions.height * scale;
      slide.addImage({ data: diagram, x: area.x + (area.w - width) / 2, y: area.y + (area.h - height) / 2, w: width, h: height });
    } else {
      const tableRows = [
        columns.map(column => ({ text: column.label, options: { bold: true, color: "FFFFFF", fill: { color: "103448" } } })),
        ...rows.slice(0, 18).map(row => columns.map(column => ({ text: String(row[column.key] ?? "") }))),
      ];
      slide.addTable(tableRows, { x: .35, y: 1.05, w: 12.63, h: 5.7, border: { pt: .5, color: "D9E1E8" }, fontFace: "Aptos", fontSize: 7, color: "263748", fill: { color: "FFFFFF" }, margin: .04 });
    }
    slide.addText("Generated by RAMSport · Diagram image can be moved, resized or annotated in PowerPoint.", { x: .35, y: 7.18, w: 12.5, h: .15, color: "718093", fontFace: "Aptos", fontSize: 7, margin: 0 });
    await presentation.writeFile({ fileName: `${safeName}.pptx` });
  }

  async function exportWord() {
    const { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } = await import("docx");
    const document = new Document({ creator: author, title, subject: subtitle, sections: [{ children: [
      new Paragraph({ children: [new TextRun({ text: "RAMSport", bold: true, color: "008A9E", size: 30 })] }),
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph({ text: subtitle }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ tableHeader: true, children: columns.map(column => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: column.label, bold: true })] })] })) }),
        ...rows.map(row => new TableRow({ children: columns.map(column => new TableCell({ children: [new Paragraph(String(row[column.key] ?? ""))] })) })),
      ] }),
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
    { id: "xlsx", label: "XLSX", description: "Structured editable engineering data" },
    { id: "pptx", label: "PPTX", description: captureSelector ? "Movable and resizable diagram image" : "Editable presentation table" },
    { id: "docx", label: "DOCX", description: "Editable Word engineering report" },
  ];

  return <>
    <button className="secondary-button" onClick={() => setOpen(true)}><Icons.upload/> {buttonLabel}</button>
    {open && <div className="export-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setOpen(false); }}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header><div><p className="eyebrow">DOCUMENT CONTROL</p><h2 id="export-title">Export professional report</h2><p>Create a clear engineering deliverable from the active diagram.</p></div><button className="dialog-close" onClick={() => setOpen(false)} aria-label="Close">×</button></header>
        <div className="export-dialog-body"><div className="export-main"><h3>Choose format</h3><div className="format-grid export-four">{formats.map(item => <button key={item.id} className={`${format === item.id ? "selected " : ""}${item.id === "xlsx" ? "excel" : item.id === "docx" ? "word" : item.id}`} onClick={() => setFormat(item.id)}><span>{item.label}</span><strong>{item.label} export</strong><small>{item.description}</small>{item.id === "pdf" && <i>Recommended</i>}</button>)}</div>
          <h3>Report details</h3><div className="export-fields"><label>Module / diagram ID<input value={moduleId} onChange={event => setModuleId(event.target.value)}/></label><label>Project code<input value={project} onChange={event => setProject(event.target.value)}/></label><label>Prepared by<input value={author} onChange={event => setAuthor(event.target.value)}/></label><label>Output file<input value={`${safeName}.${format}`} readOnly/></label></div>
        </div><aside className="export-preview"><div className="preview-page"><div className="preview-header"><b>RAMSport</b><span>{format.toUpperCase()} PREVIEW</span></div><h4>{title}</h4><p>{subtitle}</p><dl><div><dt>PROJECT</dt><dd>{project}</dd></div><div><dt>FILE</dt><dd>{safeName}.{format}</dd></div><div><dt>RECORDS</dt><dd>{rows.length}</dd></div></dl>{previewImage ? <img className="preview-diagram" src={previewImage} alt="Export diagram preview"/> : <div className="preview-table">{previewLoading ? <em>Rendering diagram preview…</em> : <><i/><i/><i/><i/><i/></>}</div>}<footer>{format === "pptx" ? "Diagram image only" : "Controlled engineering document"}</footer></div><span>Preview · {format.toUpperCase()}</span></aside></div>
        {error && <div className="export-error">{error}</div>}
        <footer className="dialog-footer"><div><Icons.shield/><span>The generated file includes document-control metadata.</span></div><button className="secondary-button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-button" onClick={generate} disabled={busy}>{busy ? "Generating…" : `Generate ${format.toUpperCase()}`}</button></footer>
      </section>
    </div>}
  </>;
}
