import {
  PDFDocument,
  PDFPage,
  StandardFonts,
  rgb,
  type PDFFont,
} from "pdf-lib";

type RgbColor = [number, number, number];

interface Styles {
  color: RgbColor | null;
  bgColor: RgbColor | null;
  textAlign: "left" | "center" | "right";
  fontWeight: "normal" | "bold";
  fontStyle: "normal" | "italic";
  fontSize: number | null;
  fontFamily: string | null;
  padding: [number, number, number, number];
  width: number | null;
  borderTop: boolean;
  borderBottom: boolean;
  borderLeft: boolean;
  borderRight: boolean;
}

interface CellData {
  text: string;
  styles: Styles;
  colspan: number;
  rowspan: number;
}

interface RowData {
  cells: CellData[];
  isHeader: boolean;
  height: number;
}

interface TableData {
  rows: RowData[];
  colWidths: number[];
  totalWidth: number;
}

interface PdfNode {
  type: "element" | "text";
  tag?: string;
  attrs?: Record<string, string>;
  children: PdfNode[];
  text?: string;
  styles: Styles;
}

interface RenderCtx {
  doc: PDFDocument;
  page: PDFPage;
  fonts: {
    regular: PDFFont;
    bold: PDFFont;
    italic: PDFFont;
    boldItalic: PDFFont;
    mono: PDFFont;
    monoBold: PDFFont;
  };
  y: number;
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  pageNum: number;
  totalPages: number;
}

const PAGE_SIZES: Record<string, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
};

const BLACK: RgbColor = [0, 0, 0];

function hexToRgb(hex: string): RgbColor {
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

const NAMED_COLORS: Record<string, RgbColor> = {
  black: [0, 0, 0],
  white: [1, 1, 1],
  red: [1, 0, 0],
  green: [0, 0.5, 0],
  blue: [0, 0, 1],
  navy: [0, 0, 0.5],
  gray: [0.5, 0.5, 0.5],
  grey: [0.5, 0.5, 0.5],
  silver: [0.75, 0.75, 0.75],
  transparent: [0, 0, 0],
};

function resolveColor(value: string | undefined | null): RgbColor | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "none" || v === "transparent") return null;
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  if (v.startsWith("#")) return hexToRgb(v);
  const rgbMatch = v.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]) / 255,
      parseInt(rgbMatch[2]) / 255,
      parseInt(rgbMatch[3]) / 255,
    ];
  }
  return null;
}

const DEFAULT_STYLES: Styles = {
  color: BLACK,
  bgColor: null,
  textAlign: "left",
  fontWeight: "normal",
  fontStyle: "normal",
  fontSize: null,
  fontFamily: null,
  padding: [0, 0, 0, 0],
  width: null,
  borderTop: false,
  borderBottom: false,
  borderLeft: false,
  borderRight: false,
};

function mergeStyles(base: Styles, override: Partial<Styles>): Styles {
  return { ...base, ...override };
}

