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

## Deploy on Vercel
1. Import the GitHub repository. Root Directory: `frontend`. Framework Preset: Other. No build command.
2. Settings, Environment Variables: add one AI key (see `.env.example`), then redeploy.
3. Run `sh scripts/set-domain.sh https://your-site.vercel.app` once (canonical URLs, sitemap, social tags), commit and push.
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
