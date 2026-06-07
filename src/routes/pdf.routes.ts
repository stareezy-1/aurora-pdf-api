import { Router, type Request, type Response } from "express";
import multer from "multer";
import {
  textToPdf,
  htmlToPdf,
  markdownToPdf,
  compressPdf,
  reportToPdf,
} from "../services/pdf.service.js";
import type {
  TextToPdfRequest,
  HtmlToPdfRequest,
  MarkdownToPdfRequest,
  ReportRequest,
} from "../types/pdf.types.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @swagger
 * /api/pdf/create:
 *   post:
 *     summary: Convert text to PDF
 *     description: Generates a PDF document from plain text with optional formatting
 *     tags: [PDF]
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
 *                 description: Plain text content to convert
 *                 example: "Hello World\nThis is a PDF document"
 *               config:
 *                 type: object
 *                 properties:
 *                   fontFamily:
 *                     type: string
 *                     enum: [Helvetica, Courier, TimesRoman]
 *                   fontSize:
 *                     type: number
 *                     example: 11
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                   textColor:
 *                     type: string
 *                     example: "#333333"
 *                   backgroundColor:
 *                     type: string
 *                     example: "#ffffff"
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *                   showPageNumbers:
 *                     type: boolean
 *                   alignment:
 *                     type: string
 *                     enum: [left, center, right]
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing text field
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
    const pdfBytes = await textToPdf(body);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=output.pdf",
      "Content-Length": pdfBytes.length.toString(),
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * @swagger
 * /api/pdf/create-from-html:
 *   post:
 *     summary: Convert HTML to PDF
 *     description: Generates a PDF from an HTML string. Supports tables, CSS styles, headings, lists, blockquotes, code blocks.
 *     tags: [PDF]
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
 *                 description: HTML content to convert
 *                 example: "<h1>Title</h1><table><tr><th>Item</th><th>Price</th></tr><tr><td>Coffee</td><td>$5</td></tr></table>"
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                   orientation:
 *                     type: string
 *                     enum: [portrait, landscape]
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing html field
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
    const pdfBytes = await htmlToPdf(body.html, body.config);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=output.pdf",
      "Content-Length": pdfBytes.length.toString(),
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * @swagger
 * /api/pdf/create-from-markdown:
 *   post:
 *     summary: Convert Markdown to PDF
 *     description: Generates a PDF from a Markdown string. Supports pipe tables, code blocks, headings, lists.
 *     tags: [PDF]
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
 *                 description: Markdown content to convert
 *                 example: "# Report\n\n| Date | Amount |\n|------|--------|\n| Jan 1 | $500 |"
 *               theme:
 *                 type: string
 *                 enum: [light, dark, github]
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                   headerText:
 *                     type: string
 *                   footerText:
 *                     type: string
 *     responses:
 *       200:
 *         description: PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing markdown field
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
    const pdfBytes = await markdownToPdf(body.markdown, body.theme ?? "light", body.config);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=output.pdf",
      "Content-Length": pdfBytes.length.toString(),
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * @swagger
 * /api/pdf/report:
 *   post:
 *     summary: Generate a financial report PDF
 *     description: Creates a professionally styled financial report with table, headers, rows, and summary
 *     tags: [Report]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [headers, rows]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Monthly Transaction Report"
 *               subtitle:
 *                 type: string
 *                 example: "January 2024 - March 2024"
 *               headers:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Date", "Description", "Category", "Amount"]
 *               rows:
 *                 type: array
 *                 items:
 *                   type: array
 *                   items:
 *                     oneOf:
 *                       - type: string
 *                       - type: number
 *                 example: [["2024-01-05", "Salary", "Income", 5000], ["2024-01-08", "Groceries", "Food", -156.32]]
 *               summary:
 *                 type: array
 *                 items:
 *                   type: object
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
 *                 example: [{"label": "Total Income", "value": 5000, "style": "positive"}, {"label": "Total Expenses", "value": 156.32, "style": "negative"}, {"label": "Balance", "value": 4843.68, "style": "bold"}]
 *               config:
 *                 type: object
 *                 properties:
 *                   pageSize:
 *                     type: string
 *                     enum: [A4, Letter, Legal]
 *                   currency:
 *                     type: string
 *                     example: "$"
 *                   tableHeaderColor:
 *                     type: string
 *                     example: "#2563eb"
 *                   footerText:
 *                     type: string
 *     responses:
 *       200:
 *         description: PDF report file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/report", async (req: Request, res: Response) => {
  try {
    const body = req.body as ReportRequest;
    if (!body.headers || !body.rows || !Array.isArray(body.headers) || !Array.isArray(body.rows)) {
      res.status(400).json({ error: "headers (array) and rows (array) are required" });
      return;
    }
    const pdfBytes = await reportToPdf(body);
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=report.pdf",
      "Content-Length": pdfBytes.length.toString(),
    });
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

/**
 * @swagger
 * /api/pdf/compress:
 *   post:
 *     summary: Compress a PDF file
 *     description: Upload a PDF and receive a compressed version
 *     tags: [PDF]
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
 *                 description: JSON string of compression options
 *                 example: '{"algorithm":"condense","removeMetadata":true}'
 *     responses:
 *       200:
 *         description: Compressed PDF file
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: Missing file field
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
        res.status(400).json({ error: "file is required (multipart/form-data, field: file)" });
        return;
      }
      const config = req.body.config
        ? typeof req.body.config === "string"
          ? JSON.parse(req.body.config)
          : req.body.config
        : {};

      const bytes = new Uint8Array(req.file.buffer);
      const compressed = await compressPdf(bytes, config);

      const originalName = req.file.originalname.replace(/\.pdf$/i, "") || "document";
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${originalName}_compressed.pdf`,
        "Content-Length": compressed.length.toString(),
      });
      res.send(Buffer.from(compressed));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ error: message });
    }
  },
);

/**
 * @swagger
 * /api/pdf/health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service status
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
 */
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "aurora-pdf-api" });
});

export default router;