function parseStyles(styleStr: string | undefined | null): Partial<Styles> {
  const s: Partial<Styles> = {};
  if (!styleStr) return s;
  const props = styleStr.split(";");
  for (const prop of props) {
    const [key, ...valParts] = prop.split(":");
    const k = key?.trim().toLowerCase();
    const v = valParts.join(":").trim();
    if (!k || !v) continue;

    switch (k) {
      case "color":
      case "text-color": {
        const c = resolveColor(v);
        if (c) s.color = c;
        break;
      }
      case "background-color":
      case "background": {
        const c = resolveColor(v);
        if (c) s.bgColor = c;
        break;
      }
      case "text-align": {
        if (v === "center" || v === "right") s.textAlign = v;
        else s.textAlign = "left";
        break;
      }
      case "font-weight": {
        s.fontWeight =
          v === "bold" || v === "700" || v === "800" || v === "900"
            ? "bold"
            : "normal";
        break;
      }
      case "font-style": {
        s.fontStyle = v === "italic" ? "italic" : "normal";
        break;
      }
      case "font-size": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.fontSize = n;
        break;
      }
      case "font-family": {
        s.fontFamily = v;
        break;
      }
      case "padding": {
        const parts = v.split(/\s+/).map(parseFloat);
        if (parts.length === 1 && !isNaN(parts[0]))
          s.padding = [parts[0], parts[0], parts[0], parts[0]];
        else if (parts.length === 2 && parts.every((n) => !isNaN(n)))
          s.padding = [parts[0], parts[1], parts[0], parts[1]];
        else if (parts.length === 4 && parts.every((n) => !isNaN(n)))
          s.padding = [parts[0], parts[1], parts[2], parts[3]];
        break;
      }
      case "padding-top": {
        const n = parseFloat(v);
        if (!isNaN(n)) {
          const p = s.padding ?? [0, 0, 0, 0];
          s.padding = [n, p[1], p[2], p[3]];
        }
        break;
      }
      case "padding-bottom": {
        const n = parseFloat(v);
        if (!isNaN(n)) {
          const p = s.padding ?? [0, 0, 0, 0];
          s.padding = [p[0], p[1], n, p[3]];
        }
        break;
      }
      case "padding-left": {
        const n = parseFloat(v);
        if (!isNaN(n)) {
          const p = s.padding ?? [0, 0, 0, 0];
          s.padding = [p[0], p[1], p[2], n];
        }
        break;
      }
      case "padding-right": {
        const n = parseFloat(v);
        if (!isNaN(n)) {
          const p = s.padding ?? [0, 0, 0, 0];
          s.padding = [p[0], n, p[2], p[3]];
        }
        break;
      }
      case "width": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.width = n;
        break;
      }
    }
  }
  return s;
}

