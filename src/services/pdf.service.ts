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

// ---------------------------------------------------------------------------
// textToPdf — fixed: draw header/footer on EVERY page, not just the last
// ---------------------------------------------------------------------------
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
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let [pageWidth, pageHeight] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
  if (orientation === "landscape") {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  const maxWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = fontSize * lineSpacing;
  const textRgb = hexToRgb(textColor);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentPageNum = 1;

  function addBackground() {
    if (backgroundColor) {
      const bg = hexToRgb(backgroundColor);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(bg[0], bg[1], bg[2]),
      });
    }
  }

  addBackground();
  let y = pageHeight - marginTop;

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    addBackground();
    y = pageHeight - marginTop;
    currentPageNum++;
  }

  function ensureSpace(needed: number) {
    if (y - needed < marginBottom) newPage();
  }

  function drawTextLine(line: string, align: string) {
    ensureSpace(lineHeight);
    const w = font.widthOfTextAtSize(line, fontSize);
    let x = marginLeft;
    if (align === "center") x = marginLeft + (maxWidth - w) / 2;
    else if (align === "right") x = marginLeft + maxWidth - w;

    page.drawText(line, {
      x,
      y: y - fontSize,
      size: fontSize,
      font,
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

  // Draw header/footer on every page
  const totalPages = pdfDoc.getPageCount();
  const allPages = pdfDoc.getPages();

  for (let i = 0; i < totalPages; i++) {
    const p = allPages[i];
    const pageNum = i + 1;

    if (headerText) {
      const w = regularFont.widthOfTextAtSize(headerText, 9);
      p.drawText(headerText, {
        x: (pageWidth - w) / 2,
        y: pageHeight - marginTop + 8,
        size: 9,
        font: regularFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    if (footerText || showPageNumbers) {
      const text = showPageNumbers
        ? footerText
          ? `${footerText}   ${pageNum} / ${totalPages}`
          : `${pageNum} / ${totalPages}`
        : footerText;
      const w = regularFont.widthOfTextAtSize(text, 9);
      p.drawText(text, {
        x: (pageWidth - w) / 2,
        y: marginBottom - 15,
        size: 9,
        font: regularFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

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
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function parsePipeTable(
  lines: string[],
  startIdx: number,
): { html: string; endIdx: number } | null {
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
    const cells = rowLine
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    rows.push(cells);
    endIdx++;
  }

  let html =
    "<table style='width:100%;border-collapse:collapse;'>\n<thead>\n<tr>";
  for (let i = 0; i < headers.length; i++) {
    const align = alignments[i] || "left";
    html += `<th style="text-align:${align};padding:8px 10px;">${inlineMarkdown(
      headers[i],
    )}</th>`;
  }
  html += "</tr>\n</thead>\n<tbody>\n";

  for (const row of rows) {
    html += "<tr>";
    for (let i = 0; i < row.length; i++) {
      const align = alignments[i] || "left";
      html += `<td style="text-align:${align};padding:6px 10px;">${inlineMarkdown(
        row[i],
      )}</td>`;
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
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
      if (inCodeBlock) {
        htmlLines.push("</code></pre>");
        inCodeBlock = false;
        codeBlockLang = "";
      } else {
        codeBlockLang = rawLine.trimStart().slice(3).trim();
        htmlLines.push(
          `<pre><code${
            codeBlockLang
              ? ` class="language-${escapeHtml(codeBlockLang)}"`
              : ""
          }>`,
        );
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
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
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

    if (h1) {
      htmlLines.push(`<h1>${inlineMarkdown(h1[1])}</h1>`);
      i++;
      continue;
    }
    if (h2) {
      htmlLines.push(`<h2>${inlineMarkdown(h2[1])}</h2>`);
      i++;
      continue;
    }
    if (h3) {
      htmlLines.push(`<h3>${inlineMarkdown(h3[1])}</h3>`);
      i++;
      continue;
    }
    if (h4) {
      htmlLines.push(`<h4>${inlineMarkdown(h4[1])}</h4>`);
      i++;
      continue;
    }
    if (h5) {
      htmlLines.push(`<h5>${inlineMarkdown(h5[1])}</h5>`);
      i++;
      continue;
    }
    if (h6) {
      htmlLines.push(`<h6>${inlineMarkdown(h6[1])}</h6>`);
      i++;
      continue;
    }

    if (rawLine.match(/^[-*_]{3,}\s*$/)) {
      htmlLines.push("<hr/>");
      i++;
      continue;
    }

    const uListMatch = rawLine.match(/^[-*+]\s+(.*)/);
    const oListMatch = rawLine.match(/^\d+\.\s+(.*)/);

    if (uListMatch || oListMatch) {
      if (!inList) {
        htmlLines.push("<ul>");
        inList = true;
      }
      const content = (uListMatch || oListMatch)![1];
      htmlLines.push(`<li>${inlineMarkdown(content)}</li>`);
      i++;
      continue;
    }

    const bqMatch = rawLine.match(/^>\s?(.*)/);
    if (bqMatch) {
      if (inList) {
        htmlLines.push("</ul>");
        inList = false;
      }
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
  return `<html><body style="${bodyStyle}padding:30px 40px;">${htmlLines.join(
    "\n",
  )}</body></html>`;
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

// ---------------------------------------------------------------------------
// fmtAmount — fixed: accepts both raw numbers/strings and already-formatted
// strings; negative values shown with leading minus instead of parens.
// ---------------------------------------------------------------------------
function fmtAmount(
  value: string | number,
  currency: string,
  locale: string,
): string {
  // Strip any non-numeric characters except decimal point and minus sign
  // but only if the value looks like a plain number, not an already-formatted string
  const raw = typeof value === "number" ? value : String(value);
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);

  if (isNaN(n)) {
    // Already formatted or non-numeric — return as-is
    return String(value);
  }

  try {
    const formatted = Math.abs(n).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
  } catch {
    const formatted = Math.abs(n).toFixed(2);
    return n < 0 ? `-${currency}${formatted}` : `${currency}${formatted}`;
  }
}

// ---------------------------------------------------------------------------
// reportToPdf — improved HTML layout: cleaner typography, divider line before
// summary, generated-at timestamp, better amount-column detection.
// ---------------------------------------------------------------------------
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
    showGeneratedAt?: boolean;
  };
}): Promise<Uint8Array> {
  const { title, subtitle, headers, rows, summary, config = {} } = data;

  const currency = config.currency || "$";
  const locale = config.locale || "en-US";
  const headerColor = config.tableHeaderColor || "#1e40af";
  const showGeneratedAt = config.showGeneratedAt ?? true;

  // Determine which columns contain amounts by header name heuristic
  const amountColIndices = new Set<number>();
  headers.forEach((h, i) => {
    const lower = h.toLowerCase();
    if (
      lower.includes("amount") ||
      lower.includes("price") ||
      lower.includes("total") ||
      lower.includes("cost") ||
      lower.includes("fee") ||
      lower.includes("balance") ||
      lower.includes("revenue") ||
      lower.includes("income") ||
      lower.includes("expense") ||
      lower.includes("payment")
    ) {
      amountColIndices.add(i);
    }
  });
  // Always treat last column as amount if no heuristic matched and it looks numeric
  if (amountColIndices.size === 0) {
    amountColIndices.add(headers.length - 1);
  }

  let html = `<div style="font-family:Helvetica,Arial,sans-serif;font-size:12px;color:#1e293b;">`;

  if (title) {
    html += `<h1 style="text-align:center;color:#0f172a;margin:0 0 6px 0;font-size:20px;">${escapeHtml(
      title,
    )}</h1>`;
  }
  if (subtitle) {
    html += `<p style="text-align:center;color:#64748b;margin:0 0 4px 0;font-size:12px;">${escapeHtml(
      subtitle,
    )}</p>`;
  }
  if (showGeneratedAt) {
    const now = new Date().toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    html += `<p style="text-align:center;color:#94a3b8;margin:0 0 20px 0;font-size:10px;">Generated ${escapeHtml(
      now,
    )}</p>`;
  }

  // Table
  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">`;
  html += `<thead><tr style="background-color:${escapeHtml(
    headerColor,
  )};color:#ffffff;">`;
  for (let i = 0; i < headers.length; i++) {
    const isAmt = amountColIndices.has(i);
    const align = isAmt ? "right" : i === 0 ? "left" : "left";
    html += `<th style="padding:10px 12px;text-align:${align};font-size:11px;font-weight:bold;">${escapeHtml(
      headers[i],
    )}</th>`;
  }
  html += `</tr></thead><tbody>`;

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const bg = ri % 2 === 0 ? "#f8fafc" : "#ffffff";
    html += `<tr style="background-color:${bg};">`;
    for (let ci = 0; ci < headers.length; ci++) {
      const cell = ci < row.length ? String(row[ci]) : "";
      const isAmt = amountColIndices.has(ci);
      const align = isAmt ? "right" : "left";
      const display = isAmt ? fmtAmount(cell, currency, locale) : cell;
      html += `<td style="padding:7px 12px;text-align:${align};font-size:11px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
        display,
      )}</td>`;
    }
    html += `</tr>`;
  }

  html += `</tbody></table>`;

  // Summary section
  if (summary && summary.length > 0) {
    html += `<hr style="border:none;border-top:2px solid #cbd5e1;margin:16px 0 12px 0;" />`;
    html += `<table style="width:100%;border-collapse:collapse;">`;

    for (const item of summary) {
      const isBold = item.style === "bold";
      const color =
        item.style === "positive"
          ? "#16a34a"
          : item.style === "negative"
          ? "#dc2626"
          : isBold
          ? "#0f172a"
          : "#475569";
      const fw = isBold ? "bold" : "normal";
      const fs = isBold ? "14px" : "12px";
      const bg = isBold ? "#f1f5f9" : "transparent";
      const pt = isBold ? "8px 12px" : "5px 12px";
      const val = fmtAmount(item.value, currency, locale);

      html += `<tr style="background-color:${bg};">`;
      html += `<td style="padding:${pt};text-align:left;font-size:${fs};color:${color};font-weight:${fw};">${escapeHtml(
        item.label,
      )}</td>`;
      html += `<td style="padding:${pt};text-align:right;font-size:${fs};color:${color};font-weight:${fw};">${escapeHtml(
        val,
      )}</td>`;
      html += `</tr>`;
    }

    html += `</table>`;
  }

  if (config.footerText) {
    html += `<p style="text-align:center;color:#94a3b8;font-size:9px;margin-top:32px;">${escapeHtml(
      config.footerText,
    )}</p>`;
  }

  html += `</div>`;

  const pageOpts = {
    pageSize: config.pageSize,
    orientation: config.orientation,
    marginTop: config.marginTop ?? 50,
    marginRight: config.marginRight ?? 50,
    marginBottom: config.marginBottom ?? 50,
    marginLeft: config.marginLeft ?? 50,
    headerText: config.headerText,
    footerText: undefined as string | undefined, // footer is rendered inline above
  };

  return renderHtmlToPdf(html, pageOpts);
}

// ---------------------------------------------------------------------------
// compressPdf
// ---------------------------------------------------------------------------
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
): Promise<ReturnType<typeof createCanvas>> {
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

function canvasToJpegBytes(
  canvas: ReturnType<typeof createCanvas>,
  quality: number,
): Uint8Array {
  return (
    canvas as unknown as {
      toBuffer(type: string, opts: { quality: number }): Buffer;
    }
  ).toBuffer("image/jpeg", { quality }) as unknown as Uint8Array;
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
    dpi = null,
    greyscale = false,
    jpegQuality,
  } = config;

  // Photon: re-render pages as JPEG images (lossy, maximum file size reduction)
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
      // Auto quality based on DPI tier if not explicitly specified
      const qual =
        jpegQuality != null
          ? jpegQuality / 100
          : dpi >= 150
          ? 0.85
          : dpi >= 96
          ? 0.75
          : 0.65;
      const jpegBytes = canvasToJpegBytes(canvas, qual);
      const jpegImage = await newDoc.embedJpg(jpegBytes);
      const { width, height } = srcPages[i].getSize();
      const newPage = newDoc.addPage([width, height]);
      newPage.drawImage(jpegImage, { x: 0, y: 0, width, height });
    }

    return newDoc.save({ useObjectStreams: true });
  }

  // Condense: structural optimisation via pdf-lib (lossless)
  const pdfDoc = await PDFDocument.load(bytes);

  if (removeMetadata) {
    try {
      const infoRef = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);
      if (infoRef && "dict" in infoRef) {
        const infoDict = infoRef as unknown as { dict: Map<unknown, unknown> };
        infoDict.dict.clear();
      }
    } catch {}
    try {
      const catalog = pdfDoc.catalog;
      const metadataKey = catalog.context.obj("Metadata");
      catalog.delete(metadataKey);
    } catch {}
  }

  if (removeThumbnails) {
    for (const page of pdfDoc.getPages()) {
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
