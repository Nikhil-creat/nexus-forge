# Nexus Forge

Data analytics, machine learning, AI document Q&A and security tools in one open source project.
A static site that runs entirely in the browser and works on GitHub Pages, plus an optional FastAPI backend.

## Live site
https://nikhil-creat.github.io/nexus-forge/

## Pages
`/` home, `workspace/` (analytics, regression, clustering, classification, anomaly detection, document Q&A, AI assistant),
`security/` (AES-256-GCM notes, SHA-256 file fingerprints, log analysis), `projects/`, `architecture/`, `about/` credentials, `faq/`, custom `404.html`.
Also: `sitemap.xml`, `robots.txt`, `llms.txt`, `.well-known/security.txt`, web manifest, favicons and a 1200x630 share image.

## Deploy to GitHub Pages
1. Repository Settings, Pages, Build and deployment, Source: **GitHub Actions**.
2. Push to `main`. The workflow `.github/workflows/pages.yml` checks the site and publishes the `frontend` folder.
3. Optional custom domain: add it under Settings, Pages, create `frontend/CNAME` with the domain, then run
   `sh scripts/set-domain.sh https://yourdomain.com` and push.

## Workspace
Tabbed console (Data, Models, Assistant, Security, Session). The assistant detects Groq, Gemini, Anthropic, OpenRouter and OpenAI keys, streams answers, retries on rate limits, falls back to smaller models and answers common questions offline.

## Optional backend
Deploy `backend/` to Render using `render.yaml`, then set your API origin in `frontend/assets/config.js`.
Env vars: `SECRET_KEY`, `ADMIN_PASSWORD` (admin is disabled without it), one AI key (optional: `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`; the server retries and falls back across models), `ORIGINS`, `RATE_LIMIT`. See `.env.example`.

## Run locally
    npx serve frontend
    cd backend && pip install -r requirements.txt && ADMIN_PASSWORD=choose-one uvicorn main:app --reload
    # connect the site to the API: localStorage.setItem('api','http://localhost:8000')
Or `docker compose up --build` (site on :8080, API docs on :8000/docs).

## Quality gates (CI)
`python scripts/check_site.py` verifies one h1, unique titles and descriptions, canonicals, valid JSON-LD, alt text,
relative links and anchors (project-site safe), sitemap coverage, strict-CSP-safe markup and that no source maps ship.
`pytest` covers the API and the Docker image is built on every push.

## Security
See `SECURITY.md`. GitHub Pages cannot send HTTP headers, so a strict Content-Security-Policy is set with a meta tag.
