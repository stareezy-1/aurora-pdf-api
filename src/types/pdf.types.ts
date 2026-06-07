// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export type PageSize = "A4" | "Letter" | "Legal";
export type Orientation = "portrait" | "landscape";
export type FontFamily = "Helvetica" | "Courier" | "TimesRoman";
export type Alignment = "left" | "center" | "right";
export type SummaryStyle = "normal" | "positive" | "negative" | "bold";

interface BasePageConfig {
  pageSize?: PageSize;
  orientation?: Orientation;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;
  headerText?: string;
  footerText?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// /create  —  plain text → PDF
// ─────────────────────────────────────────────────────────────────────────────

export interface TextToPdfRequest {
  text: string;
  config?: BasePageConfig & {
    fontFamily?: FontFamily;
    fontSize?: number;
    lineSpacing?: number;
    textColor?: string;
    backgroundColor?: string;
    showPageNumbers?: boolean;
    alignment?: Alignment;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// /create-from-html
// ─────────────────────────────────────────────────────────────────────────────

export interface HtmlToPdfRequest {
  html: string;
  config?: BasePageConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// /create-from-markdown
// ─────────────────────────────────────────────────────────────────────────────

export interface MarkdownToPdfRequest {
  markdown: string;
  theme?: "light" | "dark" | "github";
  config?: BasePageConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// /report  —  Finary-style multi-section financial report
// ─────────────────────────────────────────────────────────────────────────────

export interface ReportKpi {
  label: string;
  value: string | number;
  /** e.g. "+12.4%" or "-3.2%"  shown in a third column */
  change?: string;
  /** colour the change value: "positive" = green, "negative" = red */
  changeStyle?: "positive" | "negative" | "neutral";
}

export interface ReportSection {
  /** Section heading — rendered as a bold <h2> */
  title: string;
  /** Optional paragraph shown below the heading */
  description?: string;
  /** Bullet-point list items (for AI insights / notes) */
  bullets?: string[];
  /** Standard table */
  table?: {
    headers: string[];
    rows: (string | number)[][];
    /** hex colour for header row background, defaults to config.accentColor */
    headerColor?: string;
  };
}

export interface ReportSummaryRow {
  label: string;
  value: string | number;
  style?: SummaryStyle;
}

export interface ReportRequest {
  /** Brand / company name shown at the very top */
  brand?: string;
  /** Main report title */
  title?: string;
  /** Date range or subtitle line */
  subtitle?: string;
  /** Optional short intro paragraph shown below the KPI block */
  description?: string;
  /** KPI highlight block (net worth, savings, portfolio…) */
  kpis?: ReportKpi[];
  /** Ordered list of content sections */
  sections?: ReportSection[];
  /** Footer totals / balance summary */
  summary?: ReportSummaryRow[];
  config?: BasePageConfig & {
    currency?: string;
    locale?: string;
    /** Primary accent colour (table headers, KPI bg). Default #22c55e (green) */
    accentColor?: string;
    /** Show "Generated on …" line. Default true */
    showGeneratedAt?: boolean;
    /**
     * Public URL or base64 data-URI of the logo image (PNG or JPEG).
     * e.g. "https://example.com/logo.png"  or  "data:image/png;base64,iVBO…"
     */
    logoUrl?: string;
    /**
     * Which side of the page header the logo appears on.
     * Default: "left"
     */
    logoPosition?: "left" | "right";
    /**
     * Copyright owner name shown in the footer.
     * e.g. "Acme Corp"  →  "© 2026 Acme Corp. All rights reserved."
     */
    copyrightOwner?: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// /compress
// ─────────────────────────────────────────────────────────────────────────────

export interface CompressConfig {
  algorithm?: "condense" | "photon";
  removeMetadata?: boolean;
  removeThumbnails?: boolean;
  removeUnusedObjects?: boolean;
  subsetFonts?: boolean;
  dpi?: 72 | 96 | 150 | 300;
  greyscale?: boolean;
  jpegQuality?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// /invoice
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  /** Override total if needed (otherwise quantity × unitPrice) */
  total?: number;
}

export interface InvoiceRequest {
  invoiceNumber: string;
  /** ISO date string e.g. "2025-06-01" */
  date: string;
  /** ISO date string */
  dueDate?: string;
  from: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  to: {
    name: string;
    address?: string;
    email?: string;
  };
  items: InvoiceLineItem[];
  /** Extra charges after subtotal, e.g. shipping */
  extraCharges?: { label: string; amount: number }[];
  /** Tax rate 0-100, applied to subtotal */
  taxRate?: number;
  /** Discount amount (absolute, applied before tax) */
  discount?: number;
  currency?: string;
  locale?: string;
  notes?: string;
  /** Hex colour for header accent. Default #1e40af */
  accentColor?: string;
  config?: BasePageConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// /receipt
// ─────────────────────────────────────────────────────────────────────────────

export interface ReceiptItem {
  name: string;
  qty?: number;
  price: number;
}

export interface ReceiptRequest {
  storeName: string;
  storeAddress?: string;
  receiptNumber?: string;
  date?: string;
  items: ReceiptItem[];
  taxRate?: number;
  discount?: number;
  currency?: string;
  locale?: string;
  paymentMethod?: string;
  notes?: string;
  /** Hex colour accent */
  accentColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// /letter
// ─────────────────────────────────────────────────────────────────────────────

export interface LetterRequest {
  /** Date shown at the top. Defaults to today */
  date?: string;
  from?: {
    name: string;
    title?: string;
    company?: string;
    address?: string;
    email?: string;
  };
  to?: {
    name: string;
    title?: string;
    company?: string;
    address?: string;
  };
  subject?: string;
  salutation?: string;
  /** Array of body paragraphs */
  body: string[];
  closing?: string;
  /** Name to appear in closing block */
  signatureName?: string;
  signatureTitle?: string;
  config?: BasePageConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// /certificate
// ─────────────────────────────────────────────────────────────────────────────

export interface CertificateRequest {
  /** "Certificate of Achievement", "Certificate of Completion", etc. */
  type?: string;
  title: string;
  /** "This certifies that" */
  preamble?: string;
  recipientName: string;
  /** "for successfully completing…" */
  description?: string;
  date?: string;
  issuerName?: string;
  issuerTitle?: string;
  /** Second signer */
  coIssuerName?: string;
  coIssuerTitle?: string;
  /** Primary accent hex. Default #1e40af */
  accentColor?: string;
  config?: BasePageConfig;
}
