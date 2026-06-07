# Aurora PDF API

A RESTful API for generating professional PDF documents from plain text, HTML, Markdown, structured financial reports, invoices, receipts, business letters, and certificates. Also compresses existing PDFs. Built with Express.js and TypeScript.

## Endpoints

| Method | Path                            | Description                                   |
| ------ | ------------------------------- | --------------------------------------------- |
| `GET`  | `/`                             | Service info & endpoint listing               |
| `GET`  | `/api/pdf/health`               | Health check                                  |
| `GET`  | `/api/pdf/docs`                 | Swagger UI (interactive docs)                 |
| `POST` | `/api/pdf/create`               | Plain text → PDF                              |
| `POST` | `/api/pdf/create-from-html`     | HTML string → PDF                             |
| `POST` | `/api/pdf/create-from-markdown` | Markdown string → PDF                         |
| `POST` | `/api/pdf/report`               | Multi-section financial report (Finary-style) |
| `POST` | `/api/pdf/invoice`              | Professional invoice with line items & totals |
| `POST` | `/api/pdf/receipt`              | Point-of-sale receipt                         |
| `POST` | `/api/pdf/letter`               | Formal business letter                        |
| `POST` | `/api/pdf/certificate`          | Award / completion certificate (landscape)    |
| `POST` | `/api/pdf/compress`             | Compress an uploaded PDF                      |

---

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev     # development with hot reload
npm run build   # compile TypeScript
npm start       # run compiled output
```

---

## API Reference

### POST `/api/pdf/create` — Plain text to PDF

```json
{
  "text": "Hello World\nLine two.",
  "config": {
    "fontFamily": "Helvetica",
    "fontSize": 12,
    "lineSpacing": 1.5,
    "alignment": "left",
    "textColor": "#1e293b",
    "backgroundColor": "#ffffff",
    "pageSize": "A4",
    "orientation": "portrait",
    "headerText": "My Document",
    "footerText": "Confidential",
    "showPageNumbers": true,
    "marginTop": 55,
    "marginRight": 55,
    "marginBottom": 55,
    "marginLeft": 55
  }
}
```

| Field                    | Type                                 | Default      | Description                        |
| ------------------------ | ------------------------------------ | ------------ | ---------------------------------- |
| `text`                   | `string`                             | **required** | Content to render                  |
| `config.fontFamily`      | `Helvetica \| Courier \| TimesRoman` | `Helvetica`  | Font                               |
| `config.fontSize`        | `number`                             | `11`         | Font size in pt                    |
| `config.lineSpacing`     | `number`                             | `1.5`        | Line height multiplier             |
| `config.alignment`       | `left \| center \| right`            | `left`       | Text alignment                     |
| `config.textColor`       | `string`                             | `#1e293b`    | Hex text color                     |
| `config.backgroundColor` | `string`                             | —            | Hex page background color          |
| `config.pageSize`        | `A4 \| Letter \| Legal`              | `A4`         | Page size                          |
| `config.orientation`     | `portrait \| landscape`              | `portrait`   | Page orientation                   |
| `config.headerText`      | `string`                             | —            | Text shown at top of every page    |
| `config.footerText`      | `string`                             | —            | Text shown at bottom of every page |
| `config.showPageNumbers` | `boolean`                            | `false`      | Append `N / Total` to footer       |

```bash
curl -X POST https://api.stareezy.tech/api/pdf/create \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello World","config":{"fontSize":14,"showPageNumbers":true}}' \
  -o output.pdf
```

---

### POST `/api/pdf/create-from-html` — HTML to PDF

```json
{
  "html": "<h1>Title</h1><p>Body text</p>",
  "config": {
    "pageSize": "A4",
    "orientation": "portrait",
    "headerText": "My App",
    "footerText": "Page {page} of {total}"
  }
}
```

Supported HTML elements: `h1–h6`, `p`, `div`, `span`, `table / thead / tbody / tr / th / td`, `ul / ol / li`, `blockquote`, `pre / code`, `strong`, `em`, `hr`, `br`.

Supported CSS inline properties: `color`, `background-color`, `text-align`, `font-weight`, `font-style`, `font-size`, `font-family`, `padding`.

