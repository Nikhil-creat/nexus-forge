# Nexus Forge

Data analytics, machine learning, AI document Q&A and security tools in one open source project.
Static pages plus Vercel Functions. Every tool also works in the browser with no server at all.

## Pages
`/` home, `/workspace/` (tabbed console: Data, Models, Assistant, Security, Session), `/security/` (AES-256-GCM notes, SHA-256 fingerprints, log analysis),
`/projects/`, `/architecture/`, `/about/` credentials, `/faq/`, custom `404.html`. Also `sitemap.xml`, `robots.txt`, `llms.txt`, `.well-known/security.txt`, web manifest.

## How the AI works
1. **Server key (recommended):** set one provider key in Vercel. `/api/chat` discovers the provider's live models, retries rate limits, falls back to smaller models and streams answers. The key never reaches the browser.
2. **Browser key:** paste a Groq, Gemini, Anthropic, OpenRouter or OpenAI key in the Assistant tab (kept in the tab only). It is auto-detected and live models are listed.
3. **No key:** built-in answers for common data, ML and security questions.
`/api/health` advertises capabilities, so the site never calls an endpoint that does not exist.

## Agent mode and voice
- **Agent mode** (Assistant tab): the AI chooses among local tools (analyze CSV, anomalies, regression, log scan, clustering), sees the results and answers. It works on your workspace data. Without any AI it routes to the matching tool by keywords.
- **Voice:** speak your question (English, Telugu or Hindi, via the browser's speech service) and optionally have answers read aloud.

## Documents, sessions, sharing and Telugu
- **Documents:** upload .txt, .md, .csv, .json, .html, .docx or .pdf files (read in the browser, never uploaded). Passages are ranked with BM25 and the answer cites its sources. PDFs need selectable text (checked against pdftotext on files from Chromium, LibreOffice, wkhtmltopdf and reportlab); scanned PDFs need OCR and encrypted PDFs are refused with a clear message.
- **Resume:** `/resume/` is a one-page, print-ready resume (use Print, then Save as PDF). Phone number and CGPA are intentionally not shown on the public page.
- **Sessions:** save named snapshots of your workspace on this device.
- **Share links:** `Create share link` puts the (compressed) workspace inside the link, nothing is stored. Optional `short link` stores it on the server for 30 days; it appears only when a database is connected (see below).
- **Telugu:** language selector in the header and footer. Static interface text is translated (`frontend/assets/te.js`, loaded only when needed); tool results and AI answers appear in the language you ask in.

## Optional: short links with a free database
Vercel project, Storage, create an Upstash Redis database (free tier) and connect it to the project. This adds `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Redeploy; `/api/health` then lists `share`.

## Protecting your AI key
The server function limits requests per visitor (`RATE_LIMIT`, default 20 per minute) and per day for the whole site (`DAILY_LIMIT`, default 400), checks the request origin, caps message and history size, and only accepts server-defined prompts. Also set spending limits in your provider console.

## Deploy on Vercel
1. Import the GitHub repository. Root Directory: `frontend`. Framework Preset: Other. No build command.
2. Settings, Environment Variables: add one AI key (see `.env.example`), then redeploy.
3. Update from a new zip with one command: `sh ship.sh https://your-real-url.vercel.app` (run from the unzipped folder). It checks that the URL answers `/api/health`, rewrites canonical tags, sitemap and social tags, finds your local repository, commits and pushes.
4. Optional custom domain: Settings, Domains, then run the same script with the new URL.

## Develop locally
    node scripts/dev.js            # http://localhost:3000, behaves like Vercel (clean URLs, /api, headers)
    GROQ_API_KEY=... node scripts/dev.js

## Quality gates (CI)
`python scripts/check_site.py` (one h1, unique titles and descriptions, canonicals, JSON-LD, alt text, links and anchors, sitemap, strict-CSP-safe markup, no source maps),
`node scripts/test-api.js` (functions), `node scripts/test-browser.js` (browser logic), `pytest` (optional Python backend), Docker build.

## Optional Python backend
`backend/` (FastAPI, SQLite) can run on Render (`render.yaml`) for stored history and signup. Point `frontend/assets/config.js` at it; it advertises its capabilities the same way.

## Security
Strict Content-Security-Policy, HSTS, frame denial and more are set in `frontend/vercel.json`. See `SECURITY.md`.