function tagStyles(tag: string | undefined): Partial<Styles> {
  switch (tag) {
    case "h1":
      return { fontWeight: "bold", fontSize: 22, padding: [8, 0, 6, 0] };
    case "h2":
      return { fontWeight: "bold", fontSize: 18, padding: [6, 0, 4, 0] };
    case "h3":
      return { fontWeight: "bold", fontSize: 15, padding: [5, 0, 3, 0] };
    case "h4":
      return { fontWeight: "bold", fontSize: 13, padding: [4, 0, 2, 0] };
    case "h5":
      return { fontWeight: "bold", fontSize: 12, padding: [3, 0, 2, 0] };
    case "h6":
      return { fontWeight: "bold", fontSize: 11, padding: [3, 0, 1, 0] };
    case "strong":
    case "b":
      return { fontWeight: "bold" };
    case "em":
    case "i":
      return { fontStyle: "italic" };
    case "td":
      return { padding: [6, 8, 6, 8] };
    // FIX: separate th case so bold is not shadowed
    case "th":
      return { fontWeight: "bold", padding: [6, 8, 6, 8] };
    case "p":
      return { padding: [4, 0, 4, 0] };
    case "li":
      return { padding: [2, 0, 2, 0] };
    case "blockquote":
      return { fontStyle: "italic", padding: [4, 0, 4, 20] };
    case "code":
    case "pre":
      return { fontFamily: "monospace", fontSize: 9 };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// HTML Parser — fixed: closing-tag regex now operates on substring(pos)
// ---------------------------------------------------------------------------
function parseHtml(html: string): PdfNode[] {
  const root: PdfNode[] = [];
  let pos = 0;
  const stack: PdfNode[] = [];

  function currentParent(): PdfNode | null {
    return stack.length > 0 ? stack[stack.length - 1] : null;
  }

  function addNode(node: PdfNode) {
    const parent = currentParent();
    if (parent) parent.children.push(node);
    else root.push(node);
  }

  function extractAttrs(raw: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrRe = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = attrRe.exec(raw)) !== null) {
      attrs[m[1].toLowerCase()] = m[2];
    }
    const singleRe = /(\w[\w-]*)\s*=\s*'([^']*)'/g;
    while ((m = singleRe.exec(raw)) !== null) {
      attrs[m[1].toLowerCase()] = m[2];
    }
    const boolRe =
      /\b(checked|selected|disabled|readonly|required|multiple|autofocus|hidden)\b/gi;
    while ((m = boolRe.exec(raw)) !== null) {
      attrs[m[1].toLowerCase()] = "";
    }
    return attrs;
  }

  while (pos < html.length) {
    const nextOpen = html.indexOf("<", pos);

    if (nextOpen === -1) {
      const text = html.substring(pos).trim();
      if (text) {
        addNode({
          type: "text",
          children: [],
          text,
          styles: { ...DEFAULT_STYLES },
        });
      }
      break;
    }

    if (nextOpen > pos) {
      const text = html.substring(pos, nextOpen);
      const trimmed = text.trim();
      if (trimmed) {
        addNode({
          type: "text",
          children: [],
          text: trimmed,
          styles: { ...DEFAULT_STYLES },
        });
      }
    }

    // FIX: apply closing-tag regex to html.substring(pos), not the full string
    const remaining = html.substring(nextOpen);

    const commentMatch = remaining.match(/^<!--[\s\S]*?-->/);
    if (commentMatch) {
      pos = nextOpen + commentMatch[0].length;
      continue;
    }

    const closeMatch = remaining.match(/^<\s*\/\s*(\w+)\s*>/);
    if (closeMatch) {
      const tag = closeMatch[1].toLowerCase();
      // pop the stack until we find the matching open tag
      for (let si = stack.length - 1; si >= 0; si--) {
        if (stack[si].tag === tag) {
          stack.splice(si);
          break;
        }
      }
      pos = nextOpen + closeMatch[0].length;
      continue;
    }

    const tagMatch = remaining.match(/^<(\w[\w-]*)([^>]*?)\/?\s*>/);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const rawAttrs = tagMatch[2];
      const attrs = extractAttrs(rawAttrs);
      const selfClosing = !!(
        tagMatch[0].endsWith("/>") ||
        [
          "br",
          "hr",
          "img",
          "input",
          "meta",
          "link",
          "area",
          "base",
          "col",
          "embed",
          "source",
          "track",
          "wbr",
        ].includes(tag)
      );

      const node: PdfNode = {
        type: "element",
        tag,
        attrs,
        children: [],
        styles: { ...DEFAULT_STYLES },
      };

      const styleOverride = parseStyles(attrs.style);
      node.styles = mergeStyles(
        { ...DEFAULT_STYLES, ...tagStyles(tag) },
        styleOverride,
      );

      if (tag === "body" || tag === "html") {
        node.styles = mergeStyles(node.styles, { padding: [0, 0, 0, 0] });
      }

      if (tag === "center") {
        node.styles = mergeStyles(node.styles, { textAlign: "center" });
      }

      addNode(node);

      if (!selfClosing) {
        stack.push(node);
      }

      pos = nextOpen + tagMatch[0].length;
      continue;
    }

    // unrecognised '<', skip it
    pos = nextOpen + 1;
  }

  return root;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

function findFont(ctx: RenderCtx, styles: Styles): PDFFont {
  const bold = styles.fontWeight === "bold";
  const italic = styles.fontStyle === "italic";
  if (
    styles.fontFamily === "monospace" ||
    styles.fontFamily?.includes("mono") ||
    styles.fontFamily?.includes("courier")
  ) {
    if (bold) return ctx.fonts.monoBold;
    return ctx.fonts.mono;
  }
  if (bold && italic) return ctx.fonts.boldItalic;
  if (bold) return ctx.fonts.bold;
  if (italic) return ctx.fonts.italic;
  return ctx.fonts.regular;
}

function computeFontSize(styles: Styles, defaultSize: number): number {
  return styles.fontSize ?? defaultSize;
}

function ensureSpace(ctx: RenderCtx, needed: number) {
  if (ctx.y - needed < ctx.marginBottom) {
    const newPage = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
    ctx.page = newPage;
    ctx.y = ctx.pageHeight - ctx.marginTop;
    ctx.pageNum++;
  }
}

