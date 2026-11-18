import os, re, csv, io, json, hmac, hashlib, time, math, urllib.request
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Nexus Forge API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=os.getenv("ORIGINS", "*").split(","), allow_methods=["*"], allow_headers=["*"])
SECRET = (os.getenv("SECRET_KEY") or os.urandom(32).hex()).encode()
USERS = {"admin": os.environ["ADMIN_PASSWORD"]} if os.getenv("ADMIN_PASSWORD") else {}


@app.middleware("http")
async def sec_headers(request, call_next):
    r = await call_next(request)
    r.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer"})
    return r


def sign(u):
    exp = int(time.time()) + 3600
    body = f"{u}.{exp}"
    return body + "." + hmac.new(SECRET, body.encode(), hashlib.sha256).hexdigest()


def verify(tok):
    try:
        u, exp, sig = tok.rsplit(".", 2)
        ok = hmac.compare_digest(sig, hmac.new(SECRET, f"{u}.{exp}".encode(), hashlib.sha256).hexdigest())
        return ok and int(exp) > time.time()
    except Exception:
        return False


class Login(BaseModel):
    username: str
    password: str


class Csv(BaseModel):
    text: str


class Pts(BaseModel):
    x: list[float]
    y: list[float]
    predict: float


class Scan(BaseModel):
    text: str


class Chat(BaseModel):
    message: str


@app.get("/api/health")
def health():
    return {"status": "ok", "time": time.time()}


@app.post("/api/auth/login")
def login(b: Login):
    if not valid(b.username, b.password):
        raise HTTPException(401, "Wrong username or password")
    return {"token": sign(b.username)}


@app.get("/api/auth/me")
def me(authorization: str = Header(default="")):
    if not verify(authorization.replace("Bearer ", "")):
        raise HTTPException(401, "Invalid or expired token")
    return {"user": "admin"}


@app.post("/api/analytics")
def analytics(b: Csv):
    rows = list(csv.DictReader(io.StringIO(b.text.strip())))
    if not rows:
        raise HTTPException(400, "No rows found")
    out = {"rows": len(rows), "columns": {}}
    for c in rows[0].keys():
        vals = [r[c] for r in rows if r[c] not in ("", None)]
        try:
            n = sorted(float(v) for v in vals)
            m = sum(n) / len(n)
            sd = math.sqrt(sum((v - m) ** 2 for v in n) / len(n))
            out["columns"][c] = {"type": "number", "mean": round(m, 3), "min": n[0], "max": n[-1], "median": n[len(n) // 2],
                                 "std": round(sd, 3), "outliers": sum(1 for v in n if sd and abs(v - m) > 3 * sd),
                                 "missing": len(rows) - len(vals)}
        except (ValueError, ZeroDivisionError):
            top = {}
            for v in vals:
                top[v] = top.get(v, 0) + 1
            out["columns"][c] = {"type": "text", "unique": len(top), "top": sorted(top.items(), key=lambda t: -t[1])[:3],
                                 "missing": len(rows) - len(vals)}
    return out


@app.post("/api/ml/predict")
def predict(b: Pts):
    n = len(b.x)
    if n < 2 or n != len(b.y):
        raise HTTPException(400, "Need equal x and y lists, 2+ points")
    mx, my = sum(b.x) / n, sum(b.y) / n
    den = sum((a - mx) ** 2 for a in b.x)
    if den == 0:
        raise HTTPException(400, "x values must differ")
    w = sum((a - mx) * (c - my) for a, c in zip(b.x, b.y)) / den
    bias = my - w * mx
    ss_res = sum((c - (w * a + bias)) ** 2 for a, c in zip(b.x, b.y))
    ss_tot = sum((c - my) ** 2 for c in b.y) or 1
    return {"slope": round(w, 4), "intercept": round(bias, 4), "r2": round(1 - ss_res / ss_tot, 4),
            "prediction": round(w * b.predict + bias, 4)}


PATTERNS = {
    "SQL injection": r"(union\s+select|or\s+1=1|drop\s+table)",
    "XSS": r"(<script|onerror\s*=|javascript:)",
    "Path traversal": r"(\.\./|%2e%2e)",
    "Command injection": r"(;\s*(rm|cat|wget|curl)\s)",
}


@app.post("/api/security/scan")
def scan(b: Scan):
    findings = [k for k, p in PATTERNS.items() if re.search(p, b.text, re.I | re.M)]
    fails = {}
    for ip in re.findall(r"(?:failed|invalid)[^\n]*?(\d{1,3}(?:\.\d{1,3}){3})", b.text, re.I):
        fails[ip] = fails.get(ip, 0) + 1
    brute = [ip for ip, c in fails.items() if c >= 3]
    risk = min(100, 30 * len(findings) + 25 * len(brute))
    log("scan", {"findings": findings, "brute": brute})
    return {"risk": risk, "level": "high" if risk >= 60 else "medium" if risk >= 25 else "low",
            "findings": findings, "brute_force_ips": brute}


@app.post("/api/chat")
def chat(b: Chat):
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return {"reply": "AI engine is in offline mode. Set GROQ_API_KEY on the server to enable live answers.", "mode": "offline"}
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        data=json.dumps({"model": "llama-3.3-70b-versatile", "messages": [
            {"role": "system", "content": "You are Nexus, an assistant for data analytics, ML and cybersecurity. Be concise."},
            {"role": "user", "content": b.message[:2000]}]}).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return {"reply": json.load(r)["choices"][0]["message"]["content"], "mode": "live"}
    except Exception:
        raise HTTPException(502, "AI provider unreachable")


# ---------------- Phase 2 ----------------
import sqlite3
from collections import Counter, defaultdict
from fastapi.responses import JSONResponse

DB = os.getenv("DB_PATH", "nexus.db")


def db():
    c = sqlite3.connect(DB)
    c.execute("create table if not exists history(id integer primary key, kind text, payload text, ts real)")
    c.execute("create table if not exists docs(id integer primary key, title text, chunk text)")
    c.execute("create table if not exists events(id integer primary key, level text, label text, ip text, ts real)")
    c.execute("create table if not exists users(username text primary key, salt text, hash text)")
    return c


def log(kind, payload):
    with db() as c:
        c.execute("insert into history(kind,payload,ts) values(?,?,?)", (kind, json.dumps(payload)[:2000], time.time()))


HITS = defaultdict(list)


@app.middleware("http")
async def limiter(request, call_next):
    ip = request.client.host if request.client else "?"
    now = time.time()
    h = [t for t in HITS[ip] if now - t < 60] + [now]
    HITS[ip] = h
    if len(h) > int(os.getenv("RATE_LIMIT", "120")):
        return JSONResponse({"detail": "Too many requests. Try again in a minute."}, status_code=429)
    return await call_next(request)


def llm(system, user):
    key = os.getenv("GROQ_API_KEY")
    if not key:
        return None
    req = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions", method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        data=json.dumps({"model": "llama-3.3-70b-versatile",
                         "messages": [{"role": "system", "content": system}, {"role": "user", "content": user[:6000]}]}).encode())
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)["choices"][0]["message"]["content"]
    except Exception:
        return None


