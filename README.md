# Aurora PDF API

A RESTful API for generating and compressing PDF documents from text, HTML, Markdown, or structured financial data. Built with Express.js and TypeScript.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Service info |
| `GET` | `/api/pdf/health` | Health check |
| `POST` | `/api/pdf/create` | Convert text to PDF |
| `POST` | `/api/pdf/create-from-html` | Convert HTML to PDF (tables, CSS) |
| `POST` | `/api/pdf/create-from-markdown` | Convert Markdown to PDF (pipe tables) |
| `POST` | `/api/pdf/report` | Generate financial report PDF |
| `POST` | `/api/pdf/compress` | Compress an uploaded PDF |
| `GET` | `/api/pdf/docs` | Swagger UI (interactive docs) |

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev     # development (hot reload)
npm run build   # production build
npm start       # run built version
```

## API Usage

### Text to PDF

```bash
curl -X POST http://localhost:4000/api/pdf/create \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello World","config":{"fontSize":14,"pageSize":"A4"}}' \
  -o output.pdf
```

With advanced styling:

```bash
curl -X POST http://localhost:4000/api/pdf/create \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Welcome to My Report\n\nThis document demonstrates our new styling capabilities.",
    "config": {
      "fontSize": 14,
      "alignment": "center",
      "textColor": "#1e293b",
      "headerText": "Report",
      "footerText": "Page",
      "showPageNumbers": true
    }
  }' -o output.pdf
```

### HTML to PDF

Supports tables, CSS inline styles, headings, lists, blockquotes, and code blocks.

```bash
curl -X POST http://localhost:4000/api/pdf/create-from-html \
  -H "Content-Type: application/json" \
  -d '{
    "html": "<h1 style=\"color:#1e293b;\">Invoice</h1><table><thead><tr style=\"background:#2563eb;color:white;\"><th>Item</th><th>Price</th></tr></thead><tbody><tr><td>Coffee</td><td style=\"text-align:right;\">$5.00</td></tr></tbody></table>"
  }' -o output.pdf
```

### Markdown to PDF

Supports pipe tables, code blocks, headings, lists.

```bash
curl -X POST http://localhost:4000/api/pdf/create-from-markdown \
  -H "Content-Type: application/json" \
  -d '{
    "markdown": "# Monthly Report\n\n| Date | Amount |\n|------|-------:|\n| Jan 5 | +$5,000 |\n| Jan 8 | -$156 |\n\n**Total:** $4,844",
    "theme": "light"
  }' -o output.pdf
```

### Financial Report (recommended for money tracking apps)

```bash
curl -X POST http://localhost:4000/api/pdf/report \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Transaction Report",
    "subtitle": "January 2024",
    "headers": ["Date", "Description", "Category", "Amount"],
    "rows": [
      ["2024-01-05", "Salary", "Income", 5000],
      ["2024-01-08", "Groceries", "Food", -156.32],
      ["2024-01-12", "Freelance", "Income", 1200]
    ],
    "summary": [
      {"label": "Total Income", "value": 6200, "style": "positive"},
      {"label": "Total Expenses", "value": 156.32, "style": "negative"},
      {"label": "Balance", "value": 6043.68, "style": "bold"}
    ],
    "config": {
      "currency": "$",
      "tableHeaderColor": "#1e40af",
      "footerText": "Confidential"
    }
  }' -o report.pdf
```

### Compress PDF

```bash
curl -X POST http://localhost:4000/api/pdf/compress \
  -F "file=@document.pdf" \
  -F 'config={"algorithm":"condense","removeMetadata":true}' \
  -o compressed.pdf
```

## Configuration

All environment variables are optional — see `.env.example`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `NODE_ENV` | `development` | Environment |
| `CORS_ORIGIN` | `*` | CORS allowed origin |
| `MAX_FILE_SIZE` | `52428800` | Max upload size (bytes) |
| `API_URL` | `http://localhost:4000` | Public URL (used in Swagger docs) |
| `SWAGGER_ENABLED` | `true` | Enable/disable Swagger UI |
| `COMPRESSION_JPEG_QUALITY` | `85` | Default JPEG quality for photon compression |
| `COMPRESSION_DPI` | `150` | Default DPI for photon compression |

## HTML Features

The HTML-to-PDF engine supports:

- **Tables** — `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, `<td>` with alternating row colors, header backgrounds, borders
- **CSS inline styles** — `color`, `background-color`, `text-align`, `font-weight`, `font-size`, `font-family`, `padding`
- **Headings** — `<h1>` through `<h6>` with size hierarchy
- **Lists** — `<ul>` and `<ol>` with `<li>` items
- **Blockquotes** — `<blockquote>` with left accent border
- **Code blocks** — `<pre><code>` with background shading
- **Inline formatting** — `<strong>`, `<b>`, `<em>`, `<i>`, `<code>`
- **Horizontal rules** — `<hr>`
- **Headers & Footers** — with `{page}` and `{total}` placeholders

## Compression Algorithms

Two algorithms available:

- **condense** (default) — Removes unused objects, metadata, and thumbnails via pdf-lib
- **photon** — Renders each page to JPEG via pdfjs-dist and canvas. Supports DPI scaling, greyscale, and quality control

## Tech Stack

- **Express.js** — HTTP framework
- **pdf-lib** — PDF creation and manipulation
- **pdfjs-dist** — PDF rendering for photon compression
- **canvas** (node-canvas) — Image rendering
- **Swagger UI** — Interactive API documentation

## Deployment

The API runs behind an Nginx reverse proxy with SSL via Let's Encrypt.