function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  if (!text) return [];
  const lines: string[] = [];
  const words = text.split(" ");
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

// ---------------------------------------------------------------------------
// FIX: renderTextContent — draw each wrapped line at the current ctx.y,
// advancing ctx.y after each line. The `y` param is now unused (kept for
// compat) because ctx.y is the single source of truth.
// ---------------------------------------------------------------------------
function renderTextContent(
  ctx: RenderCtx,
  text: string,
  styles: Styles,
  x: number,
  _y: number,
  maxWidth: number,
): number {
  if (!text) return 0;
  const font = findFont(ctx, styles);
  const size = computeFontSize(styles, 11);
  const lineH = size + 3;
  const color = styles.color ?? BLACK;

  const lines = wrapText(text, font, size, maxWidth);
  let totalH = 0;

  for (const line of lines) {
    ensureSpace(ctx, lineH);

    const w = font.widthOfTextAtSize(line, size);
    let lx = x;
    if (styles.textAlign === "center") lx = x + (maxWidth - w) / 2;
    else if (styles.textAlign === "right") lx = x + maxWidth - w;

    ctx.page.drawText(line, {
      x: lx,
      y: ctx.y - size,
      size,
      font,
      color: rgb(color[0], color[1], color[2]),
    });
    ctx.y -= lineH;
    totalH += lineH;
  }

  return totalH;
}

