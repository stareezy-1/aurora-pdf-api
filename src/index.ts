import express from "express";
import cors from "cors";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env.js";
import pdfRoutes from "./routes/pdf.routes.js";

const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: env.MAX_FILE_SIZE }));
app.use(express.urlencoded({ extended: true, limit: env.MAX_FILE_SIZE }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: "3.0.3",
    info: {
      title: "Aurora PDF API",
      version: "1.0.0",
      description:
        "API for generating and compressing PDF documents from text, HTML, or Markdown",
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
    version: "1.0.0",
    docs: `/api/pdf/docs`,
    endpoints: {
      "POST /api/pdf/create": "Create PDF from text JSON",
      "POST /api/pdf/create-from-html": "Create PDF from HTML string (tables, CSS)",
      "POST /api/pdf/create-from-markdown": "Create PDF from Markdown string (pipe tables)",
      "POST /api/pdf/report": "Create financial report PDF from structured data",
      "POST /api/pdf/compress": "Upload PDF to compress (multipart)",
      "GET /api/pdf/health": "Health check",
    },
  });
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`aurora-pdf-api running on http://${env.HOST}:${env.PORT}`);
});
