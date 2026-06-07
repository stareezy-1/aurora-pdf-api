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

// ─── helpers ─────────────────────────────────────────────────────────────────

function sendPdf(res: Response, bytes: Uint8Array, filename: string) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Content-Length": bytes.length.toString(),
  });
  res.send(Buffer.from(bytes));
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /create  —  plain text → PDF
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/pdf/create:
 *   post:
 *     summary: Convert plain text to PDF
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
 *                 example: "Hello World\nThis is line two."
 *               config:
 *                 type: object
 *                 properties:
 *                   fontFamily:    { type: string, enum: [Helvetica, Courier, TimesRoman] }
 *                   fontSize:      { type: number, example: 11 }
 *                   lineSpacing:   { type: number, example: 1.5 }
 *                   pageSize:      { type: string, enum: [A4, Letter, Legal] }
 *                   orientation:   { type: string, enum: [portrait, landscape] }
 *                   textColor:     { type: string, example: "#1e293b" }
 *                   backgroundColor: { type: string, example: "#ffffff" }
 *                   headerText:    { type: string }
 *                   footerText:    { type: string }
 *                   showPageNumbers: { type: boolean }
 *                   alignment:     { type: string, enum: [left, center, right] }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
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
 *     summary: Convert HTML to PDF
 *     tags: [Create]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [html]
 *             properties:
 *               html: { type: string }
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:    { type: string, enum: [A4, Letter, Legal] }
 *                   orientation: { type: string, enum: [portrait, landscape] }
 *                   headerText:  { type: string }
 *                   footerText:  { type: string }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
 *     summary: Convert Markdown to PDF
 *     tags: [Create]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [markdown]
 *             properties:
 *               markdown: { type: string }
 *               theme: { type: string, enum: [light, dark, github] }
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:    { type: string, enum: [A4, Letter, Legal] }
 *                   orientation: { type: string, enum: [portrait, landscape] }
 *                   headerText:  { type: string }
 *                   footerText:  { type: string }
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
// POST /report  —  Finary-style multi-section financial report
// ─────────────────────────────────────────────────────────────────────────────
/**
 * @swagger
 * /api/pdf/report:
 *   post:
 *     summary: Generate a multi-section financial report PDF
 *     description: >
 *       Creates a professionally styled financial report with a branded cover,
 *       KPI metrics block, multiple content sections (each can have a table,
 *       bullet list, or description), and an optional summary totals block.
 *     tags: [Report]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               brand:    { type: string, example: "Stareezy Finance Bot" }
 *               title:    { type: string, example: "AI Financial Tracking Report" }
 *               subtitle: { type: string, example: "June 2026" }
 *               description: { type: string, example: "Professional monthly financial reporting." }
 *               kpis:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label:       { type: string }
 *                     value:       { oneOf: [{ type: string }, { type: number }] }
 *                     change:      { type: string, example: "+12.4%" }
 *                     changeStyle: { type: string, enum: [positive, negative, neutral] }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title:       { type: string }
 *                     description: { type: string }
 *                     bullets:     { type: array, items: { type: string } }
 *                     table:
 *                       type: object
 *                       properties:
 *                         headers:     { type: array, items: { type: string } }
 *                         rows:        { type: array, items: { type: array } }
 *                         headerColor: { type: string, example: "#22c55e" }
 *               summary:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     label: { type: string }
 *                     value: { oneOf: [{ type: string }, { type: number }] }
 *                     style: { type: string, enum: [normal, positive, negative, bold] }
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:       { type: string, enum: [A4, Letter, Legal] }
 *                   currency:       { type: string, example: "$" }
 *                   locale:         { type: string, example: "en-US" }
 *                   accentColor:    { type: string, example: "#22c55e" }
 *                   headerText:     { type: string }
 *                   showGeneratedAt: { type: boolean }
 *           example:
 *             brand: "Stareezy Finance Bot"
 *             title: "AI Financial Tracking Report"
 *             subtitle: "June 2026"
 *             description: "Professional monthly financial reporting generated by AI-powered wealth analytics."
 *             kpis:
 *               - { label: "Net Worth", value: "$152,670", change: "+12.4%", changeStyle: "positive" }
 *               - { label: "Monthly Savings", value: "$3,365", change: "+15.4%", changeStyle: "positive" }
 *               - { label: "Investment Portfolio", value: "$65,340", change: "+10.3%", changeStyle: "positive" }
 *             sections:
 *               - title: "Executive Summary"
 *                 description: "During the reporting period, the portfolio demonstrated healthy growth with a 12.4% increase in total net worth."
 *               - title: "Recent Transactions"
 *                 table:
 *                   headers: ["Date", "Name", "Category", "Amount"]
 *                   rows:
 *                     - ["2026-06-01", "Salary", "Income", 5200]
 *                     - ["2026-06-02", "Netflix", "Subscription", -15.99]
 *               - title: "AI Insights & Recommendations"
 *                 bullets:
 *                   - "Savings increased by 23% compared to last month."
 *                   - "Consider increasing investment contributions by 10%."
 *               - title: "Portfolio Allocation"
 *                 table:
 *                   headers: ["Asset Class", "Allocation", "Value"]
 *                   rows:
 *                     - ["Stocks", "45%", "$29,403"]
 *                     - ["ETFs", "25%", "$16,335"]
 *             summary:
 *               - { label: "Total Income", value: 6450, style: "positive" }
 *               - { label: "Total Expenses", value: -603.39, style: "negative" }
 *               - { label: "Net Balance", value: 5846.61, style: "bold" }
 *             config:
 *               currency: "$"
 *               accentColor: "#22c55e"
 *     responses:
 *       200:
 *         description: PDF report file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */
