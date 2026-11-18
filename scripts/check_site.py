"""Static checks for the frontend: SEO tags, one h1, valid JSON-LD, links, CSP-safe markup, no source maps."""
import glob, json, os, re, sys

R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
errs, titles, descs, ids_by_page = [], {}, {}, {}
pages = sorted(glob.glob(R + "/*.html"))
html = {os.path.basename(p): open(p, encoding="utf-8").read() for p in pages}


def target(path):
    path = path.split("#")[0].split("?")[0]
    if path in ("", "/"):
        return "index.html"
    rel = path.lstrip("/")
    for cand in (rel, rel + ".html"):
        if os.path.isfile(os.path.join(R, cand)):
            return cand
    return None


for n, h in html.items():
    ids = re.findall(r'\sid="([^"]+)"', h)
    ids_by_page[n] = set(ids)
    if len(ids) != len(set(ids)):
        errs.append(f"{n}: duplicate ids")
    if len(re.findall(r"<h1[ >]", h)) != 1:
        errs.append(f"{n}: needs exactly one h1")
    t = re.findall(r"<title>(.*?)</title>", h, re.S)
    d = re.findall(r'<meta name="description" content="(.*?)"', h)
    if len(t) != 1 or not 10 <= len(t[0]) <= 65:
        errs.append(f"{n}: title missing or longer than 65 characters")
    if len(d) != 1 or not 50 <= len(d[0]) <= 160:
        errs.append(f"{n}: meta description missing or outside 50-160 characters")
    if t:
        titles.setdefault(t[0], []).append(n)
    if d:
        descs.setdefault(d[0], []).append(n)
    if n != "404.html":
        for k in ('rel="canonical"', 'property="og:image"', 'name="twitter:card"', 'application/ld+json'):
            if k not in h:
                errs.append(f"{n}: missing {k}")
    elif "noindex" not in h:
        errs.append("404.html must be noindex")
    for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S):
        try:
            json.loads(m)
        except Exception as e:
            errs.append(f"{n}: bad JSON-LD ({e})")
    if re.search(r"\son\w+=", h) or "<style" in h or re.search(r'\sstyle="', h):
        errs.append(f"{n}: inline handler or style breaks the strict CSP")
    if re.findall(r"<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>", h):
        errs.append(f"{n}: inline script")
    for img in re.findall(r"<img\b[^>]*>", h):
        if not re.search(r'\salt="[^"]+"', img):
            errs.append(f"{n}: image without alt text")
    for a in re.findall(r'(?:href|src)="(/[^"]*)"', h):
        if target(a) is None:
            errs.append(f"{n}: broken link {a}")
    for p, frag in re.findall(r'href="(/[^"#]*)#([^"]+)"', h):
        tg = target(p)
        if tg and frag not in ids_by_page.get(tg, set(re.findall(r'\sid="([^"]+)"', html.get(tg, "")))):
            errs.append(f"{n}: missing anchor #{frag} on {p}")
    # every JS action must exist, and every $('id') must exist on the page
    js = ""
    for s in re.findall(r'src="/assets/(\w+)\.js"', h):
        js += open(f"{R}/assets/{s}.js", encoding="utf-8").read()
        if s not in ("core", "config"):
            for i in set(re.findall(r"\$\('(\w+)'\)", open(f"{R}/assets/{s}.js", encoding="utf-8").read())):
                if i not in ids:
                    errs.append(f"{n}: {s}.js uses missing id #{i}")
    fns = set(re.findall(r"function\s+(\w+)", js))
    for fn in re.findall(r'data-(?:act|chg|inp)="(\w+)"', h):
        if fn not in fns:
            errs.append(f"{n}: no function {fn} for data attribute")

for k, v in list(titles.items()) + list(descs.items()):
    if len(v) > 1:
        errs.append(f"duplicate title/description on {v}")
site = re.findall(r"<loc>(.*?)</loc>", open(R + "/sitemap.xml").read())
want = {n for n in html if n != "404.html"}
got = {"index.html" if u.rstrip("/").count("/") <= 2 else u.rsplit("/", 1)[1] + ".html" for u in site}
if want != got:
    errs.append(f"sitemap mismatch: {sorted(want ^ got)}")
if glob.glob(R + "/**/*.map", recursive=True):
    errs.append("source map files must not be shipped")
for f in ("robots.txt", "llms.txt", "favicon.ico", "favicon.svg", "og-image.png", "apple-touch-icon.png", "manifest.webmanifest", ".well-known/security.txt"):
    if not os.path.isfile(os.path.join(R, f)):
        errs.append(f"missing {f}")
print("\n".join(errs) if errs else f"OK: {len(html)} pages checked")
sys.exit(1 if errs else 0)
