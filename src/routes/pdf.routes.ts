import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  textToPdf,
  htmlToPdf,
  markdownToPdf,
  compressPdf,
  reportToPdf,
  invoiceToPdf,
  receiptToPdf,
  letterToPdf,
  certificateToPdf,
} from "../services/pdf.service.js";
import type {
  TextToPdfRequest,
  HtmlToPdfRequest,
  MarkdownToPdfRequest,
  ReportRequest,
  InvoiceRequest,
  ReceiptRequest,
  LetterRequest,
  CertificateRequest,
} from "../types/pdf.types.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// ─── helper ──────────────────────────────────────────────────────────────────

function sendPdf(res: Response, bytes: Uint8Array, filename: string) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": bytes.length.toString(),
  });
  res.send(Buffer.from(bytes));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /create
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/create:
 *   post:
 *     summary: Plain text → PDF
 *     description: |
 *       Converts plain text to a PDF. Supports custom fonts, colors, alignment,
 *       margins, page size, header/footer, and auto page-number.
 *     tags: [Create]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text:
 *                 type: string
 *                 description: Content to render. Use \n for line breaks.
 *               config:
 *                 type: object
 *                 properties:
 *                   fontFamily:
 *                     type: string
 *                     enum: [Helvetica, Courier, TimesRoman]
 *                     default: Helvetica
 *                   fontSize:
 *                     type: number
 *                     default: 11
 *                   lineSpacing:
 *                     type: number
 *                     description: Line height multiplier
 *                     default: 1.5
 *                   alignment:
 *                     type: string
 *                     enum: [left, center, right]
 *                     default: left
 *                   textColor:
 *                     type: string
 *                     description: Hex color
 *                     default: "#1e293b"
 *                   backgroundColor:
 *                     type: string
 *                     description: Hex page background color
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     default: 55
 *                   marginRight:
 *                     type: number
 *                     default: 55
 *                   marginBottom:
 *                     type: number
 *                     default: 55
 *                   marginLeft:
 *                     type: number
 *                     default: 55
 *                   headerText:
 *                     type: string
 *                     description: Text shown at top of every page
 *                   footerText:
 *                     type: string
 *                     description: Text shown at bottom of every page
 *                   showPageNumbers:
 *                     type: boolean
 *                     default: false
 *                     description: Appends "N / Total" to footer text
 *           example:
 *             text: "Laporan Keuangan Bulan Juni 2026\n\nSaldo awal: Rp 10.000.000\nPemasukan: Rp 5.200.000\nPengeluaran: Rp 1.850.000\n\nSaldo akhir: Rp 13.350.000"
 *             config:
 *               fontFamily: Helvetica
 *               fontSize: 12
 *               lineSpacing: 1.6
 *               alignment: left
 *               textColor: "#1e293b"
 *               backgroundColor: "#ffffff"
 *               pageSize: A4
 *               orientation: portrait
 *               marginTop: 60
 *               marginRight: 55
 *               marginBottom: 60
 *               marginLeft: 55
 *               headerText: "Aurora PDF - Laporan Keuangan"
 *               footerText: "Rahasia"
 *               showPageNumbers: true
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/create", async (req: Request, res: Response) => {
  try {
    const body = req.body as TextToPdfRequest;
    if (!body.text) {
      res.status(400).json({ error: "text is required" });
      return;
    }
    sendPdf(res, await textToPdf(body), "document.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /create-from-html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/create-from-html:
 *   post:
 *     summary: HTML → PDF
 *     description: |
 *       Converts an HTML string to PDF. Supports tables, headings, lists,
 *       blockquotes, code blocks, and inline CSS styles.
 *
 *       **Supported tags:** h1–h6, p, div, span, table, thead, tbody, tr, th, td,
 *       ul, ol, li, blockquote, pre, code, strong, b, em, i, hr, br, a, s, u.
 *
 *       **Supported CSS properties (inline):** color, background-color, text-align,
 *       font-weight, font-style, font-size, font-family, padding.
 *
 *       Header/footer text supports `{page}` and `{total}` placeholders.
 *     tags: [Create]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [html]
 *             properties:
 *               html:
 *                 type: string
 *                 description: Full HTML string to render
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     default: 50
 *                   marginRight:
 *                     type: number
 *                     default: 50
 *                   marginBottom:
 *                     type: number
 *                     default: 50
 *                   marginLeft:
 *                     type: number
 *                     default: 50
 *                   headerText:
 *                     type: string
 *                     description: Supports {page} and {total}
 *                   footerText:
 *                     type: string
 *                     description: Supports {page} and {total}
 *           example:
 *             html: "<h1 style=\"color:#0f172a;\">Laporan Penjualan</h1><p>Periode: Juni 2026</p><table style=\"width:100%;border-collapse:collapse;\"><thead><tr style=\"background:#22c55e;color:white;\"><th style=\"padding:8px 12px;text-align:left;\">Produk</th><th style=\"padding:8px 12px;text-align:right;\">Qty</th><th style=\"padding:8px 12px;text-align:right;\">Harga</th><th style=\"padding:8px 12px;text-align:right;\">Total</th></tr></thead><tbody><tr style=\"background:#f8fafc;\"><td style=\"padding:7px 12px;\">Kopi Susu</td><td style=\"padding:7px 12px;text-align:right;\">50</td><td style=\"padding:7px 12px;text-align:right;\">Rp 25.000</td><td style=\"padding:7px 12px;text-align:right;font-weight:bold;\">Rp 1.250.000</td></tr><tr><td style=\"padding:7px 12px;\">Matcha Latte</td><td style=\"padding:7px 12px;text-align:right;\">30</td><td style=\"padding:7px 12px;text-align:right;\">Rp 32.000</td><td style=\"padding:7px 12px;text-align:right;font-weight:bold;\">Rp 960.000</td></tr></tbody></table>"
 *             config:
 *               pageSize: A4
 *               orientation: portrait
 *               marginTop: 50
 *               marginRight: 50
 *               marginBottom: 50
 *               marginLeft: 50
 *               headerText: "Aurora PDF"
 *               footerText: "Halaman {page} dari {total}"
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/create-from-html", async (req: Request, res: Response) => {
  try {
    const body = req.body as HtmlToPdfRequest;
    if (!body.html) {
      res.status(400).json({ error: "html is required" });
      return;
    }
    sendPdf(res, await htmlToPdf(body.html, body.config), "document.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /create-from-markdown
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/create-from-markdown:
 *   post:
 *     summary: Markdown → PDF
 *     description: |
 *       Converts a Markdown string to PDF with syntax support for headings,
 *       bold/italic, pipe tables, code blocks, lists, blockquotes, and horizontal rules.
 *
 *       **Themes:** `light` (default), `dark`, `github`
 *     tags: [Create]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [markdown]
 *             properties:
 *               markdown:
 *                 type: string
 *                 description: Markdown content
 *               theme:
 *                 type: string
 *                 enum: [light, dark, github]
 *                 default: light
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     default: 50
 *                   marginRight:
 *                     type: number
 *                     default: 50
 *                   marginBottom:
 *                     type: number
 *                     default: 50
 *                   marginLeft:
 *                     type: number
 *                     default: 50
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *           example:
 *             markdown: "# Laporan Keuangan Juni 2026\n\nRingkasan keuangan bulanan yang dihasilkan secara otomatis.\n\n---\n\n## Transaksi Terbaru\n\n| Tanggal | Keterangan | Kategori | Jumlah |\n|---------|-----------|----------|---------:|\n| 2026-06-01 | Gaji | Pemasukan | Rp 5.200.000 |\n| 2026-06-02 | Netflix | Langganan | -Rp 150.000 |\n| 2026-06-05 | Proyek Lepas | Pemasukan | Rp 1.250.000 |\n\n## Wawasan AI\n\n- Tabungan meningkat **23%** dibandingkan bulan lalu.\n- Pengeluaran langganan tetap rendah dan teroptimalkan.\n- Pertimbangkan untuk meningkatkan investasi sebesar 10%.\n\n> **Catatan:** Laporan ini dibuat secara otomatis oleh sistem AI."
 *             theme: light
 *             config:
 *               pageSize: A4
 *               orientation: portrait
 *               marginTop: 50
 *               marginRight: 50
 *               marginBottom: 50
 *               marginLeft: 50
 *               headerText: "Laporan Keuangan"
 *               footerText: "Halaman {page} dari {total}"
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/create-from-markdown", async (req: Request, res: Response) => {
  try {
    const body = req.body as MarkdownToPdfRequest;
    if (!body.markdown) {
      res.status(400).json({ error: "markdown is required" });
      return;
    }
    sendPdf(
      res,
      await markdownToPdf(body.markdown, body.theme ?? "light", body.config),
      "document.pdf",
    );
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /report
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/report:
 *   post:
 *     summary: Multi-section financial report PDF
 *     description: |
 *       Generates a professionally branded multi-page financial report with:
 *
 *       - **Header band** on every page — accent-color background, optional logo image
 *         (PNG/JPEG via URL or base64), brand name, report title, subtitle
 *       - **Footer band** on every page — copyright notice, custom text, Page N of M
 *       - **KPI metrics block** — key figures with optional change indicators
 *       - **Unlimited sections** — each can mix a heading, description paragraph,
 *         bullet list, and/or a data table
 *       - **Summary totals** — labeled rows with positive/negative/bold styles
 *
 *       **Currency defaults to IDR (Rp)** — pass `currency: "USD"` etc. to override.
 *
 *       **Supported currency codes:** IDR, USD, EUR, GBP, JPY, SGD, MYR, THB, PHP, AUD
 *       (or any raw symbol like "$", "€").
 *     tags: [Report]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:
 *                 type: string
 *                 description: Brand / company name shown in the page header band
 *               title:
 *                 type: string
 *                 description: Main report title shown in the page header band
 *               subtitle:
 *                 type: string
 *                 description: Date range or subtitle, shown bottom-right of header band
 *               description:
 *                 type: string
 *                 description: Introductory paragraph shown in the body (below KPIs)
 *               kpis:
 *                 type: array
 *                 description: Key performance indicators block
 *                 items:
 *                   type: object
 *                   required: [label, value]
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                     change:
 *                       type: string
 *                       description: Change indicator string e.g. "+12.4%"
 *                     changeStyle:
 *                       type: string
 *                       enum: [positive, negative, neutral]
 *                       description: Color of the change value
 *               sections:
 *                 type: array
 *                 description: Ordered content sections
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     bullets:
 *                       type: array
 *                       items:
 *                         type: string
 *                     table:
 *                       type: object
 *                       properties:
 *                         headers:
 *                           type: array
 *                           items:
 *                             type: string
 *                         rows:
 *                           type: array
 *                           items:
 *                             type: array
 *                             items:
 *                               oneOf:
 *                                 - type: string
 *                                 - type: number
 *                         headerColor:
 *                           type: string
 *                           description: Override header row color for this table
 *               summary:
 *                 type: array
 *                 description: Footer totals / balance rows
 *                 items:
 *                   type: object
 *                   required: [label, value]
 *                   properties:
 *                     label:
 *                       type: string
 *                     value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                     style:
 *                       type: string
 *                       enum: [normal, positive, negative, bold]
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     description: Defaults to header band height + 18
 *                   marginRight:
 *                     type: number
 *                     default: 50
 *                   marginBottom:
 *                     type: number
 *                     description: Defaults to footer band height + 18
 *                   marginLeft:
 *                     type: number
 *                     default: 50
 *                   currency:
 *                     type: string
 *                     description: "Currency code (IDR, USD, EUR, GBP, JPY, SGD, MYR, THB, PHP, AUD) or raw symbol (Rp, $, €)"
 *                     default: IDR
 *                   locale:
 *                     type: string
 *                     description: BCP 47 locale, auto-resolved from currency code
 *                     default: id-ID
 *                   accentColor:
 *                     type: string
 *                     description: Hex color for header band and table headers
 *                     default: "#22c55e"
 *                   logoUrl:
 *                     type: string
 *                     description: "Public HTTPS URL or base64 data-URI (data:image/png;base64,...) of PNG/JPEG logo"
 *                   logoPosition:
 *                     type: string
 *                     enum: [left, right]
 *                     default: left
 *                   copyrightOwner:
 *                     type: string
 *                     description: "Shown as © 2026 <owner>. All rights reserved. in the footer"
 *                   showGeneratedAt:
 *                     type: boolean
 *                     default: true
 *                   footerText:
 *                     type: string
 *                     description: Custom text rendered in the centre of the footer band
 *           example:
 *             brand: "Stareezy Finance"
 *             title: "Laporan Keuangan AI"
 *             subtitle: "Juni 2026"
 *             description: "Laporan keuangan bulanan profesional yang dihasilkan oleh sistem AI."
 *             kpis:
 *               - label: "Total Kekayaan"
 *                 value: "Rp 2.345.670.000"
 *                 change: "+12.4%"
 *                 changeStyle: positive
 *               - label: "Tabungan Bulan Ini"
 *                 value: "Rp 3.365.000"
 *                 change: "+15.4%"
 *                 changeStyle: positive
 *               - label: "Portofolio Investasi"
 *                 value: "Rp 850.000.000"
 *                 change: "+10.3%"
 *                 changeStyle: positive
 *             sections:
 *               - title: "Ringkasan Eksekutif"
 *                 description: "Selama periode pelaporan, portofolio menunjukkan pertumbuhan yang sehat dengan peningkatan total kekayaan bersih sebesar 12,4%. Pendapatan tetap stabil sementara pengeluaran terjaga dalam target anggaran."
 *               - title: "Transaksi Terbaru"
 *                 table:
 *                   headers: ["Tanggal", "Nama", "Kategori", "Jumlah"]
 *                   rows:
 *                     - ["2026-06-01", "Gaji", "Pemasukan", 5200000]
 *                     - ["2026-06-02", "Netflix", "Langganan", -150000]
 *                     - ["2026-06-03", "Starbucks", "Makanan & Minuman", -75000]
 *                     - ["2026-06-04", "Investasi ETF", "Investasi", -5000000]
 *                     - ["2026-06-05", "Proyek Lepas", "Pemasukan", 1250000]
 *                     - ["2026-06-06", "Tagihan Listrik", "Utilitas", -824000]
 *               - title: "Wawasan & Rekomendasi AI"
 *                 bullets:
 *                   - "Tabungan meningkat 23% dibandingkan bulan lalu."
 *                   - "Pengeluaran langganan tetap rendah dan teroptimalkan."
 *                   - "Dana darurat melebihi rekomendasi 6 bulan."
 *                   - "Pertimbangkan untuk meningkatkan kontribusi investasi sebesar 10%."
 *                   - "Skor diversifikasi portofolio: Sangat Baik."
 *               - title: "Alokasi Portofolio"
 *                 table:
 *                   headers: ["Kelas Aset", "Alokasi", "Nilai"]
 *                   rows:
 *                     - ["Saham", "45%", "Rp 382.500.000"]
 *                     - ["ETF", "25%", "Rp 212.500.000"]
 *                     - ["Obligasi", "15%", "Rp 127.500.000"]
 *                     - ["Tunai", "10%", "Rp 85.000.000"]
 *                     - ["Kripto", "5%", "Rp 42.500.000"]
 *             summary:
 *               - label: "Total Pemasukan"
 *                 value: 6450000
 *                 style: positive
 *               - label: "Total Pengeluaran"
 *                 value: -6049000
 *                 style: negative
 *               - label: "Saldo Bersih"
 *                 value: 401000
 *                 style: bold
 *             config:
 *               currency: IDR
 *               accentColor: "#22c55e"
 *               logoUrl: "https://example.com/logo.png"
 *               logoPosition: left
 *               copyrightOwner: "Stareezy Finance"
 *               showGeneratedAt: true
 *               footerText: "Rahasia - Hanya untuk Penggunaan Internal"
 *               pageSize: A4
 *               orientation: portrait
 *     responses:
 *       200:
 *         description: PDF report file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/report", async (req: Request, res: Response) => {
  try {
    const body = req.body as ReportRequest;
    const hasSections =
      Array.isArray(body.sections) && body.sections.length > 0;
    const hasKpis = Array.isArray(body.kpis);
    if (!hasSections && !hasKpis && !body.title) {
      res
        .status(400)
        .json({
          error: "At least one of: title, kpis, or sections is required",
        });
      return;
    }
    sendPdf(res, await reportToPdf(body), "report.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /invoice
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/invoice:
 *   post:
 *     summary: Professional invoice PDF
 *     description: |
 *       Generates a branded invoice with from/to blocks, line items table,
 *       and an automatic totals breakdown (subtotal → discount → tax → extra charges → total).
 *
 *       **Currency defaults to IDR.** Pass `currency: "USD"` etc. to override.
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceNumber, date, from, to, items]
 *             properties:
 *               invoiceNumber:
 *                 type: string
 *                 description: Unique invoice identifier
 *               date:
 *                 type: string
 *                 description: Invoice issue date (any string format)
 *               dueDate:
 *                 type: string
 *                 description: Payment due date
 *               from:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   email:
 *                     type: string
 *                   phone:
 *                     type: string
 *               to:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:
 *                     type: string
 *                   address:
 *                     type: string
 *                   email:
 *                     type: string
 *               items:
 *                 type: array
 *                 description: Line items. Total = quantity × unitPrice unless overridden.
 *                 items:
 *                   type: object
 *                   required: [description, quantity, unitPrice]
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *                     total:
 *                       type: number
 *                       description: Override total (optional)
 *               extraCharges:
 *                 type: array
 *                 description: Additional charges applied after subtotal (e.g. shipping)
 *                 items:
 *                   type: object
 *                   required: [label, amount]
 *                   properties:
 *                     label:
 *                       type: string
 *                     amount:
 *                       type: number
 *               taxRate:
 *                 type: number
 *                 description: Tax percentage 0–100, applied to subtotal after discount
 *                 default: 0
 *               discount:
 *                 type: number
 *                 description: Flat discount amount (absolute), applied before tax
 *                 default: 0
 *               currency:
 *                 type: string
 *                 description: "Currency code (IDR, USD, EUR, GBP …) or raw symbol"
 *                 default: IDR
 *               locale:
 *                 type: string
 *                 description: BCP 47 locale, auto-resolved from currency code
 *                 default: id-ID
 *               notes:
 *                 type: string
 *                 description: Footer note shown at the bottom of the invoice
 *               accentColor:
 *                 type: string
 *                 description: Hex color for the header bar
 *                 default: "#1e40af"
 *               config:
 *                 type: object
 *                 description: Page layout overrides
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     default: 0
 *                   marginRight:
 *                     type: number
 *                     default: 40
 *                   marginBottom:
 *                     type: number
 *                     default: 40
 *                   marginLeft:
 *                     type: number
 *                     default: 40
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *           example:
 *             invoiceNumber: "INV-2026-001"
 *             date: "7 Juni 2026"
 *             dueDate: "7 Juli 2026"
 *             from:
 *               name: "Stareezy Studio"
 *               address: "Jl. Sudirman No. 88, Jakarta Pusat 10220"
 *               email: "billing@stareezy.tech"
 *               phone: "+62 812-3456-7890"
 *             to:
 *               name: "PT. Maju Bersama"
 *               address: "Jl. Gatot Subroto No. 42, Jakarta Selatan 12710"
 *               email: "keuangan@majubersama.co.id"
 *             items:
 *               - description: "Desain Website & UI/UX"
 *                 quantity: 1
 *                 unitPrice: 15000000
 *               - description: "Pemeliharaan Bulanan (3 bulan)"
 *                 quantity: 3
 *                 unitPrice: 1500000
 *               - description: "Domain & Hosting (1 tahun)"
 *                 quantity: 1
 *                 unitPrice: 750000
 *             extraCharges:
 *               - label: "Biaya Pengiriman Dokumen"
 *                 amount: 50000
 *             taxRate: 11
 *             discount: 500000
 *             currency: IDR
 *             notes: "Pembayaran jatuh tempo dalam 30 hari. Terima kasih atas kepercayaan Anda."
 *             accentColor: "#1e40af"
 *             config:
 *               pageSize: A4
 *               orientation: portrait
 *     responses:
 *       200:
 *         description: PDF invoice file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/invoice", async (req: Request, res: Response) => {
  try {
    const body = req.body as InvoiceRequest;
    if (
      !body.invoiceNumber ||
      !body.date ||
      !body.from ||
      !body.to ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      res
        .status(400)
        .json({
          error:
            "invoiceNumber, date, from, to, and items (non-empty) are required",
        });
      return;
    }
    sendPdf(res, await invoiceToPdf(body), `invoice-${body.invoiceNumber}.pdf`);
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /receipt
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/receipt:
 *   post:
 *     summary: Point-of-sale receipt PDF
 *     description: |
 *       Generates a compact receipt. Suitable for cafes, retail, or any
 *       transaction confirmation. Calculates subtotal, discount, tax, and total.
 *
 *       **Currency defaults to IDR.**
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeName, items]
 *             properties:
 *               storeName:
 *                 type: string
 *                 description: Store / business name shown at the top
 *               storeAddress:
 *                 type: string
 *               receiptNumber:
 *                 type: string
 *               date:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, price]
 *                   properties:
 *                     name:
 *                       type: string
 *                     qty:
 *                       type: number
 *                       default: 1
 *                     price:
 *                       type: number
 *                       description: Unit price
 *               taxRate:
 *                 type: number
 *                 description: Tax percentage 0–100
 *                 default: 0
 *               discount:
 *                 type: number
 *                 description: Flat discount amount
 *                 default: 0
 *               currency:
 *                 type: string
 *                 description: Currency code or raw symbol
 *                 default: IDR
 *               locale:
 *                 type: string
 *                 description: BCP 47 locale, auto-resolved from currency code
 *                 default: id-ID
 *               paymentMethod:
 *                 type: string
 *                 description: e.g. "GoPay", "BCA *4242", "Tunai"
 *               notes:
 *                 type: string
 *               accentColor:
 *                 type: string
 *                 description: Hex color for top border and total line
 *                 default: "#0f172a"
 *           example:
 *             storeName: "Kopi Aurora"
 *             storeAddress: "Jl. Braga No. 12, Bandung"
 *             receiptNumber: "KWI-00142"
 *             date: "7 Juni 2026, 09:32"
 *             items:
 *               - name: "Kopi Susu Gula Aren"
 *                 qty: 2
 *                 price: 28000
 *               - name: "Matcha Latte"
 *                 qty: 1
 *                 price: 35000
 *               - name: "Avocado Toast"
 *                 qty: 1
 *                 price: 45000
 *               - name: "Air Mineral"
 *                 qty: 2
 *                 price: 8000
 *             taxRate: 10
 *             discount: 10000
 *             currency: IDR
 *             paymentMethod: "GoPay"
 *             notes: "Member Platinum — poin +152"
 *             accentColor: "#22c55e"
 *     responses:
 *       200:
 *         description: PDF receipt file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/receipt", async (req: Request, res: Response) => {
  try {
    const body = req.body as ReceiptRequest;
    if (
      !body.storeName ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      res
        .status(400)
        .json({ error: "storeName and items (non-empty) are required" });
      return;
    }
    sendPdf(res, await receiptToPdf(body), "receipt.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /letter
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/letter:
 *   post:
 *     summary: Formal business letter PDF
 *     description: |
 *       Renders a properly formatted business letter with from/to address blocks,
 *       date, subject line, body paragraphs, and a closing signature block.
 *       Uses Times Roman (serif) font for a traditional letter aesthetic.
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               date:
 *                 type: string
 *                 description: Date shown at the top. Defaults to today.
 *               from:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   title:
 *                     type: string
 *                   company:
 *                     type: string
 *                   address:
 *                     type: string
 *                   email:
 *                     type: string
 *               to:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   title:
 *                     type: string
 *                   company:
 *                     type: string
 *                   address:
 *                     type: string
 *               subject:
 *                 type: string
 *                 description: Re: subject line
 *               salutation:
 *                 type: string
 *                 description: Opening greeting
 *                 default: "Dear Sir/Madam,"
 *               body:
 *                 type: array
 *                 description: Array of paragraphs. Each string becomes one paragraph.
 *                 items:
 *                   type: string
 *               closing:
 *                 type: string
 *                 description: Closing phrase
 *                 default: "Sincerely,"
 *               signatureName:
 *                 type: string
 *               signatureTitle:
 *                 type: string
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: portrait
 *                   marginTop:
 *                     type: number
 *                     default: 70
 *                   marginRight:
 *                     type: number
 *                     default: 80
 *                   marginBottom:
 *                     type: number
 *                     default: 70
 *                   marginLeft:
 *                     type: number
 *                     default: 80
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *           example:
 *             date: "7 Juni 2026"
 *             from:
 *               name: "Budi Santoso"
 *               title: "Kepala Kemitraan"
 *               company: "Stareezy Corp"
 *               address: "Jl. Sudirman No. 88, Jakarta Pusat 10220"
 *               email: "budi@stareezy.tech"
 *             to:
 *               name: "Ibu Sari Dewi"
 *               title: "Direktur Utama"
 *               company: "PT. Mitra Sejahtera"
 *               address: "Jl. Gatot Subroto No. 42, Jakarta Selatan 12710"
 *             subject: "Proposal Kemitraan Strategis Q3 2026"
 *             salutation: "Dengan hormat, Ibu Sari,"
 *             body:
 *               - "Saya menulis surat ini untuk mengajukan proposal kemitraan strategis antara Stareezy Corp dan PT. Mitra Sejahtera untuk kuartal ketiga tahun 2026."
 *               - "Tim kami telah mengidentifikasi sinergi yang signifikan di bidang teknologi keuangan, dan kami percaya pendekatan kolaboratif akan memberikan manfaat bagi kedua organisasi dalam jangka panjang."
 *               - "Saya sangat berharap dapat mendiskusikan hal ini lebih lanjut pada kesempatan yang paling nyaman bagi Ibu. Mohon kiranya dapat memberikan waktu untuk pertemuan singkat dalam dua minggu ke depan."
 *             closing: "Hormat saya,"
 *             signatureName: "Budi Santoso"
 *             signatureTitle: "Kepala Kemitraan, Stareezy Corp"
 *             config:
 *               pageSize: A4
 *               orientation: portrait
 *               marginTop: 70
 *               marginRight: 80
 *               marginBottom: 70
 *               marginLeft: 80
 *     responses:
 *       200:
 *         description: PDF letter file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/letter", async (req: Request, res: Response) => {
  try {
    const body = req.body as LetterRequest;
    if (!Array.isArray(body.body) || body.body.length === 0) {
      res.status(400).json({ error: "body (array of paragraphs) is required" });
      return;
    }
    sendPdf(res, await letterToPdf(body), "letter.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /certificate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/certificate:
 *   post:
 *     summary: Certificate PDF (achievement, completion, appreciation)
 *     description: |
 *       Generates a landscape A4 certificate with a double decorative border,
 *       prominent recipient name, and up to two signature lines.
 *
 *       **Output is landscape A4 by default.** Override via `config.orientation`.
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, recipientName]
 *             properties:
 *               type:
 *                 type: string
 *                 description: Certificate type label displayed above the title
 *                 default: "Certificate of Achievement"
 *               title:
 *                 type: string
 *                 description: Main certificate title (large, bold, colored)
 *               preamble:
 *                 type: string
 *                 description: Text before the recipient name
 *                 default: "This is to certify that"
 *               recipientName:
 *                 type: string
 *                 description: Name of the recipient (large, underlined)
 *               description:
 *                 type: string
 *                 description: Achievement description shown below recipient name
 *               date:
 *                 type: string
 *                 description: Date on the certificate. Defaults to today.
 *               issuerName:
 *                 type: string
 *               issuerTitle:
 *                 type: string
 *               coIssuerName:
 *                 type: string
 *                 description: Optional second signatory
 *               coIssuerTitle:
 *                 type: string
 *               accentColor:
 *                 type: string
 *                 description: Border, title, and type-label color
 *                 default: "#1e40af"
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                     default: A4
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                     default: landscape
 *                   marginTop:
 *                     type: number
 *                     default: 50
 *                   marginRight:
 *                     type: number
 *                     default: 50
 *                   marginBottom:
 *                     type: number
 *                     default: 50
 *                   marginLeft:
 *                     type: number
 *                     default: 50
 *           example:
 *             type: "Sertifikat Penyelesaian"
 *             title: "Pengembangan TypeScript Tingkat Lanjut"
 *             preamble: "Dengan bangga diberikan kepada"
 *             recipientName: "Budi Santoso"
 *             description: "atas keberhasilan menyelesaikan program Pengembangan TypeScript Tingkat Lanjut selama 40 jam dengan predikat Sangat Memuaskan."
 *             date: "7 Juni 2026"
 *             issuerName: "Sari Dewi"
 *             issuerTitle: "Direktur Pendidikan"
 *             coIssuerName: "Andi Prasetyo"
 *             coIssuerTitle: "Instruktur Kursus"
 *             accentColor: "#1e40af"
 *             config:
 *               pageSize: A4
 *               orientation: landscape
 *               marginTop: 50
 *               marginRight: 50
 *               marginBottom: 50
 *               marginLeft: 50
 *     responses:
 *       200:
 *         description: PDF certificate file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/certificate", async (req: Request, res: Response) => {
  try {
    const body = req.body as CertificateRequest;
    if (!body.title || !body.recipientName) {
      res.status(400).json({ error: "title and recipientName are required" });
      return;
    }
    sendPdf(res, await certificateToPdf(body), "certificate.pdf");
  } catch (err) {
    res
      .status(500)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /compress
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/compress:
 *   post:
 *     summary: Compress an existing PDF file
 *     description: |
 *       Accepts a `multipart/form-data` upload and returns a compressed PDF.
 *
 *       **Two algorithms:**
 *       - `condense` (default) — Lossless. Strips metadata/thumbnails, compresses
 *         object streams via pdf-lib. No visual quality loss.
 *       - `photon` — Lossy. Re-renders every page to JPEG via pdfjs-dist. Highest
 *         compression ratio; requires `dpi` to be set. Text becomes rasterized.
 *
 *       The `config` field must be a JSON string when sending `multipart/form-data`.
 *     tags: [Utility]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: PDF file to compress
 *               config:
 *                 type: string
 *                 description: |
 *                   JSON string with compression options:
 *                   - `algorithm`: "condense" | "photon" (default: "condense")
 *                   - `removeMetadata`: boolean (default: false)
 *                   - `removeThumbnails`: boolean (default: false)
 *                   - `removeUnusedObjects`: boolean (default: true)
 *                   - `dpi`: 72 | 96 | 150 | 300 — required for photon
 *                   - `greyscale`: boolean — convert to greyscale in photon mode
 *                   - `jpegQuality`: 1–100 — JPEG quality for photon mode (auto if omitted)
 *                 example: '{"algorithm":"condense","removeMetadata":true,"removeThumbnails":true,"removeUnusedObjects":true}'
 *     responses:
 *       200:
 *         description: Compressed PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing file
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post(
  "/compress",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res
          .status(400)
          .json({
            error: "file is required (multipart/form-data, field: file)",
          });
        return;
      }
      const config = req.body.config
        ? typeof req.body.config === "string"
          ? JSON.parse(req.body.config)
          : req.body.config
        : {};
      const compressed = await compressPdf(
        new Uint8Array(req.file.buffer),
        config,
      );
      const name =
        (req.file.originalname.replace(/\.pdf$/i, "") || "document") +
        "_compressed.pdf";
      sendPdf(res, compressed, name);
    } catch (err) {
      res
        .status(500)
        .json({ error: err instanceof Error ? err.message : "Unknown error" });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /api/pdf/health:
 *   get:
 *     summary: Health check
 *     description: Returns the current service status and version.
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 service:
 *                   type: string
 *                   example: aurora-pdf-api
 *                 version:
 *                   type: string
 *                   example: "2.0.0"
 */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aurora-pdf-api", version: "2.0.0" });
});

export default router;