router.post("/report", async (req: Request, res: Response) => {
  try {
    const body = req.body as ReportRequest;
    const hasSections =
      Array.isArray(body.sections) && body.sections.length > 0;
    const hasLegacy = Array.isArray(body.kpis);
    if (!hasSections && !hasLegacy && !body.title) {
      res.status(400).json({
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
 *     summary: Generate a professional invoice PDF
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [invoiceNumber, date, from, to, items]
 *             properties:
 *               invoiceNumber: { type: string, example: "INV-2026-001" }
 *               date:          { type: string, example: "2026-06-07" }
 *               dueDate:       { type: string, example: "2026-07-07" }
 *               from:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:    { type: string }
 *                   address: { type: string }
 *                   email:   { type: string }
 *                   phone:   { type: string }
 *               to:
 *                 type: object
 *                 required: [name]
 *                 properties:
 *                   name:    { type: string }
 *                   address: { type: string }
 *                   email:   { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [description, quantity, unitPrice]
 *                   properties:
 *                     description: { type: string }
 *                     quantity:    { type: number }
 *                     unitPrice:   { type: number }
 *                     total:       { type: number }
 *               taxRate:     { type: number, example: 10 }
 *               discount:    { type: number, example: 50 }
 *               currency:    { type: string, example: "$" }
 *               locale:      { type: string, example: "en-US" }
 *               notes:       { type: string }
 *               accentColor: { type: string, example: "#1e40af" }
 *     responses:
 *       200:
 *         description: PDF invoice file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
      res.status(400).json({
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
 *     summary: Generate a point-of-sale receipt PDF
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [storeName, items]
 *             properties:
 *               storeName:     { type: string, example: "Aurora Coffee" }
 *               storeAddress:  { type: string }
 *               receiptNumber: { type: string }
 *               date:          { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [name, price]
 *                   properties:
 *                     name:  { type: string }
 *                     qty:   { type: number }
 *                     price: { type: number }
 *               taxRate:       { type: number, example: 8.5 }
 *               discount:      { type: number }
 *               currency:      { type: string, example: "$" }
 *               paymentMethod: { type: string, example: "Visa *4242" }
 *               notes:         { type: string }
 *               accentColor:   { type: string, example: "#0f172a" }
 *     responses:
 *       200:
 *         description: PDF receipt file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
 *     summary: Generate a formal business letter PDF
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               date:       { type: string, example: "June 7, 2026" }
 *               from:
 *                 type: object
 *                 properties:
 *                   name:    { type: string }
 *                   title:   { type: string }
 *                   company: { type: string }
 *                   address: { type: string }
 *                   email:   { type: string }
 *               to:
 *                 type: object
 *                 properties:
 *                   name:    { type: string }
 *                   title:   { type: string }
 *                   company: { type: string }
 *                   address: { type: string }
 *               subject:        { type: string }
 *               salutation:     { type: string, example: "Dear Mr. Smith," }
 *               body:
 *                 type: array
 *                 items: { type: string }
 *                 description: Array of paragraphs
 *               closing:        { type: string, example: "Yours sincerely," }
 *               signatureName:  { type: string }
 *               signatureTitle: { type: string }
 *     responses:
 *       200:
 *         description: PDF letter file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
 *     summary: Generate a certificate PDF (achievement, completion, etc.)
 *     tags: [Documents]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, recipientName]
 *             properties:
 *               type:          { type: string, example: "Certificate of Achievement" }
 *               title:         { type: string, example: "Excellence in Performance" }
 *               preamble:      { type: string, example: "This is to certify that" }
 *               recipientName: { type: string, example: "John Doe" }
 *               description:   { type: string, example: "for successfully completing the Advanced TypeScript Course" }
 *               date:          { type: string, example: "June 7, 2026" }
 *               issuerName:    { type: string }
 *               issuerTitle:   { type: string }
 *               coIssuerName:  { type: string }
 *               coIssuerTitle: { type: string }
 *               accentColor:   { type: string, example: "#1e40af" }
 *     responses:
 *       200:
 *         description: PDF certificate file (landscape A4)
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
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
 *     summary: Compress a PDF file
 *     tags: [Utility]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:   { type: string, format: binary }
 *               config: { type: string, example: '{"algorithm":"condense","removeMetadata":true}' }
 *     responses:
 *       200:
 *         description: Compressed PDF file
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 */
router.post(
  "/compress",
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({
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
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is up
 */
router.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "aurora-pdf-api", version: "2.0.0" });
});

export default router;