Header/footer text supports `{page}` and `{total}` placeholders.

```bash
curl -X POST https://api.stareezy.tech/api/pdf/create-from-html \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Invoice</h1><table><tr><th>Item</th><th>Price</th></tr><tr><td>Coffee</td><td>$5</td></tr></table>"}' \
  -o output.pdf
```

---

### POST `/api/pdf/create-from-markdown` — Markdown to PDF

```json
{
  "markdown": "# Report\n\n| Date | Amount |\n|------|-------:|\n| Jun 1 | $5,200 |\n\n**Total:** $5,200",
  "theme": "light",
  "config": {
    "pageSize": "A4",
    "headerText": "Monthly Report"
  }
}
```

| Field      | Type                      | Default      | Description      |
| ---------- | ------------------------- | ------------ | ---------------- |
| `markdown` | `string`                  | **required** | Markdown content |
| `theme`    | `light \| dark \| github` | `light`      | Color theme      |

Supported Markdown: headings (`#` to `######`), bold/italic, `~~strikethrough~~`, `[links](url)`, `` `inline code` ``, ` ```code blocks``` `, `> blockquotes`, `- / * / 1.` lists, pipe tables, `---` horizontal rules.

```bash
curl -X POST https://api.stareezy.tech/api/pdf/create-from-markdown \
  -H "Content-Type: application/json" \
  -d '{"markdown":"# Hello\n\nThis is **bold** and _italic_.","theme":"github"}' \
  -o output.pdf
```

---

### POST `/api/pdf/report` — Multi-section Financial Report

Generates a Finary-style branded report with:

- **Header band** on every page — accent-color background, logo image (PNG/JPEG), brand name, report title, subtitle
- **Footer band** on every page — copyright notice, custom text, `Page N of M`
- KPI metrics block
- Unlimited content sections (each can combine a heading, description paragraph, bullet list, and/or a table)
- Summary totals block

```json
{
  "brand": "FINARY",
  "title": "AI Financial Tracking Report",
  "subtitle": "June 2026",
  "description": "Professional monthly financial reporting generated by AI-powered wealth analytics.",
  "kpis": [
    {
      "label": "Net Worth",
      "value": "$152,670",
      "change": "+12.4%",
      "changeStyle": "positive"
    },
    {
      "label": "Monthly Savings",
      "value": "$3,365",
      "change": "+15.4%",
      "changeStyle": "positive"
    },
    {
      "label": "Investment Portfolio",
      "value": "$65,340",
      "change": "+10.3%",
      "changeStyle": "positive"
    }
  ],
  "sections": [
    {
      "title": "Executive Summary",
      "description": "During the reporting period, the portfolio demonstrated healthy growth with a 12.4% increase in total net worth. Income remained stable while expenses were kept within budget targets."
    },
    {
      "title": "Recent Transactions",
      "table": {
        "headers": ["Date", "Name", "Category", "Amount"],
        "rows": [
          ["2026-06-01", "Salary", "Income", 5200],
          ["2026-06-02", "Netflix", "Subscription", -15.99],
          ["2026-06-03", "Starbucks", "Food & Bev", -5.75],
          ["2026-06-04", "ETF Investment", "Investment", -500],
          ["2026-06-05", "Freelance Project", "Income", 1250],
          ["2026-06-06", "Electricity Bill", "Utilities", -82.4]
        ]
      }
    },
    {
      "title": "AI Insights & Recommendations",
      "bullets": [
        "Savings increased by 23% compared to last month.",
        "Subscription spending remains low and optimized.",
        "Emergency fund coverage exceeds the recommended 6 months.",
        "Consider increasing investment contributions by 10% to accelerate long-term growth.",
        "Portfolio diversification score: Excellent."
      ]
    },
    {
      "title": "Portfolio Allocation",
      "table": {
        "headers": ["Asset Class", "Allocation", "Value"],
        "rows": [
          ["Stocks", "45%", "$29,403"],
          ["ETFs", "25%", "$16,335"],
          ["Bonds", "15%", "$9,801"],
          ["Cash", "10%", "$6,534"],
          ["Crypto", "5%", "$3,267"]
        ]
      }
    }
  ],
  "summary": [
    { "label": "Total Income", "value": 6450, "style": "positive" },
    { "label": "Total Expenses", "value": -603.39, "style": "negative" },
    { "label": "Net Balance", "value": 5846.61, "style": "bold" }
  ],
  "config": {
    "currency": "$",
    "locale": "en-US",
    "accentColor": "#22c55e",
    "logoUrl": "https://example.com/logo.png",
    "logoPosition": "left",
    "copyrightOwner": "Finary Inc.",
    "showGeneratedAt": true,
    "footerText": "Confidential — Internal Use Only"
  }
}
```

