import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, "../../.env") });

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "4000", 10),
  HOST: process.env.HOST || "0.0.0.0",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || "52428800", 10),
  COMPRESSION_JPEG_QUALITY: parseInt(
    process.env.COMPRESSION_JPEG_QUALITY || "85",
    10,
  ),
  COMPRESSION_DPI: parseInt(process.env.COMPRESSION_DPI || "150", 10),
  API_URL: process.env.API_URL || `http://localhost:4000`,
  SWAGGER_ENABLED: process.env.SWAGGER_ENABLED !== "false",
  RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || "60000", 10),
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX || "100", 10),
} as const;
