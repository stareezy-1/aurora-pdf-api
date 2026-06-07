import { PDFDocument, PDFPage, StandardFonts, rgb, type PDFFont } from "pdf-lib";

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
const WHITE: RgbColor = [1, 1, 1];
const TRANSPARENT: RgbColor | null = null;

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

function fmt(v: string | undefined | null): string {
  return (v || "").trim();
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
        s.fontWeight = v === "bold" || v === "700" || v === "800" || v === "900" ? "bold" : "normal";
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
        const parts = v.split(" ").map(parseFloat);
        if (parts.length === 1 && !isNaN(parts[0])) s.padding = [parts[0], parts[0], parts[0], parts[0]];
        else if (parts.length === 2 && parts.every((n) => !isNaN(n))) s.padding = [parts[0], parts[1], parts[0], parts[1]];
        else if (parts.length === 4 && parts.every((n) => !isNaN(n))) s.padding = [parts[0], parts[1], parts[2], parts[3]];
        break;
      }
      case "padding-top": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.padding = [n, (s.padding || [0, 0, 0, 0])[1], (s.padding || [0, 0, 0, 0])[2], (s.padding || [0, 0, 0, 0])[3]];
        break;
      }
      case "padding-bottom": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.padding = [(s.padding || [0, 0, 0, 0])[0], (s.padding || [0, 0, 0, 0])[1], n, (s.padding || [0, 0, 0, 0])[3]];
        break;
      }
      case "padding-left": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.padding = [(s.padding || [0, 0, 0, 0])[0], (s.padding || [0, 0, 0, 0])[1], (s.padding || [0, 0, 0, 0])[2], n];
        break;
      }
      case "padding-right": {
        const n = parseFloat(v);
        if (!isNaN(n)) s.padding = [(s.padding || [0, 0, 0, 0])[0], n, (s.padding || [0, 0, 0, 0])[2], (s.padding || [0, 0, 0, 0])[3]];
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
    case "h1": return { fontWeight: "bold", fontSize: 24, padding: [8, 0, 4, 0] };
    case "h2": return { fontWeight: "bold", fontSize: 20, padding: [6, 0, 3, 0] };
    case "h3": return { fontWeight: "bold", fontSize: 16, padding: [5, 0, 2, 0] };
    case "h4": return { fontWeight: "bold", fontSize: 14, padding: [4, 0, 2, 0] };
    case "h5": return { fontWeight: "bold", fontSize: 12, padding: [3, 0, 1, 0] };
    case "h6": return { fontWeight: "bold", fontSize: 11, padding: [3, 0, 1, 0] };
    case "strong":
    case "b": return { fontWeight: "bold" };
    case "em":
    case "i": return { fontStyle: "italic" };
    case "th":
    case "td": return { padding: [6, 8, 6, 8] };
    case "th": return { fontWeight: "bold" };
    case "p": return { padding: [4, 0, 4, 0] };
    case "li": return { padding: [2, 0, 2, 0] };
    case "blockquote": return { fontStyle: "italic", padding: [4, 0, 4, 20] };
    case "code":
    case "pre": return { fontFamily: "monospace", fontSize: 9 };
    default: return {};
  }
}

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
    const boolRe = /\b(checked|selected|disabled|readonly|required|multiple|autofocus|hidden)\b/gi;
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
        addNode({ type: "text", children: [], text, styles: { ...DEFAULT_STYLES } });
      }
      break;
    }

    if (nextOpen > pos) {
      const text = html.substring(pos, nextOpen);
      const trimmed = text.trim();
      if (trimmed) {
        addNode({ type: "text", children: [], text: trimmed, styles: { ...DEFAULT_STYLES } });
      }
    }

    const closeMatch = html.match(/^<\s*\/\s*(\w+)\s*>/);
    if (closeMatch && html.indexOf("<", pos) === pos) {
      const tag = closeMatch[1].toLowerCase();
      if (stack.length > 0 && stack[stack.length - 1].tag === tag) {
        stack.pop();
      }
      pos += closeMatch[0].length;
      continue;
    }

    const commentMatch = html.substring(pos).match(/^<!--[\s\S]*?-->/);
    if (commentMatch) {
      pos += commentMatch[0].length;
      continue;
    }

    const tagMatch = html.substring(pos).match(/^<(\w[\w-]*)([^>]*?)\/?\s*>/);
    if (tagMatch) {
      const tag = tagMatch[1].toLowerCase();
      const rawAttrs = tagMatch[2];
      const attrs = extractAttrs(rawAttrs);
      const selfClosing = !!(tagMatch[0].endsWith("/>") || ["br", "hr", "img", "input", "meta", "link", "area", "base", "col", "embed", "source", "track", "wbr"].includes(tag));

      const node: PdfNode = {
        type: "element",
        tag,
        attrs,
        children: [],
        styles: { ...DEFAULT_STYLES },
      };

      const styleOverride = parseStyles(attrs.style);
      node.styles = mergeStyles({ ...DEFAULT_STYLES, ...tagStyles(tag) }, styleOverride);

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

      pos += tagMatch[0].length;
      continue;
    }

    pos++;
  }

  return root;
}