#### `config` options

| Field             | Type                    | Default    | Description                                                                              |
| ----------------- | ----------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `currency`        | `string`                | `$`        | Currency symbol prepended to amounts                                                     |
| `locale`          | `string`                | `en-US`    | Locale for number formatting                                                             |
| `accentColor`     | `string`                | `#22c55e`  | Hex color for header band and table headers                                              |
| `logoUrl`         | `string`                | —          | Public URL **or** base64 data-URI (`data:image/png;base64,…`) of your logo (PNG or JPEG) |
| `logoPosition`    | `left \| right`         | `left`     | Side of the header band where the logo is placed                                         |
| `copyrightOwner`  | `string`                | —          | Name shown as `© 2026 <owner>. All rights reserved.` in the footer                       |
| `showGeneratedAt` | `boolean`               | `true`     | Show "Generated June 7, 2026" below the title                                            |
| `footerText`      | `string`                | —          | Custom text rendered in the centre of the footer band                                    |
| `pageSize`        | `A4 \| Letter \| Legal` | `A4`       | Page size                                                                                |
| `orientation`     | `portrait \| landscape` | `portrait` | Orientation                                                                              |

#### Logo via base64 (for Telegram bots / no public URL)

```python
import base64, httpx

with open("logo.png", "rb") as f:
    logo_b64 = base64.b64encode(f.read()).decode()

payload = {
    "brand": "MyBot",
    "title": "Monthly Report",
    # ...
    "config": {
        "logoUrl": f"data:image/png;base64,{logo_b64}",
        "copyrightOwner": "MyBot",
        "accentColor": "#6366f1"
    }
}
response = httpx.post("https://api.stareezy.tech/api/pdf/report", json=payload)
```

---

### POST `/api/pdf/invoice` — Invoice

```json
{
  "invoiceNumber": "INV-2026-001",
  "date": "2026-06-07",
  "dueDate": "2026-07-07",
  "from": {
    "name": "Acme Studio",
    "address": "123 Main St, San Francisco, CA",
    "email": "billing@acme.io",
    "phone": "+1 555-0100"
  },
  "to": {
    "name": "Client Corp",
    "address": "456 Oak Ave, New York, NY",
    "email": "ap@clientcorp.com"
  },
  "items": [
    { "description": "Website Design", "quantity": 1, "unitPrice": 3500 },
    { "description": "Monthly Maintenance", "quantity": 3, "unitPrice": 250 },
    { "description": "Domain Renewal", "quantity": 1, "unitPrice": 14.99 }
  ],
  "extraCharges": [{ "label": "Shipping & Handling", "amount": 25 }],
  "taxRate": 8.5,
  "discount": 100,
  "currency": "$",
  "locale": "en-US",
  "notes": "Payment due within 30 days. Thank you for your business.",
  "accentColor": "#1e40af"
}
```

| Field           | Type     | Required | Description                                                                   |
| --------------- | -------- | -------- | ----------------------------------------------------------------------------- |
| `invoiceNumber` | `string` | ✓        | Invoice identifier                                                            |
| `date`          | `string` | ✓        | Issue date                                                                    |
| `dueDate`       | `string` | —        | Payment due date                                                              |
| `from`          | `object` | ✓        | Sender: `name`, `address`, `email`, `phone`                                   |
| `to`            | `object` | ✓        | Recipient: `name`, `address`, `email`                                         |
| `items`         | `array`  | ✓        | Line items: `description`, `quantity`, `unitPrice`, optional `total` override |
| `extraCharges`  | `array`  | —        | Additional charges after subtotal: `label`, `amount`                          |
| `taxRate`       | `number` | —        | Tax % applied to subtotal after discount                                      |
| `discount`      | `number` | —        | Flat discount amount                                                          |
| `currency`      | `string` | —        | Currency symbol (default `$`)                                                 |
| `notes`         | `string` | —        | Footer note on the invoice                                                    |
| `accentColor`   | `string` | —        | Header bar color (default `#1e40af`)                                          |

