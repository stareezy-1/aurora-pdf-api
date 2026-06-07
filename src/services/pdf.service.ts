import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { createCanvas } from "canvas";
import { renderHtmlToPdf } from "./pdf-engine.js";
import type { TextToPdfRequest, CompressConfig } from "../types/pdf.types.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "";

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
};

function resolveStandardFont(family: string): StandardFonts {
  const lower = family.toLowerCase();
  if (lower.includes("courier")) return StandardFonts.Courier;
  if (lower.includes("times")) return StandardFonts.TimesRoman;
  return StandardFonts.Helvetica;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16) / 255,
      parseInt(h[1] + h[1], 16) / 255,
      parseInt(h[2] + h[2], 16) / 255,
    ];
  }
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

export async function textToPdf(body: TextToPdfRequest): Promise<Uint8Array> {
  const {
    fontFamily = "Helvetica",
    fontSize = 11,
    lineSpacing = 1.4,
    marginTop = 50,
    marginRight = 50,
    marginBottom = 50,
    marginLeft = 50,
    pageSize = "A4",
    orientation = "portrait",
    textColor = "#000000",
    backgroundColor,
    headerText = "",
    footerText = "",
    showPageNumbers = false,
    alignment = "left",
  } = body.config ?? {};

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(resolveStandardFont(fontFamily));
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let [pageWidth, pageHeight] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
  if (orientation === "landscape") {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  const maxWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = fontSize * lineSpacing;
  const textRgb = hexToRgb(textColor);

  const totalPages = 1;
  let currentPageNum = 1;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);

  if (backgroundColor) {
    const bg = hexToRgb(backgroundColor);
    page.drawRectangle({
      x: 0, y: 0, width: pageWidth, height: pageHeight,
      color: rgb(bg[0], bg[1], bg[2]),
    });
  }

  let y = pageHeight - marginTop;

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    if (backgroundColor) {
      const bg = hexToRgb(backgroundColor);
      page.drawRectangle({
        x: 0, y: 0, width: pageWidth, height: pageHeight,
        color: rgb(bg[0], bg[1], bg[2]),
      });
    }
    y = pageHeight - marginTop;
    currentPageNum++;
  }

  function ensureSpace(needed: number) {
    if (y - needed < marginBottom) newPage();
  }

  function drawFooter() {
    if (footerText || showPageNumbers) {
      const text = showPageNumbers
        ? `${footerText}   ${currentPageNum}`
        : footerText;
      const w = regularFont.widthOfTextAtSize(text, 9);
      const x = (pageWidth - w) / 2;
      page.drawText(text, {
        x, y: marginBottom - 15, size: 9, font: regularFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  function drawHeader() {
    if (headerText) {
      const w = regularFont.widthOfTextAtSize(headerText, 9);
      page.drawText(headerText, {
        x: (pageWidth - w) / 2,
        y: pageHeight - marginTop + 8,
        size: 9,
        font: regularFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  function drawTextLine(line: string, align: string) {
    ensureSpace(lineHeight);
    const w = font.widthOfTextAtSize(line, fontSize);
    let x = marginLeft;
    if (align === "center") x = marginLeft + (maxWidth - w) / 2;
    else if (align === "right") x = marginLeft + maxWidth - w;

    page.drawText(line, {
      x, y, size: fontSize, font,
      color: rgb(textRgb[0], textRgb[1], textRgb[2]),
    });
    y -= lineHeight;
  }

  function wrapAndDraw(rawLine: string, align: string) {
    if (rawLine === "") {
      y -= lineHeight * 0.5;
      return;
    }
    const words = rawLine.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
        drawTextLine(current, align);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) drawTextLine(current, align);
  }

  const lines = body.text.split("\n");
  for (const line of lines) {
    wrapAndDraw(line, alignment);
  }

  drawHeader();
  drawFooter();

  return pdfDoc.save();
}

export async function htmlToPdf(
  html: string,
  options: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
  } = {},
): Promise<Uint8Array> {
  return renderHtmlToPdf(html, options);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function inlineMarkdown(str: string): string {
  return str
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function parsePipeTable(lines: string[], startIdx: number): { html: string; endIdx: number } | null {
  if (startIdx + 1 >= lines.length) return null;

  const headerLine = lines[startIdx].trim();
  if (!headerLine.startsWith("|") || !headerLine.endsWith("|")) return null;

  const separatorLine = lines[startIdx + 1].trim();
  const sepRe = /^\|[\s:-]+\|/;
  if (!sepRe.test(separatorLine)) return null;

  const headers = headerLine
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);

  const alignments = separatorLine
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s.startsWith(":") && s.endsWith(":")) return "center";
      if (s.endsWith(":")) return "right";
      return "left";
    });

  const rows: string[][] = [];
  let endIdx = startIdx + 2;

  while (endIdx < lines.length) {
    const rowLine = lines[endIdx].trim();
    if (!rowLine.startsWith("|") || !rowLine.endsWith("|")) break;
    const cells = rowLine.split("|").map((s) => s.trim()).filter(Boolean);
    rows.push(cells);
    endIdx++;
  }

  let html = "<table style='width:100%;border-collapse:collapse;'>\n<thead>\n<tr>";
  for (let i = 0; i < headers.length; i++) {
    const align = alignments[i] || "left";
    html += `<th style="text-align:${align};padding:8px 10px;">${inlineMarkdown(headers[i])}</th>`;
  }
  html += "</tr>\n</thead>\n<tbody>\n";

  for (const row of rows) {
    html += "<tr>";
    for (let i = 0; i < row.length; i++) {
      const align = alignments[i] || "left";
      html += `<td style="text-align:${align};padding:6px 10px;">${inlineMarkdown(row[i])}</td>`;
    }
    html += "</tr>\n";
  }

  html += "</tbody>\n</table>";

  return { html, endIdx };
}

function parseMarkdownToHtml(markdown: string, theme: string): string {
  const themeStyles: Record<string, string> = {
    light: "background:#fff;color:#333;font-family:Helvetica,Arial,sans-serif;",
    dark: "background:#1e1e1e;color:#d4d4d4;font-family:Helvetica,Arial,sans-serif;",
    github:
      "background:#fff;color:#24292e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;",
  };

  const lines = markdown.split("\n");
  const htmlLines: string[] = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let inList = false;
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];

    if (rawLine.trimStart().startsWith("```")) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      if (inCodeBlock) {
        htmlLines.push("</code></pre>");
        inCodeBlock = false;
        codeBlockLang = "";
      } else {
        codeBlockLang = rawLine.trimStart().slice(3).trim();
        htmlLines.push(`<pre><code${codeBlockLang ? ` class="language-${escapeHtml(codeBlockLang)}"` : ""}>`);
        inCodeBlock = true;
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      htmlLines.push(escapeHtml(rawLine));
      i++;
      continue;
    }

    const tableResult = parsePipeTable(lines, i);
    if (tableResult) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(tableResult.html);
      i = tableResult.endIdx;
      continue;
    }

    const h1 = rawLine.match(/^#\s+(.*)/);
    const h2 = rawLine.match(/^##\s+(.*)/);
    const h3 = rawLine.match(/^###\s+(.*)/);
    const h4 = rawLine.match(/^####\s+(.*)/);
    const h5 = rawLine.match(/^#####\s+(.*)/);
    const h6 = rawLine.match(/^######\s+(.*)/);

    if (inList && !rawLine.match(/^[-*+]\s/) && !rawLine.match(/^\d+\.\s/)) {
      htmlLines.push("</ul>");
      inList = false;
    }

    if (h1) { htmlLines.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); i++; continue; }
    if (h2) { htmlLines.push(`<h2>${inlineMarkdown(h2[1])}</h2>`); i++; continue; }
    if (h3) { htmlLines.push(`<h3>${inlineMarkdown(h3[1])}</h3>`); i++; continue; }
    if (h4) { htmlLines.push(`<h4>${inlineMarkdown(h4[1])}</h4>`); i++; continue; }
    if (h5) { htmlLines.push(`<h5>${inlineMarkdown(h5[1])}</h5>`); i++; continue; }
    if (h6) { htmlLines.push(`<h6>${inlineMarkdown(h6[1])}</h6>`); i++; continue; }

    if (rawLine.match(/^[-*_]{3,}\s*$/)) {
      htmlLines.push("<hr/>");
      i++;
      continue;
    }

    const uListMatch = rawLine.match(/^[-*+]\s+(.*)/);
    const oListMatch = rawLine.match(/^\d+\.\s+(.*)/);

    if (uListMatch || oListMatch) {
      if (!inList) { htmlLines.push("<ul>"); inList = true; }
      const content = (uListMatch || oListMatch)![1];
      htmlLines.push(`<li>${inlineMarkdown(content)}</li>`);
      i++;
      continue;
    }

    const bqMatch = rawLine.match(/^>\s?(.*)/);
    if (bqMatch) {
      if (inList) { htmlLines.push("</ul>"); inList = false; }
      htmlLines.push(`<blockquote>${inlineMarkdown(bqMatch[1])}</blockquote>`);
      i++;
      continue;
    }

    if (rawLine.trim() === "") {
      htmlLines.push("<br/>");
      i++;
      continue;
    }

    htmlLines.push(`<p>${inlineMarkdown(rawLine)}</p>`);
    i++;
  }

  if (inList) htmlLines.push("</ul>");
  if (inCodeBlock) htmlLines.push("</code></pre>");

  const bodyStyle = themeStyles[theme] || themeStyles.light;
  return `<html><body style="${bodyStyle}padding:30px 40px;">${htmlLines.join("\n")}</body></html>`;
}

export async function markdownToPdf(
  markdown: string,
  theme: string = "light",
  options: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
  } = {},
): Promise<Uint8Array> {
  const html = parseMarkdownToHtml(markdown, theme);
  return renderHtmlToPdf(html, options);
}

function fmtAmount(value: string | number, currency: string, locale: string): string {
  const s = String(value).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(s);
  if (isNaN(n)) return String(value);
  const formatted = Math.abs(n).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  if (n < 0) return `(${currency}${formatted})`;
  return `${currency}${formatted}`;
}

export async function reportToPdf(data: {
  title?: string;
  subtitle?: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number; style?: string }[];
  config?: {
    pageSize?: "A4" | "Letter" | "Legal";
    orientation?: "portrait" | "landscape";
    marginTop?: number;
    marginRight?: number;
    marginBottom?: number;
    marginLeft?: number;
    headerText?: string;
    footerText?: string;
    currency?: string;
    locale?: string;
    tableHeaderColor?: string;
    accentColor?: string;
  };
}): Promise<Uint8Array> {
  const {
    title,
    subtitle,
    headers,
    rows,
    summary,
    config = {},
  } = data;

  const currency = config.currency || "$";
  const locale = config.locale || "en-US";
  const headerColor = config.tableHeaderColor || "#1e40af";

  let html = `<div style="font-family:Helvetica,Arial,sans-serif;">`;

  if (title) {
    html += `<h1 style="text-align:center;color:#1e293b;margin:0 0 4px 0;">${escapeHtml(title)}</h1>`;
  }
  if (subtitle) {
    html += `<p style="text-align:center;color:#64748b;margin:0 0 20px 0;font-size:13px;">${escapeHtml(subtitle)}</p>`;
  }

  const lastCol = headers.length - 1;

  html += `<table style="width:100%;border-collapse:collapse;">`;
  html += `<thead><tr style="background-color:${headerColor};color:#ffffff;">`;
  for (let i = 0; i < headers.length; i++) {
    const align = i === lastCol ? "right" : "left";
    html += `<th style="padding:10px 14px;text-align:${align};font-size:11px;">${escapeHtml(headers[i])}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const bg = ri % 2 === 0 ? "#f8fafc" : "#ffffff";
    html += `<tr style="background-color:${bg};">`;
    for (let ci = 0; ci < row.length && ci < headers.length; ci++) {
      const cell = String(row[ci]);
      const isAmount = ci === lastCol || (ci > 0 && (headers[ci] ?? "").toLowerCase().includes("amount"));
      const align = ci === lastCol ? "right" : "left";
      const display = isAmount ? fmtAmount(cell, currency, locale) : cell;
      html += `<td style="padding:8px 14px;text-align:${align};font-size:12px;">${escapeHtml(display)}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  if (summary && summary.length > 0) {
    html += `<div style="margin-top:24px;"><table style="width:100%;border-collapse:collapse;">`;
    for (const item of summary) {
      const color = item.style === "positive" ? "#16a34a"
        : item.style === "negative" ? "#dc2626"
        : item.style === "bold" ? "#1e293b"
        : "#475569";
      const fw = item.style === "bold" ? "bold" : "normal";
      const fs = item.style === "bold" ? "15px" : "13px";
      const val = fmtAmount(item.value, currency, locale);
      html += `<tr><td style="padding:5px 14px;text-align:left;font-size:${fs};color:${color};font-weight:${fw};">${escapeHtml(item.label)}</td>`;
      html += `<td style="padding:5px 14px;text-align:right;font-size:${fs};color:${color};font-weight:${fw};">${escapeHtml(val)}</td></tr>`;
    }
    html += `</table></div>`;
  }

  if (config.footerText) {
    html += `<p style="text-align:center;color:#94a3b8;font-size:9px;margin-top:30px;">${escapeHtml(config.footerText)}</p>`;
  }

  html += `</div>`;

  return renderHtmlToPdf(html, config);
}

async function loadPdfJs(bytes: Uint8Array) {
  const copy = new Uint8Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return pdfjsLib.getDocument({ data: copy }).promise;
}

async function renderPageToCanvasNode(
  pdfJsPage: pdfjsLib.PDFPageProxy,
  scale: number,
  greyscale: boolean,
): Promise<any> {
  const viewport = pdfJsPage.getViewport({ scale });
  const canvas = createCanvas(
    Math.round(viewport.width),
    Math.round(viewport.height),
  );
  const ctx = canvas.getContext("2d");

  await pdfJsPage.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
  }).promise;

  if (greyscale) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = Math.round(
        0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2],
      );
      d[i] = lum;
      d[i + 1] = lum;
      d[i + 2] = lum;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  return canvas;
}

function canvasToJpegBytes(canvas: any, quality: number): Uint8Array {
  return canvas.toBuffer("image/jpeg", { quality });
}

export async function compressPdf(
  bytes: Uint8Array,
  config: CompressConfig = {},
): Promise<Uint8Array> {
  const {
    algorithm = "condense",
    removeMetadata = false,
    removeThumbnails = false,
    removeUnusedObjects = true,
    subsetFonts = false,
    dpi = null,
    greyscale = false,
    jpegQuality,
  } = config;

  if (algorithm === "photon" && dpi) {
    const srcDoc = await PDFDocument.load(bytes);
    const srcPages = srcDoc.getPages();
    const newDoc = await PDFDocument.create();
    const pdfJsDoc = await loadPdfJs(bytes);
    const pageCount = pdfJsDoc.numPages;
    const scale = dpi / 72;

    for (let i = 0; i < pageCount; i++) {
      const pdfJsPage = await pdfJsDoc.getPage(i + 1);
      const canvas = await renderPageToCanvasNode(pdfJsPage, scale, greyscale);
      const qual = dpi >= 150 ? 0.85 : dpi >= 96 ? 0.75 : 0.65;
      const jpegBytes = canvasToJpegBytes(canvas, jpegQuality ?? qual);
      const jpegImage = await newDoc.embedJpg(jpegBytes);
      const { width, height } = srcPages[i].getSize();
      const newPage = newDoc.addPage([width, height]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width, height });
    }

    return newDoc.save({ useObjectStreams: true });
  }

  const pdfDoc = await PDFDocument.load(bytes, {});

  if (removeMetadata) {
    const infoRef = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);
    if (infoRef && "dict" in infoRef) {
      const infoDict = infoRef as unknown as { dict: Map<unknown, unknown> };
      infoDict.dict.clear();
    }
    try {
      const catalog = pdfDoc.catalog;
      const metadataKey = catalog.context.obj("Metadata");
      catalog.delete(metadataKey);
    } catch {}
  }

  if (removeThumbnails) {
    const pages = pdfDoc.getPages();
    for (const page of pages) {
      try {
        const thumbKey = page.node.context.obj("Thumb");
        page.node.delete(thumbKey);
      } catch {}
    }
  }

  return pdfDoc.save({
    useObjectStreams: removeUnusedObjects,
  });
}
