# AI-Powered Website Audit Tool

An AI-powered website audit tool built for EIGHT25MEDIA's internal tooling evaluation. Accepts a single URL, extracts factual metrics, and uses **Google Gemini AI** to generate structured SEO and CRO insights.

---

## Live Demo / Setup

### Run locally

```bash
git clone https://github.com/Jenat-Milan04/website-audit-tool
cd website-audit-tool
npm install
cp .env.example .env
# Add your Google Gemini API key to .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Environment variables

```
GEMINI_API_KEY=AIz....
```

---

## Architecture Overview

┌─────────────────────────────────────────────────────────┐
│                      React Frontend                      │
│                     (Port 5173)                          │
│                                                          │
│  User inputs URL → scraper.js → fetchHTML()              │
│         │                                                │
│         ▼                                                │
│  Backend Proxy (Node.js/Express)                        │
│  ┌──────────────────────────────────────────────┐       │
│  │ POST /fetch-page → Fetches webpage HTML      │       │
│  │ POST /analyze    → Calls Gemini API          │       │
│  └──────────────────────────────────────────────┘       │
│         │                                                │
│         ▼                                                │
│  extractMetrics() → DOM parsing → Factual metrics       │
│         │                                                │
│         ▼                                                │
│  runAIAnalysis() → Google Gemini API (gemini-2.5-flash) │
│         │                                                │
│         ▼                                                │
│  Structured JSON → React renders:                       │
│  Metrics | Insights | Recommendations                   │
└─────────────────────────────────────────────────────────┘

### File structure

```
src/
├── scraper.js       # HTML fetching + DOM metric extraction (no AI)
├── aiAnalysis.js    # gemini API call, prompt construction, prompt logs
├── App.jsx          # React UI — renders all three output sections
├── App.module.css   # Scoped CSS module
└── index.css        # Global reset + CSS variables
```

**Key design principle**: scraping and AI analysis are completely separate modules. `scraper.js` knows nothing about AI; `aiAnalysis.js` receives a plain metrics object and never touches the DOM.

---

## AI Design Decisions

### 1. Structured JSON output
The system prompt instructs gemini to respond only with valid JSON matching a precise schema. This makes the response deterministic and immediately renderable — no parsing heuristics needed.

### 2. Metrics-grounded prompting
All extracted metrics are injected verbatim into the user prompt. The system prompt explicitly requires that every insight reference specific numbers. This prevents generic AI responses like "consider improving your SEO" and produces specific findings like "your 0 H1 tags will hurt crawlability."

### 3. Clean system/user prompt separation
- **System prompt**: Defines the persona, constraints, and output schema
- **User prompt**: Contains the actual data (metrics + content snippet)

This separation means the system prompt can be versioned and tuned independently of data.

### 4. Content snippet strategy
The page's text content is truncated to 3,000 characters and sent alongside the metrics. This gives Claude context about messaging and tone without blowing the token budget on full-page content.

### 5. Prompt logs as a first-class output
`aiAnalysis.js` returns a `promptLog` object alongside the parsed result. This contains the full system prompt, the exact user prompt with injected metrics, and the raw model output — making the AI layer fully auditable.

---

## Trade-offs

| Decision | Trade-off |
|---|---|
| Client-side scraping via CORS proxy | Simple to deploy, no server needed. But sites that block the proxy will fail. A server-side scraper (Puppeteer, Playwright) would be more reliable. |
| DOMParser for metric extraction | Works in the browser with zero dependencies. But JS-rendered content won't be parsed — a headless browser would capture dynamic pages. |
| Anthropic API called from browser | No backend required. In production, this should be proxied through a backend to protect the API key. |
| Single-page only | Per spec. Multi-page crawling would require a queue system and backend. |
| allorigins.win proxy | Free and works for most public pages. For production, use a self-hosted proxy or server-side scraping. |

---

## What I'd Improve With More Time

1. **Server-side scraping with Playwright** — renders JS, bypasses CORS restrictions, handles SPAs
2. **API key proxy** — never expose Anthropic keys in the browser; route through a backend
3. **Historical audit storage** — save audit results per URL to track improvement over time
4. **Lighthouse integration** — add Core Web Vitals and performance scores alongside SEO metrics
5. **Multi-page crawl option** — audit a full site's top N pages and generate a site-wide report
6. **Streaming AI responses** — stream Claude's output token-by-token for faster perceived performance
7. **PDF export** — generate a shareable audit PDF for client delivery

---

## Prompt Log Sample

See the "Prompt log" section in the UI after running an audit. It exposes:
- The full system prompt used
- The user prompt with injected metric values
- The raw model output before JSON parsing