---

### POST `/api/pdf/receipt` — Receipt

```json
{
  "storeName": "Aurora Coffee",
  "storeAddress": "88 Brew Lane, Seattle, WA",
  "receiptNumber": "RCP-00142",
  "date": "2026-06-07",
  "items": [
    { "name": "Flat White", "qty": 2, "price": 4.5 },
    { "name": "Avocado Toast", "qty": 1, "price": 12.0 },
    { "name": "Sparkling Water", "qty": 1, "price": 2.5 }
  ],
  "taxRate": 9.5,
  "currency": "$",
  "paymentMethod": "Visa *4242",
  "notes": "Enjoy your day!",
  "accentColor": "#0f172a"
}
```

| Field           | Type     | Required | Description                            |
| --------------- | -------- | -------- | -------------------------------------- |
| `storeName`     | `string` | ✓        | Store name shown at the top            |
| `items`         | `array`  | ✓        | Items: `name`, `price`, optional `qty` |
| `taxRate`       | `number` | —        | Tax %                                  |
| `discount`      | `number` | —        | Flat discount                          |
| `paymentMethod` | `string` | —        | e.g. `"Visa *4242"`, `"Cash"`          |

---

### POST `/api/pdf/letter` — Business Letter

```json
{
  "date": "June 7, 2026",
  "from": {
    "name": "Jane Smith",
    "title": "Head of Partnerships",
    "company": "Aurora Corp",
    "address": "100 Pacific Ave, San Francisco, CA 94111",
    "email": "jane@aurora.io"
  },
  "to": {
    "name": "John Doe",
    "title": "CEO",
    "company": "Partner Ltd",
    "address": "200 Broadway, New York, NY 10038"
  },
  "subject": "Partnership Proposal — Q3 2026",
  "salutation": "Dear Mr. Doe,",
  "body": [
    "I am writing to propose a strategic partnership between Aurora Corp and Partner Ltd for the third quarter of 2026.",
    "Our respective teams have identified significant synergies in the enterprise software space, and we believe a collaborative approach would benefit both organizations.",
    "I would welcome the opportunity to discuss this further at your earliest convenience."
  ],
  "closing": "Yours sincerely,",
  "signatureName": "Jane Smith",
  "signatureTitle": "Head of Partnerships, Aurora Corp"
}
```

| Field                              | Type       | Required | Description                                                  |
| ---------------------------------- | ---------- | -------- | ------------------------------------------------------------ |
| `body`                             | `string[]` | ✓        | Array of paragraphs                                          |
| `from`                             | `object`   | —        | Sender block: `name`, `title`, `company`, `address`, `email` |
| `to`                               | `object`   | —        | Recipient block: `name`, `title`, `company`, `address`       |
| `subject`                          | `string`   | —        | Re: line                                                     |
| `salutation`                       | `string`   | —        | Opening line (default `Dear Sir/Madam,`)                     |
| `closing`                          | `string`   | —        | Closing line (default `Sincerely,`)                          |
| `signatureName` / `signatureTitle` | `string`   | —        | Signature block                                              |

---

### POST `/api/pdf/certificate` — Certificate

Renders a landscape A4 certificate with double border and optional dual signature lines.

```json
{
  "type": "Certificate of Completion",
  "title": "Advanced TypeScript Development",
  "preamble": "This is to certify that",
  "recipientName": "John Doe",
  "description": "for successfully completing the 40-hour Advanced TypeScript Development course with distinction.",
  "date": "June 7, 2026",
  "issuerName": "Jane Smith",
  "issuerTitle": "Director of Education",
  "coIssuerName": "Bob Lee",
  "coIssuerTitle": "Course Instructor",
  "accentColor": "#1e40af"
}
```