// ---------------------------------------------------------------------------
// Node renderer
// ---------------------------------------------------------------------------
function renderNode(
  ctx: RenderCtx,
  node: PdfNode,
  x: number,
  maxWidth: number,
): number {
  if (node.type === "text" && node.text) {
    const lines = node.text.split("\n");
    let totalHeight = 0;
    for (const line of lines) {
      if (line.trim() === "") {
        ctx.y -= 8;
        totalHeight += 8;
        continue;
      }
      const h = renderTextContent(ctx, line, node.styles, x, ctx.y, maxWidth);
      totalHeight += h;
    }
    return totalHeight;
  }

  if (node.type === "element") {
    const tag = node.tag!;

    if (tag === "br") {
      ctx.y -= 10;
      return 10;
    }

    if (tag === "hr") {
      ensureSpace(ctx, 20);
      ctx.y -= 10;
      drawLine(ctx, x, ctx.y, x + maxWidth, ctx.y, [0.7, 0.7, 0.7], 0.5);
      ctx.y -= 10;
      return 20;
    }

    if (tag === "table") {
      return renderTable(ctx, node, x, maxWidth);
    }

    if (tag === "ul" || tag === "ol") {
      return renderList(ctx, node, x, maxWidth, tag === "ol");
    }

    if (tag === "pre") {
      return renderPre(ctx, node, x, maxWidth);
    }

    if (tag === "blockquote") {
      if (node.children.length === 0) return 0;
      const indent = 20;
      ensureSpace(ctx, 10);

      const quoteY = ctx.y + 2;
      ctx.y -= 2;

      let totalH = 0;
      const innerX = x + indent;

      for (const child of node.children) {
        const h = renderNode(ctx, child, innerX, maxWidth - indent);
        totalH += h;
      }

      const quoteH = Math.abs(ctx.y - quoteY) + 4;
      drawLine(ctx, x, quoteY, x, quoteY - quoteH, [0.6, 0.6, 0.6], 2);
      ctx.y -= 4;
      return totalH + 4;
    }

    const style = node.styles;
    const [pt, pr, pb, pl] = style.padding;

    const contentX = x + pl;
    const contentW = maxWidth - pl - pr;

    if (style.bgColor) {
      ensureSpace(ctx, 8);
      const startY = ctx.y;

      for (const child of node.children) {
        renderNode(ctx, child, contentX, contentW);
      }

      const rectH = Math.abs(ctx.y - startY) + 4;
      const rectY = ctx.y;

      if (
        tag === "div" ||
        tag === "p" ||
        ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)
      ) {
        drawRects(ctx, x, rectY - 2, maxWidth, rectH, style.bgColor);
      }

      return rectH;
    }

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      ensureSpace(ctx, computeFontSize(style, 16) + 12);
      ctx.y -= pt;
      for (const child of node.children) {
        renderNode(ctx, child, contentX, contentW);
      }
      ctx.y -= pb + 2;
      return pt + pb + computeFontSize(style, 16) + 6;
    }

    if (tag === "p" || tag === "div" || tag === "span") {
      if (node.children.length === 0) return 0;
      ctx.y -= pt;
      for (const child of node.children) {
        renderNode(ctx, child, contentX, contentW);
      }
      ctx.y -= pb;
      return pt + pb;
    }

    if (
      [
        "strong",
        "b",
        "em",
        "i",
        "code",
        "u",
        "a",
        "s",
        "del",
        "sup",
        "sub",
      ].includes(tag)
    ) {
      for (const child of node.children) {
        if (child.type === "text" && child.text) {
          child.styles = mergeStyles(child.styles, tagStyles(tag));
          child.styles = mergeStyles(child.styles, {
            color: style.color ?? child.styles.color,
          });
          renderNode(ctx, child, x, maxWidth);
        } else {
          renderNode(ctx, child, x, maxWidth);
        }
      }
      return 0;
    }

    for (const child of node.children) {
      renderNode(ctx, child, x, maxWidth);
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Pre / code block
// ---------------------------------------------------------------------------
function renderPre(
  ctx: RenderCtx,
  node: PdfNode,
  x: number,
  maxWidth: number,
): number {
  ensureSpace(ctx, 12);

  const bgY = ctx.y;
  const bgColor: RgbColor = [0.95, 0.95, 0.97];

  const indent = 10;
  ctx.y -= 6;

  for (const child of node.children) {
    if (child.type === "element" && child.tag === "code") {
      for (const c of child.children) {
        if (c.type === "text" && c.text) {
          c.styles = mergeStyles(c.styles, {
            fontFamily: "monospace",
            fontSize: 9,
            color: [0.15, 0.15, 0.2],
          });
          const lines = c.text.split("\n");
          for (const line of lines) {
            renderTextContent(
              ctx,
              line,
              c.styles,
              x + indent,
              ctx.y,
              maxWidth - indent * 2,
            );
          }
        }
      }
    } else if (child.type === "text" && child.text) {
      child.styles = mergeStyles(child.styles, {
        fontFamily: "monospace",
        fontSize: 9,
        color: [0.15, 0.15, 0.2],
      });
      const lines = child.text.split("\n");
      for (const line of lines) {
        renderTextContent(
          ctx,
          line,
          child.styles,
          x + indent,
          ctx.y,
          maxWidth - indent * 2,
        );
      }
    } else {
      renderNode(ctx, child, x + indent, maxWidth - indent * 2);
    }
  }

  ctx.y -= 6;
  const rectH = Math.abs(ctx.y - bgY) + 2;
  drawRects(ctx, x, bgY - 2, maxWidth, rectH, bgColor);

  return rectH + 4;
}

// ---------------------------------------------------------------------------
// Table rendering — fixed: per-cell text wrapping + dynamic row height
// ---------------------------------------------------------------------------
function computeColWidths(rows: RowData[], maxWidth: number): number[] {
  if (rows.length === 0) return [maxWidth];

  const colCount = Math.max(...rows.map((r) => r.cells.length));
  if (colCount === 0) return [maxWidth];

  // Base widths: use a rough character-width estimate
  const colWidths = new Array(colCount).fill(0);

  for (const row of rows) {
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      const size = cell.styles.fontSize ?? 10;
      // 0.55 is a conservative character-width ratio for Helvetica
      const w = cell.text.length * size * 0.55 + 20; // +20 for padding
      if (w > colWidths[i]) colWidths[i] = w;
    }
  }

  const total = colWidths.reduce((a, b) => a + b, 0);
  if (total > maxWidth) {
    const ratio = maxWidth / total;
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] = Math.max(40, Math.floor(colWidths[i] * ratio));
    }
    // Re-normalise after flooring
    const newTotal = colWidths.reduce((a, b) => a + b, 0);
    if (newTotal < maxWidth)
      colWidths[colWidths.length - 1] += maxWidth - newTotal;
  } else if (total < maxWidth) {
    const extra = maxWidth - total;
    const add = Math.floor(extra / colCount);
    for (let i = 0; i < colWidths.length; i++) colWidths[i] += add;
    colWidths[colWidths.length - 1] +=
      maxWidth - colWidths.reduce((a, b) => a + b, 0);
  }

  return colWidths;
}