class Series(BaseModel):
    values: list[float]


class Doc(BaseModel):
    title: str
    text: str


class Ask(BaseModel):
    question: str


@app.post("/api/anomaly")
def anomaly(b: Series):
    v = b.values
    if len(v) < 4:
        raise HTTPException(400, "Need at least 4 values")
    s = sorted(v)
    q1, q3 = s[len(s) // 4], s[(3 * len(s)) // 4]
    iqr = q3 - q1
    lo, hi = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    m = sum(v) / len(v)
    sd = math.sqrt(sum((x - m) ** 2 for x in v) / len(v))
    flags = [i for i, x in enumerate(v) if x < lo or x > hi or (sd and abs(x - m) / sd > 3)]
    log("anomaly", {"n": len(v), "flags": flags})
    return {"anomalies": flags, "bounds": [round(lo, 3), round(hi, 3)]}


def toks(t):
    return re.findall(r"[a-z0-9]+", t.lower())


@app.post("/api/rag/add")
def rag_add(b: Doc):
    parts = [c.strip() for c in re.split(r"\n\s*\n|(?<=[.!?])\s+(?=[A-Z])", b.text) if len(c.strip()) > 20][:200]
    if not parts:
        raise HTTPException(400, "Document too short")
    with db() as c:
        c.executemany("insert into docs(title,chunk) values(?,?)", [(b.title[:80], x[:600]) for x in parts])
    return {"chunks": len(parts)}


@app.post("/api/rag/ask")
def rag_ask(b: Ask):
    rows = db().execute("select title,chunk from docs").fetchall()
    if not rows:
        raise HTTPException(400, "Add a document first")
    n, df = len(rows), Counter()
    for _, ch in rows:
        df.update(set(toks(ch)))
    q = set(toks(b.question))

    def score(ch):
        t = Counter(toks(ch))
        return sum((1 + math.log(t[w])) * math.log(1 + n / df[w]) for w in q if w in t) / math.sqrt(len(t) or 1)

    top = [r for r in sorted(rows, key=lambda r: -score(r[1]))[:3] if score(r[1]) > 0]
    if not top:
        return {"answer": "No matching passage found in your documents.", "sources": []}
    ctx = "\n".join(f"[{t}] {c}" for t, c in top)
    ans = llm("Answer only from the context. If it is not there, say so. Be concise.", f"Context:\n{ctx}\n\nQuestion: {b.question}")
    log("rag", {"q": b.question[:200]})
    return {"answer": ans or top[0][1], "sources": [t for t, _ in top], "mode": "live" if ans else "retrieval-only"}


@app.get("/api/history")
def history(authorization: str = Header(default="")):
    if not verify(authorization.replace("Bearer ", "")):
        raise HTTPException(401, "Sign in to view history")
    rows = db().execute("select kind,payload,ts from history order by id desc limit 20").fetchall()
    return [{"kind": k, "payload": json.loads(p), "ts": t} for k, p, t in rows]


# ---------------- Phase 3 to 5 ----------------
import ml


def hash_pw(p, salt=None):
    salt = salt or os.urandom(16).hex()
    return salt, hashlib.pbkdf2_hmac("sha256", p.encode(), bytes.fromhex(salt), 200_000).hex()


def valid(u, p):
    if u in USERS and hmac.compare_digest(USERS[u].encode(), p.encode()):
        return True
    r = db().execute("select salt,hash from users where username=?", (u,)).fetchone()
    return bool(r) and hmac.compare_digest(hash_pw(p, r[0])[1], r[1])


@app.post("/api/auth/signup")
def signup(b: Login):
    if not re.fullmatch(r"[A-Za-z0-9_]{3,20}", b.username) or len(b.password) < 8:
        raise HTTPException(400, "Username: 3 to 20 letters, numbers or underscores. Password: 8 or more characters.")
    salt, h = hash_pw(b.password)
    try:
        with db() as c:
            c.execute("insert into users(username,salt,hash) values(?,?,?)", (b.username, salt, h))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That username is taken")
    return {"token": sign(b.username)}


class Clu(BaseModel):
    points: list[list[float]]
    k: int = 3


class Cls(BaseModel):
    X: list[list[float]]
    y: list[str]
    query: list[float]
    k: int = 3


@app.post("/api/ml/cluster")
def cluster(b: Clu):
    if not 2 <= b.k <= 8 or len(b.points) < b.k:
        raise HTTPException(400, "Use k between 2 and 8, with at least k points")
    lab, cents, inertia = ml.kmeans(b.points, b.k)
    log("cluster", {"n": len(b.points), "k": b.k})
    return {"labels": lab, "centroids": [[round(v, 3) for v in c] for c in cents], "inertia": round(inertia, 3)}


@app.post("/api/ml/classify")
def classify(b: Cls):
    if len(b.X) < 2 or len(b.X) != len(b.y):
        raise HTTPException(400, "Need matching training points and labels")
    k = max(1, min(b.k, len(b.X)))
    log("classify", {"n": len(b.X)})
    return {"label": ml.knn(b.X, b.y, b.query, k), "loo_accuracy": ml.loo_accuracy(b.X, b.y, k)}


class Lines(BaseModel):
    lines: list[str]


@app.post("/api/logs/ingest")
def ingest(b: Lines):
    now, ev, fails = time.time(), [], Counter()
    for ln in b.lines[:500]:
        for k, p in PATTERNS.items():
            if re.search(p, ln, re.I):
                ev.append(("high", k, "", now))
        m = re.search(r"(?:failed|invalid)[^\n]*?(\d{1,3}(?:\.\d{1,3}){3})", ln, re.I)
        if m:
            fails[m.group(1)] += 1
    for ip, n in fails.items():
        ev.append(("high", "Brute-force burst", ip, now) if n >= 3 else ("medium", "Failed login", ip, now))
    with db() as c:
        c.executemany("insert into events(level,label,ip,ts) values(?,?,?,?)", ev)
    return {"events": len(ev)}


@app.get("/api/logs/summary")
def summary():
    c = db()
    n = dict(c.execute("select level,count(*) from events group by level").fetchall())
    recent = [{"level": l, "label": b, "ip": i, "ts": t} for l, b, i, t in c.execute("select level,label,ip,ts from events order by id desc limit 8")]
    return {"total": sum(n.values()), "high": n.get("high", 0), "medium": n.get("medium", 0), "low": n.get("low", 0), "recent": recent}


STATS = {"req": 0, "t0": time.time()}


@app.middleware("http")
async def counter(request, call_next):
    STATS["req"] += 1
    return await call_next(request)


@app.get("/api/metrics")
def metrics():
    return {"requests": STATS["req"], "uptime_s": int(time.time() - STATS["t0"])}