| Field                            | Type     | Required | Description                                                    |
| -------------------------------- | -------- | -------- | -------------------------------------------------------------- |
| `title`                          | `string` | ✓        | Main certificate title                                         |
| `recipientName`                  | `string` | ✓        | Name of the recipient                                          |
| `type`                           | `string` | —        | Certificate type label (default `Certificate of Achievement`)  |
| `preamble`                       | `string` | —        | Text before recipient name (default `This is to certify that`) |
| `description`                    | `string` | —        | Reason/description below the recipient name                    |
| `date`                           | `string` | —        | Date shown on the certificate (defaults to today)              |
| `issuerName` / `issuerTitle`     | `string` | —        | First signatory                                                |
| `coIssuerName` / `coIssuerTitle` | `string` | —        | Optional second signatory                                      |
| `accentColor`                    | `string` | —        | Border and title color (default `#1e40af`)                     |

---

### POST `/api/pdf/compress` — Compress PDF

Accepts `multipart/form-data`.

```bash
# Lossless structural compression (default)
curl -X POST https://api.stareezy.tech/api/pdf/compress \
  -F "file=@document.pdf" \
  -F 'config={"algorithm":"condense","removeMetadata":true,"removeThumbnails":true}' \
  -o compressed.pdf

# Lossy re-render to JPEG at 96 DPI (maximum size reduction)
curl -X POST https://api.stareezy.tech/api/pdf/compress \
  -F "file=@document.pdf" \
  -F 'config={"algorithm":"photon","dpi":96,"greyscale":false,"jpegQuality":75}' \
  -o compressed.pdf
```

#### `config` options

| Field                 | Type                     | Default    | Description                                |
| --------------------- | ------------------------ | ---------- | ------------------------------------------ |
| `algorithm`           | `condense \| photon`     | `condense` | Compression mode                           |
| `removeMetadata`      | `boolean`                | `false`    | Strip PDF metadata                         |
| `removeThumbnails`    | `boolean`                | `false`    | Remove embedded page thumbnails            |
| `removeUnusedObjects` | `boolean`                | `true`     | Remove unused PDF objects (object streams) |
| `dpi`                 | `72 \| 96 \| 150 \| 300` | —          | Target DPI for photon mode                 |
| `greyscale`           | `boolean`                | `false`    | Convert pages to greyscale in photon mode  |
| `jpegQuality`         | `number`                 | auto       | JPEG quality 1–100 for photon mode         |

**Algorithms:**

- **`condense`** — Lossless. Strips metadata/thumbnails, compresses object streams. No visual quality loss.
- **`photon`** — Lossy. Re-renders each page to JPEG via pdfjs-dist. Highest compression ratio; image-only output (text becomes rasterized).

---

## Telegram Bot Integration

The API is designed to work directly from a Telegram bot server. The bot hits the endpoint and passes the raw PDF bytes to `sendDocument`.

### Python (python-telegram-bot + httpx)

```python
import io, httpx, base64
from telegram import Update
from telegram.ext import ContextTypes

AURORA_PDF_URL = "https://api.stareezy.tech/api/pdf/report"

async def send_report(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Optionally embed your bot logo
    with open("logo.png", "rb") as f:
        logo_b64 = base64.b64encode(f.read()).decode()

    payload = {
        "brand": "MoneyTrackerBot",
        "title": "Monthly Expense Report",
        "subtitle": "June 2026",
        "sections": [
            {
                "title": "Recent Transactions",
                "table": {
                    "headers": ["Date", "Description", "Category", "Amount"],
                    "rows": [
                        ["2026-06-01", "Salary",    "Income",   5000],
                        ["2026-06-05", "Groceries", "Food",   -156.32],
                    ]
                }
            }
        ],
        "summary": [
            {"label": "Total Income",   "value": 5000,    "style": "positive"},
            {"label": "Total Expenses", "value": -156.32, "style": "negative"},
            {"label": "Balance",        "value": 4843.68, "style": "bold"},
        ],
        "config": {
            "currency": "$",
            "accentColor": "#6366f1",
            "logoUrl": f"data:image/png;base64,{logo_b64}",
            "logoPosition": "left",
            "copyrightOwner": "MoneyTrackerBot"
        }
    }

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(AURORA_PDF_URL, json=payload)
        r.raise_for_status()

    pdf = io.BytesIO(r.content)
    pdf.name = "report.pdf"
    await context.bot.send_document(
        chat_id=update.effective_chat.id,
        document=pdf,
        filename="report.pdf",
        caption="📊 Your monthly report"
    )
```