function textWidth(text: string, font: PDFFont, size: number): number {
  return font.widthOfTextAtSize(text, size);
}

function findFont(ctx: RenderCtx, styles: Styles): PDFFont {
  const bold = styles.fontWeight === "bold";
  const italic = styles.fontStyle === "italic";
  if (styles.fontFamily === "monospace" || styles.fontFamily?.includes("mono") || styles.fontFamily?.includes("courier")) {
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

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
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
  return lines;
}

interface TextRender {
  text: string;
  font: PDFFont;
  size: number;
  color: RgbColor;
  x: number;
  y: number;
  align: "left" | "center" | "right";
  width: number;
}

function arrangeText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
  align: "left" | "center" | "right",
  color: RgbColor,
  x: number,
  y: number,
): TextRender[] {
  const lines = wrapText(text, font, size, maxWidth);
  return lines.map((line) => {
    const w = font.widthOfTextAtSize(line, size);
    let lx = x;
    if (align === "center") lx = x + (maxWidth - w) / 2;
    else if (align === "right") lx = x + maxWidth - w;
    return { text: line, font, size, color, x: lx, y, align, width: w };
  });
}

function drawRects(ctx: RenderCtx, x: number, y: number, w: number, h: number, color: RgbColor) {
  ctx.page.drawRectangle({
    x, y, width: w, height: h, color: rgb(color[0], color[1], color[2]),
  });
}

function drawLine(ctx: RenderCtx, x1: number, y1: number, x2: number, y2: number, color: RgbColor, thickness: number) {
  ctx.page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness,
    color: rgb(color[0], color[1], color[2]),
  });
}

function drawBorders(ctx: RenderCtx, x: number, y: number, w: number, h: number, styles: Styles, borderColor: RgbColor = [0.8, 0.8, 0.8]) {
  if (styles.borderTop) drawLine(ctx, x, y, x + w, y, borderColor, 0.5);
  if (styles.borderBottom) drawLine(ctx, x, y + h, x + w, y + h, borderColor, 0.5);
  if (styles.borderLeft) drawLine(ctx, x, y, x, y + h, borderColor, 0.5);
  if (styles.borderRight) drawLine(ctx, x + w, y, x + w, y + h, borderColor, 0.5);
}

function renderTextContent(
  ctx: RenderCtx,
  text: string,
  styles: Styles,
  x: number,
  y: number,
  maxWidth: number,
): number {
  const font = findFont(ctx, styles);
  const size = computeFontSize(styles, 11);
  const renders = arrangeText(text, font, size, maxWidth, styles.textAlign, styles.color ?? BLACK, x, y);

  for (const r of renders) {
    ensureSpace(ctx, size + 2);
    if (ctx.y - (size + 2) < y - (renders.length * (size + 2))) {
      y = ctx.y;
    }
    ctx.page.drawText(r.text, {
      x: r.x,
      y: ctx.y,
      size: r.size,
      font: r.font,
      color: rgb(r.color[0], r.color[1], r.color[2]),
    });
    ctx.y -= size + 2;
  }

  return renders.length * (size + 2);
}

