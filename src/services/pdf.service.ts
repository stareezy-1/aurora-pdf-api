import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import { createCanvas } from "canvas";
import { renderHtmlToPdf } from "./pdf-engine.js";
import type {
  TextToPdfRequest,
  CompressConfig,
  ReportRequest,
  InvoiceRequest,
  ReceiptRequest,
  LetterRequest,
  CertificateRequest,
} from "../types/pdf.types.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = "";

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(
  value: string | number,
  currency: string,
  locale: string,
): string {
  const cleaned = String(value).replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  if (isNaN(n)) return String(value);
  try {
    const abs = Math.abs(n).toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return n < 0 ? `-${currency}${abs}` : `${currency}${abs}`;
  } catch {
    return `${n < 0 ? "-" : ""}${currency}${Math.abs(n).toFixed(2)}`;
  }
}

function localeDateStr(locale: string): string {
  return new Date().toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Fetch a logo from a URL or decode a base64 data-URI.
 * Returns raw bytes + detected MIME type, or null on any failure.
 */
async function fetchLogoBytes(
  src: string,
): Promise<{ bytes: Uint8Array; mime: "image/png" | "image/jpeg" } | null> {
  try {
    if (src.startsWith("data:")) {
      const [header, payload] = src.split(",");
      if (!payload) return null;
      const mime: "image/png" | "image/jpeg" =
        header.includes("jpeg") || header.includes("jpg")
          ? "image/jpeg"
          : "image/png";
      return { bytes: new Uint8Array(Buffer.from(payload, "base64")), mime };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(src, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    const mime: "image/png" | "image/jpeg" =
      ct.includes("jpeg") || ct.includes("jpg") ? "image/jpeg" : "image/png";
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// /create  —  plain text → PDF
// ─────────────────────────────────────────────────────────────────────────────

export async function textToPdf(body: TextToPdfRequest): Promise<Uint8Array> {
  const {
    fontFamily = "Helvetica",
    fontSize = 11,
    lineSpacing = 1.5,
    marginTop = 55,
    marginRight = 55,
    marginBottom = 55,
    marginLeft = 55,
    pageSize = "A4",
    orientation = "portrait",
    textColor = "#1e293b",
    backgroundColor,
    headerText = "",
    footerText = "",
    showPageNumbers = false,
    alignment = "left",
  } = body.config ?? {};

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(resolveStandardFont(fontFamily));
  const metaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let [pageWidth, pageHeight] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
  if (orientation === "landscape")
    [pageWidth, pageHeight] = [pageHeight, pageWidth];

  const maxWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = fontSize * lineSpacing;
  const textRgb = hexToRgb(textColor);

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - marginTop;

  function addBg() {
    if (backgroundColor) {
      const bg = hexToRgb(backgroundColor);
      page.drawRectangle({
        x: 0,
        y: 0,
        width: pageWidth,
        height: pageHeight,
        color: rgb(...bg),
      });
    }
  }
  addBg();

  function newPage() {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    addBg();
    y = pageHeight - marginTop;
  }

  function needsSpace(h: number) {
    if (y - h < marginBottom) newPage();
  }

  function drawLine(text: string) {
    needsSpace(lineHeight);
    const w = font.widthOfTextAtSize(text, fontSize);
    let x = marginLeft;
    if (alignment === "center") x = marginLeft + (maxWidth - w) / 2;
    else if (alignment === "right") x = marginLeft + maxWidth - w;
    page.drawText(text, {
      x,
      y: y - fontSize,
      size: fontSize,
      font,
      color: rgb(...textRgb),
    });
    y -= lineHeight;
  }

  function wrapLine(raw: string) {
    if (!raw.trim()) {
      y -= lineHeight * 0.5;
      return;
    }
    const words = raw.split(" ");
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && cur) {
        drawLine(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) drawLine(cur);
  }

  for (const line of body.text.split("\n")) wrapLine(line);

  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPages()[i];
    const pn = i + 1;
    if (headerText) {
      const hw = metaFont.widthOfTextAtSize(headerText, 9);
      p.drawText(headerText, {
        x: (pageWidth - hw) / 2,
        y: pageHeight - marginTop + 10,
        size: 9,
        font: metaFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
    if (footerText || showPageNumbers) {
      const ft = showPageNumbers
        ? `${footerText ? footerText + "   " : ""}${pn} / ${totalPages}`
        : footerText;
      const fw = metaFont.widthOfTextAtSize(ft, 9);
      p.drawText(ft, {
        x: (pageWidth - fw) / 2,
        y: marginBottom - 18,
        size: 9,
        font: metaFont,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  return pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// /create-from-html
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Markdown helpers
// ─────────────────────────────────────────────────────────────────────────────

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
  si: number,
): { html: string; endIdx: number } | null {
  if (si + 1 >= lines.length) return null;
  const hdr = lines[si].trim();
  if (!hdr.startsWith("|") || !hdr.endsWith("|")) return null;
  if (!/^\|[\s:-]+\|/.test(lines[si + 1].trim())) return null;

  const headers = hdr
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
  const aligns = lines[si + 1]
    .trim()
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith(":") && s.endsWith(":")
        ? "center"
        : s.endsWith(":")
        ? "right"
        : "left",
    );

  const rows: string[][] = [];
  let ei = si + 2;
  while (ei < lines.length) {
    const rl = lines[ei].trim();
    if (!rl.startsWith("|") || !rl.endsWith("|")) break;
    rows.push(
      rl
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean),
    );
    ei++;
  }

  let html = "<table style='width:100%;border-collapse:collapse;'><thead><tr>";
  headers.forEach((h, i) => {
    html += `<th style="text-align:${
      aligns[i] || "left"
    };padding:8px 10px;">${inlineMarkdown(h)}</th>`;
  });
  html += "</tr></thead><tbody>";
  rows.forEach((row) => {
    html +=
      "<tr>" +
      row
        .map(
          (c, i) =>
            `<td style="text-align:${
              aligns[i] || "left"
            };padding:6px 10px;">${inlineMarkdown(c)}</td>`,
        )
        .join("") +
      "</tr>";
  });
  html += "</tbody></table>";
  return { html, endIdx: ei };
}

function markdownToHtml(markdown: string, theme: string): string {
  const themeMap: Record<string, string> = {
    light: "background:#fff;color:#1e293b;",
    dark: "background:#1e1e1e;color:#d4d4d4;",
    github: "background:#fff;color:#24292e;",
  };
  const lines = markdown.split("\n");
  const out: string[] = [];
  let inCode = false,
    inList = false;
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    if (raw.trimStart().startsWith("```")) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        const lang = raw.trimStart().slice(3).trim();
        out.push(
          `<pre><code${lang ? ` class="language-${escapeHtml(lang)}"` : ""}>`,
        );
        inCode = true;
      }
      i++;
      continue;
    }
    if (inCode) {
      out.push(escapeHtml(raw));
      i++;
      continue;
    }

    const tbl = parsePipeTable(lines, i);
    if (tbl) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(tbl.html);
      i = tbl.endIdx;
      continue;
    }

    if (inList && !raw.match(/^[-*+]\s/) && !raw.match(/^\d+\.\s/)) {
      out.push("</ul>");
      inList = false;
    }

    const hm = raw.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      out.push(`<h${hm[1].length}>${inlineMarkdown(hm[2])}</h${hm[1].length}>`);
      i++;
      continue;
    }
    if (raw.match(/^[-*_]{3,}\s*$/)) {
      out.push("<hr/>");
      i++;
      continue;
    }

    const ul = raw.match(/^[-*+]\s+(.*)/);
    const ol = raw.match(/^\d+\.\s+(.*)/);
    if (ul || ol) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inlineMarkdown((ul || ol)![1])}</li>`);
      i++;
      continue;
    }

    const bq = raw.match(/^>\s?(.*)/);
    if (bq) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<blockquote>${inlineMarkdown(bq[1])}</blockquote>`);
      i++;
      continue;
    }
    if (raw.trim() === "") {
      out.push("<br/>");
      i++;
      continue;
    }
    out.push(`<p>${inlineMarkdown(raw)}</p>`);
    i++;
  }

  if (inList) out.push("</ul>");
  if (inCode) out.push("</code></pre>");

  return `<html><body style="${
    themeMap[theme] || themeMap.light
  }font-family:Helvetica,Arial,sans-serif;padding:30px 40px;">${out.join(
    "\n",
  )}</body></html>`;
}

export async function markdownToPdf(
  markdown: string,
  theme = "light",
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
  return renderHtmlToPdf(markdownToHtml(markdown, theme), options);
}

// ─────────────────────────────────────────────────────────────────────────────
// /report  —  Finary-style multi-section financial report
//
// Architecture:
//   1. Build HTML content body (no chrome — margins are already reserved)
//   2. Call renderHtmlToPdf to lay out the content
//   3. Re-open the result with pdf-lib and stamp a branded header band
//      (accent colour bg + logo image + brand/title text) and a footer band
//      (copyright + custom text + Page N of M) on every page.
// ─────────────────────────────────────────────────────────────────────────────

const REPORT_HEADER_H = 54; // height of the top band stamped on each page (pt)
const REPORT_FOOTER_H = 30; // height of the bottom band

export async function reportToPdf(data: ReportRequest): Promise<Uint8Array> {
  const {
    brand,
    title,
    subtitle,
    description,
    kpis = [],
    sections = [],
    summary = [],
    config = {},
  } = data;

  const currency = config.currency ?? "$";
  const locale = config.locale ?? "en-US";
  const accent = config.accentColor ?? "#22c55e";
  const showGenAt = config.showGeneratedAt ?? true;
  const logoUrl = config.logoUrl;
  const logoPosition = config.logoPosition ?? "left";
  const copyrightOwner = config.copyrightOwner;

  // Reserve space for the stamped bands
  const marginTop = config.marginTop ?? REPORT_HEADER_H + 18;
  const marginRight = config.marginRight ?? 50;
  const marginBottom = config.marginBottom ?? REPORT_FOOTER_H + 18;
  const marginLeft = config.marginLeft ?? 50;

  // ── Amount-column heuristic ─────────────────────────────────────────────
  function amountCols(headers: string[]): Set<number> {
    const s = new Set<number>();
    const kw = [
      "amount",
      "price",
      "total",
      "cost",
      "fee",
      "balance",
      "revenue",
      "income",
      "expense",
      "payment",
      "value",
      "worth",
      "savings",
      "portfolio",
      "profit",
      "loss",
      "allocation",
    ];
    headers.forEach((h, i) => {
      if (kw.some((k) => h.toLowerCase().includes(k))) s.add(i);
    });
    if (s.size === 0) s.add(headers.length - 1);
    return s;
  }

  // ── HTML content body ───────────────────────────────────────────────────
  let html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0f172a;font-size:12px;">`;

  if (brand) {
    html += `<h1 style="text-align:center;font-size:24px;font-weight:bold;margin:0 0 2px 0;letter-spacing:1px;">${escapeHtml(
      brand,
    )}</h1>`;
  }
  if (title) {
    html += `<h2 style="text-align:center;font-size:19px;font-weight:bold;margin:0 0 8px 0;">${escapeHtml(
      title,
    )}</h2>`;
  }
  if (subtitle) {
    html += `<p style="text-align:center;color:#64748b;font-size:12px;margin:0 0 4px 0;">${escapeHtml(
      subtitle,
    )}</p>`;
  }
  if (showGenAt) {
    html += `<p style="text-align:center;color:#94a3b8;font-size:10px;margin:0 0 20px 0;">Generated ${escapeHtml(
      localeDateStr(locale),
    )}</p>`;
  }

  // KPI block
  if (kpis.length > 0) {
    html += `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;">`;
    for (const kpi of kpis) {
      const cc =
        kpi.changeStyle === "positive"
          ? "#16a34a"
          : kpi.changeStyle === "negative"
          ? "#dc2626"
          : "#475569";
      html += `<tr style="background:#f8fafc;">
        <td style="padding:10px 14px;font-size:13px;font-weight:bold;border:1px solid #e2e8f0;width:40%;">${escapeHtml(
          kpi.label,
        )}</td>
        <td style="padding:10px 14px;font-size:13px;border:1px solid #e2e8f0;width:35%;">${escapeHtml(
          String(kpi.value),
        )}</td>
        ${
          kpi.change
            ? `<td style="padding:10px 14px;font-size:13px;color:${cc};font-weight:bold;border:1px solid #e2e8f0;width:25%;">${escapeHtml(
                kpi.change,
              )}</td>`
            : ""
        }
      </tr>`;
    }
    html += `</table>`;
  }

  if (description) {
    html += `<p style="font-size:12px;color:#334155;line-height:1.6;margin:0 0 20px 0;">${escapeHtml(
      description,
    )}</p>`;
  }

  // Sections
  for (const section of sections) {
    html += `<h2 style="font-size:17px;font-weight:bold;margin:20px 0 6px 0;color:#0f172a;border-bottom:2px solid #e2e8f0;padding-bottom:4px;">${escapeHtml(
      section.title,
    )}</h2>`;
    if (section.description) {
      html += `<p style="font-size:12px;color:#334155;line-height:1.6;margin:0 0 10px 0;">${escapeHtml(
        section.description,
      )}</p>`;
    }
    if (section.bullets?.length) {
      html += `<ul style="margin:0 0 12px 0;padding-left:0;list-style:none;">`;
      for (const b of section.bullets) {
        html += `<li style="padding:3px 0;font-size:12px;color:#334155;">&bull; ${escapeHtml(
          b,
        )}</li>`;
      }
      html += `</ul>`;
    }
    if (section.table) {
      const { headers, rows } = section.table;
      const hColor = section.table.headerColor ?? accent;
      const aCols = amountCols(headers);

      html += `<table style="width:100%;border-collapse:collapse;margin-bottom:8px;">`;
      html += `<thead><tr style="background-color:${escapeHtml(
        hColor,
      )};color:#ffffff;">`;
      headers.forEach((h, i) => {
        const align = aCols.has(i) ? "right" : "left";
        html += `<th style="padding:9px 12px;text-align:${align};font-size:11px;font-weight:bold;">${escapeHtml(
          h,
        )}</th>`;
      });
      html += `</tr></thead><tbody>`;
      rows.forEach((row, ri) => {
        const bg = ri % 2 === 0 ? "#f8fafc" : "#ffffff";
        html += `<tr style="background:${bg};">`;
        headers.forEach((_h, ci) => {
          const cell = ci < row.length ? String(row[ci]) : "";
          const isAmt = aCols.has(ci);
          const rawN = parseFloat(cell.replace(/[^0-9.\-]/g, ""));
          const isNeg = isAmt && rawN < 0;
          const color = isAmt ? (isNeg ? "#dc2626" : "#16a34a") : "inherit";
          const fw = isAmt ? "bold" : "normal";
          const align = isAmt ? "right" : "left";
          const disp = isAmt ? fmtMoney(cell, currency, locale) : cell;
          html += `<td style="padding:7px 12px;text-align:${align};font-size:11px;border-bottom:1px solid #e2e8f0;color:${color};font-weight:${fw};">${escapeHtml(
            disp,
          )}</td>`;
        });
        html += `</tr>`;
      });
      html += `</tbody></table>`;
    }
  }

  // Summary totals
  if (summary.length > 0) {
    html += `<div style="margin-top:20px;border-top:2px solid #cbd5e1;padding-top:12px;">`;
    html += `<table style="width:100%;border-collapse:collapse;">`;
    for (const row of summary) {
      const isBold = row.style === "bold";
      const color =
        row.style === "positive"
          ? "#16a34a"
          : row.style === "negative"
          ? "#dc2626"
          : isBold
          ? "#0f172a"
          : "#475569";
      const fw = isBold ? "bold" : "normal";
      const fs = isBold ? "14px" : "12px";
      const bg = isBold ? "#f1f5f9" : "transparent";
      const val = fmtMoney(row.value, currency, locale);
      html += `<tr style="background:${bg};">
        <td style="padding:6px 12px;font-size:${fs};color:${color};font-weight:${fw};">${escapeHtml(
        row.label,
      )}</td>
        <td style="padding:6px 12px;font-size:${fs};color:${color};font-weight:${fw};text-align:right;">${escapeHtml(
        val,
      )}</td>
      </tr>`;
    }
    html += `</table></div>`;
  }

  html += `</div>`;

  // ── Step 1: Render HTML body into PDF pages ─────────────────────────────
  const rawBytes = await renderHtmlToPdf(html, {
    pageSize: config.pageSize,
    orientation: config.orientation,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    // headerText/footerText intentionally omitted — stamped below
  });

  // ── Step 2: Re-open with pdf-lib and stamp header + footer bands ─────────
  const pdfDoc = await PDFDocument.load(rawBytes);
  const pages = pdfDoc.getPages();
  const total = pages.length;

  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Embed logo once (optional)
  type EmbedImg = Awaited<ReturnType<typeof pdfDoc.embedPng>>;
  let logoImg: EmbedImg | null = null;
  if (logoUrl) {
    const ld = await fetchLogoBytes(logoUrl);
    if (ld) {
      try {
        logoImg =
          ld.mime === "image/jpeg"
            ? await pdfDoc.embedJpg(ld.bytes)
            : await pdfDoc.embedPng(ld.bytes);
      } catch {
        /* bad image data — skip silently */
      }
    }
  }

  const [ar, ag, ab] = hexToRgb(accent);
  // Slightly darker shade for the bottom edge of the header
  const darken = (c: number) => Math.max(0, c - 0.12);

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width: pw, height: ph } = page.getSize();
    const padH = 14; // horizontal padding inside bands

    // ────────────────────────────────────────────────────────────────────────
    // HEADER BAND
    // ────────────────────────────────────────────────────────────────────────
    page.drawRectangle({
      x: 0,
      y: ph - REPORT_HEADER_H,
      width: pw,
      height: REPORT_HEADER_H,
      color: rgb(ar, ag, ab),
    });
    // Bottom shadow line
    page.drawLine({
      start: { x: 0, y: ph - REPORT_HEADER_H },
      end: { x: pw, y: ph - REPORT_HEADER_H },
      thickness: 1.5,
      color: rgb(darken(ar), darken(ag), darken(ab)),
    });

    // Logo placement
    const logoPad = 10;
    const logoMaxH = REPORT_HEADER_H - logoPad * 2;
    let logoReservedW = 0; // width that the logo occupies (+ gap) on the text side

    if (logoImg) {
      const { width: iw, height: ih } = logoImg.scale(1);
      const scale = Math.min(logoMaxH / ih, (pw * 0.2) / iw);
      const logoW = iw * scale;
      const logoH = ih * scale;
      const logoY = ph - REPORT_HEADER_H + (REPORT_HEADER_H - logoH) / 2;

      if (logoPosition === "right") {
        page.drawImage(logoImg, {
          x: pw - padH - logoW,
          y: logoY,
          width: logoW,
          height: logoH,
        });
        // text occupies the left portion
      } else {
        page.drawImage(logoImg, {
          x: padH,
          y: logoY,
          width: logoW,
          height: logoH,
        });
        logoReservedW = logoW + logoPad;
      }
    }

    // Text block inside the header band
    const textX = padH + logoReservedW;
    const textMaxW =
      pw -
      padH * 2 -
      logoReservedW -
      (logoImg && logoPosition === "right"
        ? logoImg.scale(1).width *
            Math.min(
              logoMaxH / logoImg.scale(1).height,
              (pw * 0.2) / logoImg.scale(1).width,
            ) +
          logoPad
        : 0);
    const brandStr = brand ?? "";
    const titleStr = title ?? "";

    if (brandStr && titleStr) {
      const bSize = 9;
      const tSize = 13;
      const blockH = bSize + 5 + tSize;
      const blockY = ph - REPORT_HEADER_H + (REPORT_HEADER_H + blockH) / 2;

      const bW = fontBold.widthOfTextAtSize(brandStr, bSize);
      const tW = fontBold.widthOfTextAtSize(titleStr, tSize);
      const bX = textX + Math.max(0, (textMaxW - bW) / 2);
      const tX = textX + Math.max(0, (textMaxW - tW) / 2);

      page.drawText(brandStr, {
        x: bX,
        y: blockY - bSize,
        size: bSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
      page.drawText(titleStr, {
        x: tX,
        y: blockY - bSize - 5 - tSize,
        size: tSize,
        font: fontBold,
        color: rgb(1, 1, 1),
      });
    } else {
      const label = brandStr || titleStr;
      if (label) {
        const lSize = 14;
        const lW = fontBold.widthOfTextAtSize(label, lSize);
        const lX = textX + Math.max(0, (textMaxW - lW) / 2);
        const lY = ph - REPORT_HEADER_H + (REPORT_HEADER_H - lSize) / 2;
        page.drawText(label, {
          x: lX,
          y: lY,
          size: lSize,
          font: fontBold,
          color: rgb(1, 1, 1),
        });
      }
    }

    // Subtitle / date in smaller white text, right-aligned in header band
    if (subtitle) {
      const sSize = 8;
      const sW = fontReg.widthOfTextAtSize(subtitle, sSize);
      const sX =
        pw - padH - sW - (logoImg && logoPosition === "right" ? 80 : 0);
      page.drawText(subtitle, {
        x: sX,
        y: ph - REPORT_HEADER_H + 8,
        size: sSize,
        font: fontReg,
        color: rgb(0.9, 0.9, 0.9),
      });
    }

    // ────────────────────────────────────────────────────────────────────────
    // FOOTER BAND
    // ────────────────────────────────────────────────────────────────────────
    // Light grey background
    page.drawRectangle({
      x: 0,
      y: 0,
      width: pw,
      height: REPORT_FOOTER_H,
      color: rgb(0.96, 0.96, 0.97),
    });
    // Top border
    page.drawLine({
      start: { x: 0, y: REPORT_FOOTER_H },
      end: { x: pw, y: REPORT_FOOTER_H },
      thickness: 0.75,
      color: rgb(0.8, 0.8, 0.83),
    });

    const fSize = 8;
    const fY = REPORT_FOOTER_H / 2 - fSize / 2; // vertically centred
    const fCol = rgb(0.42, 0.42, 0.47);

    // Left — © year owner
    const year = new Date().getFullYear();
    const cpText = copyrightOwner
      ? `\u00A9 ${year} ${copyrightOwner}. All rights reserved.`
      : `\u00A9 ${year}`;
    page.drawText(cpText, {
      x: padH,
      y: fY,
      size: fSize,
      font: fontReg,
      color: fCol,
    });

    // Centre — optional custom footer label
    if (config.footerText) {
      const ftW = fontReg.widthOfTextAtSize(config.footerText, fSize);
      page.drawText(config.footerText, {
        x: (pw - ftW) / 2,
        y: fY,
        size: fSize,
        font: fontReg,
        color: fCol,
      });
    }

    // Right — Page N of M  (bold page number)
    const pageNum = String(i + 1);
    const pageOf = ` of ${total}`;
    const pLabel = `Page `;
    const plW = fontReg.widthOfTextAtSize(pLabel, fSize);
    const pnW = fontBold.widthOfTextAtSize(pageNum, fSize);
    const poW = fontReg.widthOfTextAtSize(pageOf, fSize);
    const pTotalW = plW + pnW + poW;
    const pStartX = pw - padH - pTotalW;

    page.drawText(pLabel, {
      x: pStartX,
      y: fY,
      size: fSize,
      font: fontReg,
      color: fCol,
    });
    page.drawText(pageNum, {
      x: pStartX + plW,
      y: fY,
      size: fSize,
      font: fontBold,
      color: fCol,
    });
    page.drawText(pageOf, {
      x: pStartX + plW + pnW,
      y: fY,
      size: fSize,
      font: fontReg,
      color: fCol,
    });
  }

  return pdfDoc.save();
}

// ─────────────────────────────────────────────────────────────────────────────
// /invoice
// ─────────────────────────────────────────────────────────────────────────────

export async function invoiceToPdf(data: InvoiceRequest): Promise<Uint8Array> {
  const {
    invoiceNumber,
    date,
    dueDate,
    from,
    to,
    items,
    extraCharges = [],
    taxRate = 0,
    discount = 0,
    currency = "$",
    locale = "en-US",
    notes,
    accentColor = "#1e40af",
    config = {},
  } = data;

  const fmt = (n: number) => fmtMoney(n, currency, locale);

  const subtotal = items.reduce(
    (s, it) => s + (it.total ?? it.quantity * it.unitPrice),
    0,
  );
  const afterDisc = subtotal - discount;
  const taxAmount = afterDisc * (taxRate / 100);
  const extraTotal = extraCharges.reduce((s, e) => s + e.amount, 0);
  const total = afterDisc + taxAmount + extraTotal;

  let html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0f172a;font-size:12px;">`;

  html += `<div style="background:${escapeHtml(
    accentColor,
  )};padding:20px 24px;margin-bottom:24px;">
    <h1 style="color:#ffffff;font-size:22px;font-weight:bold;margin:0 0 4px 0;">INVOICE</h1>
    <p style="color:rgba(255,255,255,0.85);font-size:12px;margin:0;">#${escapeHtml(
      invoiceNumber,
    )}</p>
  </div>`;

  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:24px;"><tr>
    <td style="width:33%;vertical-align:top;padding-right:16px;">
      <p style="font-size:10px;color:#94a3b8;font-weight:bold;margin:0 0 4px 0;text-transform:uppercase;">From</p>
      <p style="font-size:13px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
        from.name,
      )}</p>
      ${
        from.address
          ? `<p style="font-size:11px;color:#64748b;margin:0 0 1px 0;">${escapeHtml(
              from.address,
            )}</p>`
          : ""
      }
      ${
        from.email
          ? `<p style="font-size:11px;color:#64748b;margin:0 0 1px 0;">${escapeHtml(
              from.email,
            )}</p>`
          : ""
      }
      ${
        from.phone
          ? `<p style="font-size:11px;color:#64748b;margin:0;">${escapeHtml(
              from.phone,
            )}</p>`
          : ""
      }
    </td>
    <td style="width:33%;vertical-align:top;padding-right:16px;">
      <p style="font-size:10px;color:#94a3b8;font-weight:bold;margin:0 0 4px 0;text-transform:uppercase;">Bill To</p>
      <p style="font-size:13px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
        to.name,
      )}</p>
      ${
        to.address
          ? `<p style="font-size:11px;color:#64748b;margin:0 0 1px 0;">${escapeHtml(
              to.address,
            )}</p>`
          : ""
      }
      ${
        to.email
          ? `<p style="font-size:11px;color:#64748b;margin:0;">${escapeHtml(
              to.email,
            )}</p>`
          : ""
      }
    </td>
    <td style="width:34%;vertical-align:top;text-align:right;">
      <p style="font-size:10px;color:#94a3b8;font-weight:bold;margin:0 0 4px 0;text-transform:uppercase;">Invoice Date</p>
      <p style="font-size:12px;margin:0 0 10px 0;">${escapeHtml(date)}</p>
      ${
        dueDate
          ? `<p style="font-size:10px;color:#94a3b8;font-weight:bold;margin:0 0 4px 0;text-transform:uppercase;">Due Date</p>
      <p style="font-size:12px;margin:0;">${escapeHtml(dueDate)}</p>`
          : ""
      }
    </td>
  </tr></table>`;

  html += `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
    <thead><tr style="background:${escapeHtml(accentColor)};color:#fff;">
      <th style="padding:10px 12px;text-align:left;font-size:11px;">Description</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;width:10%;">Qty</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;width:18%;">Unit Price</th>
      <th style="padding:10px 12px;text-align:right;font-size:11px;width:18%;">Total</th>
    </tr></thead><tbody>`;

  items.forEach((it, ri) => {
    const rowTotal = it.total ?? it.quantity * it.unitPrice;
    const bg = ri % 2 === 0 ? "#f8fafc" : "#ffffff";
    html += `<tr style="background:${bg};">
      <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;">${escapeHtml(
        it.description,
      )}</td>
      <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(
        String(it.quantity),
      )}</td>
      <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;">${escapeHtml(
        fmt(it.unitPrice),
      )}</td>
      <td style="padding:8px 12px;font-size:11px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${escapeHtml(
        fmt(rowTotal),
      )}</td>
    </tr>`;
  });

  html += `</tbody></table>`;

  html += `<div style="margin-left:50%;margin-bottom:24px;"><table style="width:100%;border-collapse:collapse;">`;
  html += `<tr><td style="padding:5px 12px;font-size:12px;color:#475569;">Subtotal</td><td style="padding:5px 12px;font-size:12px;text-align:right;">${escapeHtml(
    fmt(subtotal),
  )}</td></tr>`;
  if (discount > 0) {
    html += `<tr><td style="padding:5px 12px;font-size:12px;color:#475569;">Discount</td><td style="padding:5px 12px;font-size:12px;text-align:right;color:#dc2626;">-${escapeHtml(
      fmt(discount),
    )}</td></tr>`;
  }
  if (taxRate > 0) {
    html += `<tr><td style="padding:5px 12px;font-size:12px;color:#475569;">Tax (${escapeHtml(
      String(taxRate),
    )}%)</td><td style="padding:5px 12px;font-size:12px;text-align:right;">${escapeHtml(
      fmt(taxAmount),
    )}</td></tr>`;
  }
  for (const ec of extraCharges) {
    html += `<tr><td style="padding:5px 12px;font-size:12px;color:#475569;">${escapeHtml(
      ec.label,
    )}</td><td style="padding:5px 12px;font-size:12px;text-align:right;">${escapeHtml(
      fmt(ec.amount),
    )}</td></tr>`;
  }
  html += `<tr style="background:${escapeHtml(accentColor)};">
    <td style="padding:10px 12px;font-size:14px;font-weight:bold;color:#fff;">Total Due</td>
    <td style="padding:10px 12px;font-size:14px;font-weight:bold;color:#fff;text-align:right;">${escapeHtml(
      fmt(total),
    )}</td>
  </tr></table></div>`;

  if (notes) {
    html += `<div style="background:#f8fafc;border-left:3px solid ${escapeHtml(
      accentColor,
    )};padding:10px 14px;margin-top:8px;">
      <p style="font-size:10px;color:#94a3b8;font-weight:bold;margin:0 0 4px 0;text-transform:uppercase;">Notes</p>
      <p style="font-size:11px;color:#334155;margin:0;">${escapeHtml(notes)}</p>
    </div>`;
  }

  html += `</div>`;

  return renderHtmlToPdf(html, {
    pageSize: config.pageSize,
    orientation: config.orientation,
    marginTop: config.marginTop ?? 0,
    marginRight: config.marginRight ?? 40,
    marginBottom: config.marginBottom ?? 40,
    marginLeft: config.marginLeft ?? 40,
    headerText: config.headerText,
    footerText: config.footerText,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /receipt
// ─────────────────────────────────────────────────────────────────────────────

export async function receiptToPdf(data: ReceiptRequest): Promise<Uint8Array> {
  const {
    storeName,
    storeAddress,
    receiptNumber,
    date,
    items,
    taxRate = 0,
    discount = 0,
    currency = "$",
    locale = "en-US",
    paymentMethod,
    notes,
    accentColor = "#0f172a",
  } = data;

  const fmt = (n: number) => fmtMoney(n, currency, locale);

  const subtotal = items.reduce((s, it) => s + it.price * (it.qty ?? 1), 0);
  const afterDisc = subtotal - discount;
  const tax = afterDisc * (taxRate / 100);
  const total = afterDisc + tax;

  let html = `<div style="font-family:Helvetica,Arial,sans-serif;color:#0f172a;max-width:380px;margin:0 auto;">`;

  html += `<div style="text-align:center;padding:16px 0 12px 0;border-bottom:2px solid ${escapeHtml(
    accentColor,
  )};">
    <h1 style="font-size:18px;font-weight:bold;margin:0 0 4px 0;">${escapeHtml(
      storeName,
    )}</h1>
    ${
      storeAddress
        ? `<p style="font-size:10px;color:#64748b;margin:0 0 2px 0;">${escapeHtml(
            storeAddress,
          )}</p>`
        : ""
    }
    ${
      receiptNumber
        ? `<p style="font-size:10px;color:#94a3b8;margin:0;">Receipt #${escapeHtml(
            receiptNumber,
          )}</p>`
        : ""
    }
    ${
      date
        ? `<p style="font-size:10px;color:#94a3b8;margin:2px 0 0 0;">${escapeHtml(
            date,
          )}</p>`
        : ""
    }
  </div>`;

  html += `<table style="width:100%;border-collapse:collapse;margin:12px 0;">`;
  items.forEach((it) => {
    const qty = it.qty ?? 1;
    const line = it.price * qty;
    html += `<tr>
      <td style="padding:5px 4px;font-size:11px;">${escapeHtml(it.name)}</td>
      <td style="padding:5px 4px;font-size:11px;text-align:center;color:#64748b;">${
        qty > 1 ? `x${qty}` : ""
      }</td>
      <td style="padding:5px 4px;font-size:11px;text-align:right;">${escapeHtml(
        fmt(line),
      )}</td>
    </tr>`;
  });
  html += `</table>`;

  html += `<div style="border-top:1px dashed #cbd5e1;padding-top:10px;"><table style="width:100%;border-collapse:collapse;">`;
  html += `<tr><td style="padding:3px 4px;font-size:11px;color:#475569;">Subtotal</td><td style="padding:3px 4px;font-size:11px;text-align:right;">${escapeHtml(
    fmt(subtotal),
  )}</td></tr>`;
  if (discount > 0) {
    html += `<tr><td style="padding:3px 4px;font-size:11px;color:#475569;">Discount</td><td style="padding:3px 4px;font-size:11px;text-align:right;color:#dc2626;">-${escapeHtml(
      fmt(discount),
    )}</td></tr>`;
  }
  if (taxRate > 0) {
    html += `<tr><td style="padding:3px 4px;font-size:11px;color:#475569;">Tax (${escapeHtml(
      String(taxRate),
    )}%)</td><td style="padding:3px 4px;font-size:11px;text-align:right;">${escapeHtml(
      fmt(tax),
    )}</td></tr>`;
  }
  html += `<tr style="border-top:2px solid ${escapeHtml(accentColor)};">
    <td style="padding:8px 4px;font-size:13px;font-weight:bold;">TOTAL</td>
    <td style="padding:8px 4px;font-size:13px;font-weight:bold;text-align:right;">${escapeHtml(
      fmt(total),
    )}</td>
  </tr></table></div>`;

  if (paymentMethod)
    html += `<p style="font-size:11px;color:#64748b;text-align:center;margin:10px 0 0 0;">Payment: ${escapeHtml(
      paymentMethod,
    )}</p>`;
  if (notes)
    html += `<p style="font-size:10px;color:#94a3b8;text-align:center;margin:8px 0 0 0;">${escapeHtml(
      notes,
    )}</p>`;
  html += `<p style="font-size:10px;color:#94a3b8;text-align:center;margin:14px 0 0 0;">Thank you for your purchase!</p></div>`;

  return renderHtmlToPdf(html, {
    marginTop: 50,
    marginBottom: 50,
    marginLeft: 80,
    marginRight: 80,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /letter
// ─────────────────────────────────────────────────────────────────────────────

export async function letterToPdf(data: LetterRequest): Promise<Uint8Array> {
  const {
    date,
    from,
    to,
    subject,
    salutation = "Dear Sir/Madam,",
    body,
    closing = "Sincerely,",
    signatureName,
    signatureTitle,
    config = {},
  } = data;

  const dateStr = date ?? localeDateStr("en-US");
  let html = `<div style="font-family:TimesRoman,Georgia,serif;color:#1e293b;font-size:12px;line-height:1.7;">`;

  if (from) {
    html += `<div style="margin-bottom:16px;">
      <p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
        from.name,
      )}</p>
      ${
        from.title
          ? `<p style="font-size:11px;color:#475569;margin:0 0 1px 0;">${escapeHtml(
              from.title,
            )}</p>`
          : ""
      }
      ${
        from.company
          ? `<p style="font-size:11px;color:#475569;margin:0 0 1px 0;">${escapeHtml(
              from.company,
            )}</p>`
          : ""
      }
      ${
        from.address
          ? `<p style="font-size:11px;color:#475569;margin:0 0 1px 0;">${escapeHtml(
              from.address,
            )}</p>`
          : ""
      }
      ${
        from.email
          ? `<p style="font-size:11px;color:#475569;margin:0;">${escapeHtml(
              from.email,
            )}</p>`
          : ""
      }
    </div>`;
  }

  html += `<p style="font-size:12px;margin:0 0 16px 0;">${escapeHtml(
    dateStr,
  )}</p>`;

  if (to) {
    html += `<div style="margin-bottom:16px;">
      <p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
        to.name,
      )}</p>
      ${
        to.title
          ? `<p style="font-size:11px;color:#475569;margin:0 0 1px 0;">${escapeHtml(
              to.title,
            )}</p>`
          : ""
      }
      ${
        to.company
          ? `<p style="font-size:11px;color:#475569;margin:0 0 1px 0;">${escapeHtml(
              to.company,
            )}</p>`
          : ""
      }
      ${
        to.address
          ? `<p style="font-size:11px;color:#475569;margin:0;">${escapeHtml(
              to.address,
            )}</p>`
          : ""
      }
    </div>`;
  }

  if (subject)
    html += `<p style="font-size:12px;font-weight:bold;margin:0 0 14px 0;">Re: ${escapeHtml(
      subject,
    )}</p>`;
  html += `<p style="font-size:12px;margin:0 0 12px 0;">${escapeHtml(
    salutation,
  )}</p>`;

  for (const para of body) {
    html += `<p style="font-size:12px;margin:0 0 12px 0;text-align:justify;">${escapeHtml(
      para,
    )}</p>`;
  }

  html += `<p style="font-size:12px;margin:24px 0 32px 0;">${escapeHtml(
    closing,
  )}</p>`;
  if (signatureName)
    html += `<p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
      signatureName,
    )}</p>`;
  if (signatureTitle)
    html += `<p style="font-size:11px;color:#475569;margin:0;">${escapeHtml(
      signatureTitle,
    )}</p>`;
  html += `</div>`;

  return renderHtmlToPdf(html, {
    pageSize: config.pageSize,
    orientation: config.orientation,
    marginTop: config.marginTop ?? 70,
    marginRight: config.marginRight ?? 80,
    marginBottom: config.marginBottom ?? 70,
    marginLeft: config.marginLeft ?? 80,
    headerText: config.headerText,
    footerText: config.footerText,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /certificate
// ─────────────────────────────────────────────────────────────────────────────

export async function certificateToPdf(
  data: CertificateRequest,
): Promise<Uint8Array> {
  const {
    type = "Certificate of Achievement",
    title,
    preamble = "This is to certify that",
    recipientName,
    description,
    date,
    issuerName,
    issuerTitle,
    coIssuerName,
    coIssuerTitle,
    accentColor = "#1e40af",
    config = {},
  } = data;

  const dateStr = date ?? localeDateStr("en-US");

  let html = `<div style="font-family:TimesRoman,Georgia,serif;text-align:center;color:#0f172a;padding:30px 20px;">`;
  html += `<div style="border:4px solid ${escapeHtml(
    accentColor,
  )};padding:30px 40px;">`;
  html += `<div style="border:1.5px solid ${escapeHtml(
    accentColor,
  )};padding:24px 32px;">`;

  html += `<p style="font-size:11px;letter-spacing:3px;color:${escapeHtml(
    accentColor,
  )};margin:0 0 8px 0;text-transform:uppercase;font-weight:bold;">${escapeHtml(
    type,
  )}</p>`;
  html += `<h1 style="font-size:26px;font-weight:bold;color:${escapeHtml(
    accentColor,
  )};margin:0 0 20px 0;letter-spacing:1px;">${escapeHtml(title)}</h1>`;
  html += `<p style="font-size:12px;color:#475569;margin:0 0 8px 0;">${escapeHtml(
    preamble,
  )}</p>`;
  html += `<p style="font-size:22px;font-weight:bold;color:#0f172a;margin:6px 0 10px 0;border-bottom:2px solid ${escapeHtml(
    accentColor,
  )};padding-bottom:8px;display:inline-block;">${escapeHtml(
    recipientName,
  )}</p>`;

  if (description)
    html += `<p style="font-size:12px;color:#475569;line-height:1.6;margin:12px 0 0 0;">${escapeHtml(
      description,
    )}</p>`;
  html += `<p style="font-size:11px;color:#64748b;margin:20px 0 24px 0;">${escapeHtml(
    dateStr,
  )}</p>`;

  if (issuerName || coIssuerName) {
    html += `<table style="width:100%;border-collapse:collapse;margin-top:16px;"><tr>`;
    if (issuerName) {
      html += `<td style="width:${
        coIssuerName ? "50%" : "100%"
      };text-align:center;padding:0 20px;">
        <div style="border-top:1.5px solid #94a3b8;margin-bottom:6px;"></div>
        <p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
          issuerName,
        )}</p>
        ${
          issuerTitle
            ? `<p style="font-size:10px;color:#64748b;margin:0;">${escapeHtml(
                issuerTitle,
              )}</p>`
            : ""
        }
      </td>`;
    }
    if (coIssuerName) {
      html += `<td style="width:50%;text-align:center;padding:0 20px;">
        <div style="border-top:1.5px solid #94a3b8;margin-bottom:6px;"></div>
        <p style="font-size:12px;font-weight:bold;margin:0 0 2px 0;">${escapeHtml(
          coIssuerName,
        )}</p>
        ${
          coIssuerTitle
            ? `<p style="font-size:10px;color:#64748b;margin:0;">${escapeHtml(
                coIssuerTitle,
              )}</p>`
            : ""
        }
      </td>`;
    }
    html += `</tr></table>`;
  }

  html += `</div></div></div>`;

  return renderHtmlToPdf(html, {
    pageSize: config.pageSize ?? "A4",
    orientation: config.orientation ?? "landscape",
    marginTop: config.marginTop ?? 50,
    marginRight: config.marginRight ?? 50,
    marginBottom: config.marginBottom ?? 50,
    marginLeft: config.marginLeft ?? 50,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// /compress
// ─────────────────────────────────────────────────────────────────────────────

async function loadPdfJs(bytes: Uint8Array) {
  const copy = new Uint8Array(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  );
  return pdfjsLib.getDocument({ data: copy }).promise;
}

async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale: number,
  greyscale: boolean,
) {
  const vp = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
  const ctx = canvas.getContext("2d");

  await page.render({
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport: vp,
  }).promise;

  if (greyscale) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < img.data.length; i += 4) {
      const l = Math.round(
        0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2],
      );
      img.data[i] = img.data[i + 1] = img.data[i + 2] = l;
    }
    ctx.putImageData(img, 0, 0);
  }
  return canvas;
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

  if (algorithm === "photon" && dpi) {
    const srcDoc = await PDFDocument.load(bytes);
    const srcPages = srcDoc.getPages();
    const newDoc = await PDFDocument.create();
    const pdfJs = await loadPdfJs(bytes);
    const scale = dpi / 72;

    for (let i = 0; i < pdfJs.numPages; i++) {
      const canvas = await renderPageToCanvas(
        await pdfJs.getPage(i + 1),
        scale,
        greyscale,
      );
      const qual =
        jpegQuality != null
          ? jpegQuality / 100
          : dpi >= 150
          ? 0.85
          : dpi >= 96
          ? 0.75
          : 0.65;
      const jpgBuf = (canvas as any).toBuffer("image/jpeg", {
        quality: qual,
      }) as Buffer;
      const jpgImg = await newDoc.embedJpg(jpgBuf);
      const { width, height } = srcPages[i].getSize();
      const p = newDoc.addPage([width, height]);
      p.drawImage(jpgImg, { x: 0, y: 0, width, height });
    }
    return newDoc.save({ useObjectStreams: true });
  }

  const pdfDoc = await PDFDocument.load(bytes);

  if (removeMetadata) {
    try {
      const infoRef = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);
      if (infoRef && "dict" in infoRef) (infoRef as any).dict.clear();
    } catch {}
    try {
      pdfDoc.catalog.delete(pdfDoc.catalog.context.obj("Metadata"));
    } catch {}
  }

  if (removeThumbnails) {
    for (const p of pdfDoc.getPages()) {
      try {
        p.node.delete(p.node.context.obj("Thumb"));
      } catch {}
    }
  }

  return pdfDoc.save({ useObjectStreams: removeUnusedObjects });
}