function parseTable(node: PdfNode): TableData | null {
  const rows: RowData[] = [];

  function processCell(el: PdfNode): string {
    let text = "";
    for (const c of el.children) {
      if (c.type === "text" && c.text) text += c.text;
      else if (c.type === "element") text += processCell(c);
    }
    return text;
  }

  function processTr(el: PdfNode) {
    if (el.tag !== "tr") return;
    const cells: CellData[] = [];

    for (const child of el.children) {
      if (child.type !== "element") continue;
      if (child.tag !== "td" && child.tag !== "th") continue;

      const text = processCell(child);
      const cellStyles = child.styles;
      const colSpan = parseInt(child.attrs?.colspan || "1", 10);
      const rowSpan = parseInt(child.attrs?.rowspan || "1", 10);

      cells.push({
        text,
        styles: cellStyles,
        colspan: colSpan,
        rowspan: rowSpan,
      });
    }

    if (cells.length > 0) {
      const isHeader =
        el.children.some((c) => c.type === "element" && c.tag === "th") ||
        false;
      rows.push({ cells, isHeader, height: 0 });
    }
  }

  function processSection(el: PdfNode) {
    for (const c of el.children) {
      if (c.type === "element" && c.tag === "tr") {
        processTr(c);
      } else if (
        c.type === "element" &&
        ["thead", "tbody", "tfoot"].includes(c.tag || "")
      ) {
        processSection(c);
      }
    }
  }

  processSection(node);
  if (rows.length === 0) return null;
  return { rows, colWidths: [], totalWidth: 0 };
}

/**
 * Estimate how many lines a cell's text will wrap to, given a column width.
 */
function estimateWrappedLineCount(
  text: string,
  font: PDFFont,
  size: number,
  colWidth: number,
  padH: number,
): number {
  const usable = colWidth - padH * 2;
  if (usable <= 0 || !text) return 1;
  const lines = wrapText(text, font, size, usable);
  return Math.max(1, lines.length);
}