### Node.js (Telegraf + axios)

```typescript
import { Telegraf } from "telegraf";
import axios from "axios";

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.command("report", async (ctx) => {
  const response = await axios.post(
    "https://api.stareezy.tech/api/pdf/report",
    {
      brand: "MoneyTrackerBot",
      title: "Monthly Report",
      subtitle: "June 2026",
      sections: [
        {
          title: "Recent Transactions",
          table: {
            headers: ["Date", "Description", "Amount"],
            rows: [
              ["2026-06-01", "Salary", 5000],
              ["2026-06-05", "Groceries", -156.32],
            ],
          },
        },
      ],
      summary: [{ label: "Balance", value: 4843.68, style: "bold" }],
      config: { currency: "$", accentColor: "#22c55e" },
    },
    { responseType: "arraybuffer" }, // ← required for binary response
  );

  await ctx.replyWithDocument(
    { source: Buffer.from(response.data), filename: "report.pdf" },
    { caption: "📊 Your monthly report" },
  );
});
```

---

## Environment Variables

All variables are optional. Copy `.env.example` to `.env` and adjust as needed.

| Variable                   | Default                 | Description                                 |
| -------------------------- | ----------------------- | ------------------------------------------- |
| `PORT`                     | `4000`                  | Server port                                 |
| `HOST`                     | `0.0.0.0`               | Bind address                                |
| `NODE_ENV`                 | `development`           | `development` or `production`               |
| `CORS_ORIGIN`              | `*`                     | Allowed CORS origin                         |
| `MAX_FILE_SIZE`            | `52428800`              | Max request/upload size in bytes (50 MB)    |
| `API_URL`                  | `http://localhost:4000` | Public base URL (used in Swagger docs)      |
| `SWAGGER_ENABLED`          | `true`                  | Toggle Swagger UI at `/api/pdf/docs`        |
| `RATE_LIMIT_WINDOW`        | `60000`                 | Rate limit window in ms                     |
| `RATE_LIMIT_MAX`           | `100`                   | Max requests per window per IP              |
| `COMPRESSION_JPEG_QUALITY` | `85`                    | Default JPEG quality for photon compression |
| `COMPRESSION_DPI`          | `150`                   | Default DPI for photon compression          |

---

## Tech Stack

| Package                                | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| `express` v5                           | HTTP framework                                 |
| `pdf-lib`                              | PDF creation, manipulation, and image stamping |
| `pdfjs-dist`                           | PDF rendering for photon compression           |
| `canvas` (node-canvas)                 | Raster image rendering                         |
| `multer`                               | Multipart file uploads                         |
| `express-rate-limit`                   | Per-IP rate limiting                           |
| `swagger-jsdoc` + `swagger-ui-express` | Interactive API docs                           |

---

## Project Structure

```
src/
├── index.ts                # Express app, middleware, Swagger setup
├── config/
│   └── env.ts              # Environment variable loading
├── routes/
│   └── pdf.routes.ts       # All HTTP handlers
├── services/
│   ├── pdf.service.ts      # Business logic for each endpoint
│   └── pdf-engine.ts       # Custom HTML→PDF renderer (pdf-lib based)
└── types/
    └── pdf.types.ts        # TypeScript interfaces for all request bodies
```

---

## Deployment

The API is deployed via Docker on a VPS behind an Nginx reverse proxy with SSL.

```bash
docker compose up -d
```

Public base URL: `https://api.stareezy.tech`  
Swagger docs: `https://api.stareezy.tech/api/pdf/docs`
