# Nexus Forge
Data analytics + ML + AI + cybersecurity + software engineering in one project.

## Run locally
    cd backend && pip install -r requirements.txt && uvicorn main:app --reload
    # open frontend/index.html (or: python -m http.server 8080 -d frontend)
    # to point the site at the API: localStorage.setItem('api','http://localhost:8000')

## Run with Docker
    docker compose up --build   # site: :8080  api: :8000/docs

## Env vars
SECRET_KEY, ADMIN_PASSWORD (defaults are for demo only; change them), GROQ_API_KEY (optional), ORIGINS (your site URL).

## Test
    cd backend && pytest -q

## Phase 2 additions
- /api/anomaly (IQR + z-score), /api/rag/add and /api/rag/ask (TF-IDF retrieval, optional Groq answer), /api/history (login required)
- SQLite storage (DB_PATH), per-IP rate limit (RATE_LIMIT per minute)
- Frontend: anomaly chart, document Q&A, password audit (browser only), sign-in, simulated threat monitor, credentials section
- Deploy: render.yaml for the API, .env.example for settings

## Phase 3 to 5 (v2.0)
- Synthora-style hero (video glow), Anta font, ember palette
- k-means and nearest-neighbour endpoints, CSV upload, signup/login (PBKDF2), log ingest feeding the threat monitor, /api/metrics
- PWA (manifest + service worker), report export, Vercel headers (frontend/vercel.json)
- CI runs tests and builds the Docker image; SECURITY.md lists production settings

## Deploy
1. Backend on Render (render.yaml). Set ADMIN_PASSWORD, SECRET_KEY, ORIGINS.
2. Put the Render URL in `<meta name="api-base">` in frontend/index.html.
3. Frontend on Vercel with Root Directory `frontend`.