function renderTable(
  ctx: RenderCtx,
  node: PdfNode,
  x: number,
  maxWidth: number,
): number {
  const table = parseTable(node);
  if (!table || table.rows.length === 0) return 0;

  const borderColor: RgbColor = [0.75, 0.75, 0.78];
  const headerBg: RgbColor = [0.15, 0.35, 0.85];
  const headerTextColor: RgbColor = [1, 1, 1];
  const altRowBg: RgbColor = [0.97, 0.97, 0.98];

  ensureSpace(ctx, 20);

  const colWidths = computeColWidths(table.rows, maxWidth);
  const padH = 6; // horizontal cell padding (each side)
  const padV = 5; // vertical cell padding (each side)
  const baseLineH = 12; // line-height per text line in a cell

  const startY = ctx.y;

  for (let ri = 0; ri < table.rows.length; ri++) {
    const row = table.rows[ri];

    // --- Compute dynamic row height based on worst-case wrapped line count ---
    let maxLines = 1;
    for (let ci = 0; ci < row.cells.length && ci < colWidths.length; ci++) {
      const cell = row.cells[ci];
      const font = row.isHeader ? ctx.fonts.bold : findFont(ctx, cell.styles);
      const size = computeFontSize(cell.styles, row.isHeader ? 11 : 10);
      const lineCount = estimateWrappedLineCount(
        cell.text,
        font,
        size,
        colWidths[ci],
        padH,
      );
      if (lineCount > maxLines) maxLines = lineCount;
    }
    const cellH = maxLines * baseLineH + padV * 2;

    // Page-break before this row if it won't fit
    if (ctx.y - cellH < ctx.marginBottom) {
      const newPage = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
      ctx.page = newPage;
      ctx.y = ctx.pageHeight - ctx.marginTop;
      ctx.pageNum++;
    }

    const rowTop = ctx.y; // top edge of the row in PDF coordinates
    const rowBottom = rowTop - cellH;

    for (let ci = 0; ci < row.cells.length && ci < colWidths.length; ci++) {
      const cell = row.cells[ci];
      const cellW = colWidths[ci];
      const cellX = x + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);

      // Draw background
      if (row.isHeader) {
        drawRects(ctx, cellX, rowBottom, cellW, cellH, headerBg);
      } else if (ri % 2 === 0) {
        drawRects(ctx, cellX, rowBottom, cellW, cellH, altRowBg);
      }

      // Choose font and color
      const textColor: RgbColor = row.isHeader
        ? headerTextColor
        : cell.styles.color ?? BLACK;
      const font = row.isHeader ? ctx.fonts.bold : findFont(ctx, cell.styles);
      const size = computeFontSize(cell.styles, row.isHeader ? 11 : 10);
      const align: "left" | "center" | "right" =
        (cell.styles.textAlign as "left" | "center" | "right") ??
        (ci === colWidths.length - 1 ? "right" : "left");

      const textX = cellX + padH;
      const textMaxW = cellW - padH * 2;

      // Wrap text and draw each line at the correct vertical position
      const lines = wrapText(cell.text, font, size, textMaxW);
      const totalTextH = lines.length * baseLineH;
      // Vertically centre the text block within the cell
      let lineY = rowTop - (cellH - totalTextH) / 2 - size;

      for (const line of lines) {
        const lw = font.widthOfTextAtSize(line, size);
        let lx = textX;
        if (align === "center") lx = textX + (textMaxW - lw) / 2;
        else if (align === "right") lx = textX + textMaxW - lw;

        ctx.page.drawText(line, {
          x: lx,
          y: lineY,
          size,
          font,
          color: rgb(textColor[0], textColor[1], textColor[2]),
        });
        lineY -= baseLineH;
      }

      // Cell borders
      drawLine(
        ctx,
        cellX,
        rowBottom,
        cellX + cellW,
        rowBottom,
        borderColor,
        0.5,
      );
      drawLine(ctx, cellX, rowTop, cellX + cellW, rowTop, borderColor, 0.5);
      drawLine(ctx, cellX, rowBottom, cellX, rowTop, borderColor, 0.5);
      if (ci === row.cells.length - 1 || ci === colWidths.length - 1) {
        drawLine(
          ctx,
          cellX + cellW,
          rowBottom,
          cellX + cellW,
          rowTop,
          borderColor,
          0.5,
        );
      }
    }

    ctx.y = rowBottom;
  }

  return Math.abs(ctx.y - startY);
}

// ---------------------------------------------------------------------------
// List rendering
// ---------------------------------------------------------------------------
function renderList(
  ctx: RenderCtx,
  node: PdfNode,
  x: number,
  maxWidth: number,
  ordered: boolean,
): number {
  let totalH = 0;
  let index = 1;

  for (const child of node.children) {
    if (child.type === "element" && child.tag === "li") {
      ensureSpace(ctx, 16);

      const bullet = ordered ? `${index}.` : "\u2022";
      const bulletX = x + 10;
      const textX = x + 24;

      ctx.page.drawText(bullet, {
        x: bulletX,
        y: ctx.y - 12,
        size: 11,
        font: ctx.fonts.regular,
        color: rgb(0.3, 0.3, 0.3),
      });

      if (child.children.length > 0) {
        const firstChild = child.children[0];
        if (firstChild.type === "text" && firstChild.text) {
          renderTextContent(
            ctx,
            firstChild.text,
            mergeStyles(firstChild.styles, {}),
            textX,
            ctx.y,
            maxWidth - 24,
          );
        } else {
          for (const c of child.children) {
            renderNode(ctx, c, textX, maxWidth - 24);
          }
        }
      }

      ctx.y -= 4;
      index++;
    } else if (child.type === "text" && child.text?.trim()) {
      renderTextContent(ctx, child.text, child.styles, x, ctx.y, maxWidth);
    } else {
      const h = renderNode(ctx, child, x, maxWidth);
      totalH += h;
    }
  }

  return totalH;
}

