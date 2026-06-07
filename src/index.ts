import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import pdfRoutes from "./routes/pdf.routes.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: env.MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: env.MAX_FILE_SIZE }));

const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/pdf", limiter);

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Aurora PDF API",
      version: "1.0.0",
      description:
        "Generate PDFs from text, HTML, Markdown, structured financial reports, invoices, receipts, letters, and certificates. Also compress existing PDFs.",
    },
    servers: [
      {
        url: env.API_URL,
        description: "Server",
      },
    ],
    components: {
      schemas: {
        ErrorResponse: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  },
  apis: ["./dist/routes/*.js"],
});

if (env.SWAGGER_ENABLED) {
  app.use("/api/pdf/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

app.use("/api/pdf", pdfRoutes);

app.get("/", (_req, res) => {
  res.json({
    name: "aurora-pdf-api",
    version: "2.0.0",
    docs: `/api/pdf/docs`,
    endpoints: {
      "POST /api/pdf/create": "Plain text → PDF",
      "POST /api/pdf/create-from-html": "HTML string → PDF",
      "POST /api/pdf/create-from-markdown": "Markdown string → PDF",
      "POST /api/pdf/report": "Multi-section financial report (Finary-style)",
      "POST /api/pdf/invoice": "Professional invoice with line items & totals",
      "POST /api/pdf/receipt": "Point-of-sale receipt",
      "POST /api/pdf/letter": "Formal business letter",
      "POST /api/pdf/certificate": "Award / completion certificate (landscape)",
      "POST /api/pdf/compress": "Compress an uploaded PDF (multipart)",
      "GET  /api/pdf/health": "Health check",
    },
  });
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`aurora-pdf-api running on http://${env.HOST}:${env.PORT}`);
});
