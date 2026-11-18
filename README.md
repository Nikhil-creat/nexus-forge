# Nexus Forge

Data analytics, machine learning, AI document Q&A and cybersecurity log analysis in one open source platform.
Static frontend (no build step) plus an optional FastAPI backend. Every tool also runs in the browser when the API is offline.

## Pages
`/` home, `/workspace` tools, `/monitor` log analysis, `/architecture`, `/about` credentials, `/faq`, custom `404`.
SEO files: `sitemap.xml`, `robots.txt`, `llms.txt`, `.well-known/security.txt`, web manifest, favicons and a 1200x630 share image.

## Run locally
    cd backend && pip install -r requirements.txt && ADMIN_PASSWORD=choose-one uvicorn main:app --reload
    npx serve frontend            # clean URLs such as /workspace work
    # point the site at the API: localStorage.setItem('api','http://localhost:8000')
Or: `docker compose up --build` (site on :8080, API docs on :8000/docs).

## Configuration
Backend env vars: `SECRET_KEY`, `ADMIN_PASSWORD` (admin is disabled without it), `GROQ_API_KEY` (optional), `ORIGINS`, `RATE_LIMIT`. See `.env.example`.
Frontend: set your API origin in `frontend/assets/config.js`.

## Deploy
1. Backend on Render using `render.yaml` (root directory `backend`).
2. Put the Render URL in `frontend/assets/config.js`.
3. Frontend on Vercel with Root Directory `frontend`.
4. Custom domain: add it in Vercel, then run `sh scripts/set-domain.sh https://yourdomain.com` and push.

## Quality gates (CI)
`python scripts/check_site.py` verifies one h1, unique titles and descriptions, canonicals, valid JSON-LD, alt text, working internal links and anchors, sitemap coverage, strict-CSP-safe markup and that no source maps ship.
`pytest` covers the API. The Docker image is built on every push.

## Security
See `SECURITY.md`. A strict Content-Security-Policy and other headers are set in `frontend/vercel.json`.