// ---------------------------------------------------------------------------
// Helper drawing functions
// ---------------------------------------------------------------------------
function drawRects(
  ctx: RenderCtx,
  x: number,
  y: number,
  w: number,
  h: number,
  color: RgbColor,
) {
  ctx.page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: rgb(color[0], color[1], color[2]),
  });
}

function drawLine(
  ctx: RenderCtx,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: RgbColor,
  thickness: number,
) {
  ctx.page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(color[0], color[1], color[2]),
  });
}

// ---------------------------------------------------------------------------
// Header / footer
// ---------------------------------------------------------------------------
function renderFooter(ctx: RenderCtx, text: string) {
  const font = ctx.fonts.regular;
  const size = 9;
  const footerText = text
    .replace("{page}", String(ctx.pageNum))
    .replace("{total}", String(ctx.totalPages));
  const w = font.widthOfTextAtSize(footerText, size);
  const fx = (ctx.pageWidth - w) / 2;

  ctx.page.drawText(footerText, {
    x: fx,
    y: ctx.marginBottom - 15,
    size,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

function renderHeader(ctx: RenderCtx, text: string) {
  const font = ctx.fonts.regular;
  const size = 9;
  const headerText = text
    .replace("{page}", String(ctx.pageNum))
    .replace("{total}", String(ctx.totalPages));
  const w = font.widthOfTextAtSize(headerText, size);
  const fx = (ctx.pageWidth - w) / 2;

  ctx.page.drawText(headerText, {
    x: fx,
    y: ctx.pageHeight - ctx.marginTop + 8,
    size,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function renderHtmlToPdf(
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
  const {
    pageSize = "A4",
    orientation = "portrait",
    marginTop = 50,
    marginRight = 50,
    marginBottom = 50,
    marginLeft = 50,
    headerText = "",
    footerText = "",
  } = options;

  const doc = await PDFDocument.create();
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await doc.embedFont(
    StandardFonts.HelveticaBoldOblique,
  );
  const monoFont = await doc.embedFont(StandardFonts.Courier);
  const monoBoldFont = await doc.embedFont(StandardFonts.CourierBold);

  let [pageWidth, pageHeight] = PAGE_SIZES[pageSize] ?? PAGE_SIZES.A4;
  if (orientation === "landscape") {
    [pageWidth, pageHeight] = [pageHeight, pageWidth];
  }

  const page = doc.addPage([pageWidth, pageHeight]);

  const ctx: RenderCtx = {
    doc,
    page,
    fonts: {
      regular: regularFont,
      bold: boldFont,
      italic: italicFont,
      boldItalic: boldItalicFont,
      mono: monoFont,
      monoBold: monoBoldFont,
    },
    y: pageHeight - marginTop,
    pageWidth,
    pageHeight,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    pageNum: 1,
    totalPages: 1,
  };

  const nodes = parseHtml(html);

  for (const node of nodes) {
    renderNode(ctx, node, marginLeft, pageWidth - marginLeft - marginRight);
  }

  // Draw header/footer on every page
  ctx.totalPages = ctx.doc.getPageCount();
  for (let i = 0; i < ctx.totalPages; i++) {
    ctx.page = ctx.doc.getPages()[i];
    ctx.pageNum = i + 1;
    if (footerText) renderFooter(ctx, footerText);
    if (headerText) renderHeader(ctx, headerText);
  }

  return doc.save();
}