function renderNode(ctx: RenderCtx, node: PdfNode, x: number, maxWidth: number): number {
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

      const lineX = x + 3;
      const quoteY = ctx.y + 2;
      const children = node.children;
      let totalH = 0;
      const innerX = x + indent;

      ctx.y -= 2;

      for (const child of children) {
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
      let blockH = 0;
      const startY = ctx.y;

      ensureSpace(ctx, 8);

      for (const child of node.children) {
        const h = renderNode(ctx, child, contentX, contentW);
        blockH += h;
      }

      const rectH = Math.abs(ctx.y - startY) + 4;
      const rectY = ctx.y + (ctx.y > startY ? 0 : -(rectH - 4));

      if (tag === "div" || tag === "p" || ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
        drawRects(ctx, x + (pl > 0 ? pl : 0), rectY - 2, maxWidth - (pl > 0 ? pl : 0) - (pr > 0 ? pr : 0), rectH, style.bgColor);
      }

      ctx.y = rectY - 2;
      return rectH;
    }

    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag)) {
      ensureSpace(ctx, computeFontSize(style, 16) + 8);
      ctx.y -= pt;
      for (const child of node.children) {
        renderNode(ctx, child, contentX, contentW);
      }
      ctx.y -= pb;
      return pt + pb + computeFontSize(style, 16) + 4;
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

    if (["strong", "b", "em", "i", "code", "u", "a", "s", "del", "sup", "sub"].includes(tag)) {
      for (const child of node.children) {
        if (child.type === "text" && child.text) {
          child.styles = mergeStyles(child.styles, tagStyles(tag));
          child.styles = mergeStyles(child.styles, { color: style.color ?? child.styles.color });
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

function renderPre(ctx: RenderCtx, node: PdfNode, x: number, maxWidth: number): number {
  ensureSpace(ctx, 12);

  const bgY = ctx.y;
  const bgColor: RgbColor = [0.95, 0.95, 0.97];

  let totalH = 0;
  const indent = 10;
  ctx.y -= 6;

  for (const child of node.children) {
    if (child.type === "element" && child.tag === "code") {
      for (const c of child.children) {
        if (c.type === "text" && c.text) {
          c.styles = mergeStyles(c.styles, { fontFamily: "monospace", fontSize: 9, color: [0.15, 0.15, 0.2] });
          const lines = c.text.split("\n");
          for (const line of lines) {
            renderTextContent(ctx, line, c.styles, x + indent, ctx.y, maxWidth - indent * 2);
          }
        }
      }
    } else if (child.type === "text" && child.text) {
      child.styles = mergeStyles(child.styles, { fontFamily: "monospace", fontSize: 9, color: [0.15, 0.15, 0.2] });
      const lines = child.text.split("\n");
      for (const line of lines) {
        renderTextContent(ctx, line, child.styles, x + indent, ctx.y, maxWidth - indent * 2);
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

function computeColWidths(rows: RowData[], maxWidth: number): number[] {
  if (rows.length === 0) return [maxWidth];

  const colCount = Math.max(...rows.map((r) => r.cells.length));
  if (colCount === 0) return [maxWidth];

  const colWidths = new Array(colCount).fill(0);

  for (const row of rows) {
    for (let i = 0; i < row.cells.length; i++) {
      const cell = row.cells[i];
      const font = cell.styles.fontWeight === "bold" ? "bold" : "regular";
      const size = cell.styles.fontSize ?? 10;
      const w = cell.text.length * size * 0.5;
      if (w > colWidths[i]) colWidths[i] = w;
    }
  }

  const total = colWidths.reduce((a, b) => a + b, 0);
  if (total > maxWidth) {
    const ratio = maxWidth / total;
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] = Math.floor(colWidths[i] * ratio);
    }
  } else if (total < maxWidth) {
    const extra = maxWidth - total;
    const avgAdd = Math.floor(extra / colCount);
    for (let i = 0; i < colWidths.length; i++) {
      colWidths[i] += avgAdd;
    }
  }

  return colWidths;
}

function parseTable(node: PdfNode): TableData | null {
  const rows: RowData[] = [];
  let currentRow: RowData | null = null;

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
      const isHeader = el.children.some((c) => c.type === "element" && c.tag === "th") ||
        false;
      rows.push({ cells, isHeader, height: 0 });
    }
  }

  function processSection(el: PdfNode) {
    for (const c of el.children) {
      if (c.type === "element" && c.tag === "tr") {
        processTr(c);
      } else if (c.type === "element" && ["thead", "tbody", "tfoot"].includes(c.tag || "")) {
        processSection(c);
      }
    }
  }

  processSection(node);

  if (rows.length === 0) return null;

  return { rows, colWidths: [], totalWidth: 0 };
}

function renderTable(ctx: RenderCtx, node: PdfNode, x: number, maxWidth: number): number {
  const table = parseTable(node);
  if (!table || table.rows.length === 0) return 0;

  const borderColor: RgbColor = [0.75, 0.75, 0.78];
  const headerBg: RgbColor = [0.15, 0.35, 0.85];
  const headerTextColor: RgbColor = [1, 1, 1];
  const altRowBg: RgbColor = [0.97, 0.97, 0.98];

  ensureSpace(ctx, 20);

  const tableX = x;
  const colWidths = computeColWidths(table.rows, maxWidth);
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const lineH = 14;

  let startY = ctx.y;

  for (let ri = 0; ri < table.rows.length; ri++) {
    const row = table.rows[ri];
    const cellH = Math.max(lineH + 8, 22);

    if (ctx.y - cellH < ctx.marginBottom) {
      const newPage = ctx.doc.addPage([ctx.pageWidth, ctx.pageHeight]);
      ctx.page = newPage;
      ctx.y = ctx.pageHeight - ctx.marginTop;
      ctx.pageNum++;
    }

    const rowY = ctx.y;

    for (let ci = 0; ci < row.cells.length && ci < colWidths.length; ci++) {
      const cell = row.cells[ci];
      const cellW = colWidths[ci];
      const cellX = tableX + colWidths.slice(0, ci).reduce((a, b) => a + b, 0);

      if (row.isHeader) {
        drawRects(ctx, cellX, rowY - cellH, cellW, cellH, headerBg);
      } else if (ri % 2 === 0) {
        drawRects(ctx, cellX, rowY - cellH, cellW, cellH, altRowBg);
      }

      const textColor: RgbColor = row.isHeader ? headerTextColor : (cell.styles.color ?? BLACK);
      const font = row.isHeader ? ctx.fonts.bold : findFont(ctx, cell.styles);
      const size = computeFontSize(cell.styles, 10);
      const align = cell.styles.textAlign ?? (ci === colWidths.length - 1 ? "right" : "left");

      const pad = 6;
      const textX = cellX + pad;
      const textMaxW = cellW - pad * 2;
      const textY = rowY - cellH + 4;

      const renders = arrangeText(cell.text, font, size, textMaxW, align, textColor, textX, textY);

      for (const r of renders) {
        if (r.text) {
          ctx.page.drawText(r.text, {
            x: r.x,
            y: textY + 1,
            size: r.size,
            font: r.font,
            color: rgb(r.color[0], r.color[1], r.color[2]),
          });
        }
      }

      drawLine(ctx, cellX, rowY - cellH, cellX + cellW, rowY - cellH, borderColor, 0.5);
      drawLine(ctx, cellX, rowY, cellX + cellW, rowY, borderColor, 0.5);
      drawLine(ctx, cellX, rowY - cellH, cellX, rowY, borderColor, 0.5);
      if (ci === row.cells.length - 1 || ci === colWidths.length - 1) {
        drawLine(ctx, cellX + cellW, rowY - cellH, cellX + cellW, rowY, borderColor, 0.5);
      }
    }

    ctx.y -= cellH;

    if (ri < table.rows.length - 1) {
      ctx.y -= 0;
    }
  }

  return Math.abs(ctx.y - startY);
}

function renderList(ctx: RenderCtx, node: PdfNode, x: number, maxWidth: number, ordered: boolean): number {
  let totalH = 0;
  let index = 1;

  for (const child of node.children) {
    if (child.type === "element" && child.tag === "li") {
      ensureSpace(ctx, 16);

      const bullet = ordered ? `${index}.` : "\u2022";
      const font = ctx.fonts.regular;
      const bulletX = x + 10;
      const textX = x + 24;

      ctx.page.drawText(bullet, {
        x: bulletX,
        y: ctx.y - 4,
        size: 11,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });

      if (child.children.length > 0) {
        const firstChild = child.children[0];
        if (firstChild.type === "text" && firstChild.text) {
          const remaining = firstChild.text;
          renderTextContent(ctx, remaining, mergeStyles(firstChild.styles, {}), textX, ctx.y, maxWidth - 24);
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

function renderFooter(ctx: RenderCtx, text: string) {
  const font = ctx.fonts.regular;
  const size = 9;
  const footerText = text.replace("{page}", String(ctx.pageNum)).replace("{total}", String(ctx.totalPages));
  const w = font.widthOfTextAtSize(footerText, size);
  const x = (ctx.pageWidth - w) / 2;

  ctx.page.drawText(footerText, {
    x,
    y: ctx.marginBottom - 15,
    size,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

function renderHeader(ctx: RenderCtx, text: string) {
  const font = ctx.fonts.regular;
  const size = 9;
  const headerText = text.replace("{page}", String(ctx.pageNum)).replace("{total}", String(ctx.totalPages));
  const w = font.widthOfTextAtSize(headerText, size);
  const x = (ctx.pageWidth - w) / 2;

  ctx.page.drawText(headerText, {
    x,
    y: ctx.pageHeight - ctx.marginTop + 8,
    size,
    font,
    color: rgb(0.6, 0.6, 0.6),
  });
}

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
    marginTop = 40,
    marginRight = 40,
    marginBottom = 50,
    marginLeft = 40,
    headerText = "",
    footerText = "",
  } = options;

  const doc = await PDFDocument.create();
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalicFont = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
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

  ctx.totalPages = ctx.doc.getPageCount();

  for (let i = 0; i < ctx.totalPages; i++) {
    const p = ctx.doc.getPages()[i];
    ctx.page = p;
    ctx.pageNum = i + 1;
    if (footerText) renderFooter(ctx, footerText);
    if (headerText) renderHeader(ctx, headerText);
  }

  return doc.save();
}
