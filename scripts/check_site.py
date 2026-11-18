"""Static checks for the frontend: SEO tags, one h1, valid JSON-LD, relative links, CSP-safe markup, no source maps."""
import glob, json, os, re, sys

R = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
errs, titles, descs = [], {}, {}
pages = sorted(glob.glob(R + "/**/index.html", recursive=True)) + [R + "/404.html"]
html = {os.path.relpath(p, R): open(p, encoding="utf-8").read() for p in pages}
site = re.findall(r"<loc>(.*?)</loc>", open(R + "/sitemap.xml").read())[0].rstrip("/")


def fs(href, pagedir):
    href = href.split("?")[0]
    path, _, frag = href.partition("#")
    if href.startswith(site):
        full = os.path.join(R, path[len(site):].lstrip("/"))
    elif re.match(r"(https?:|mailto:|tel:|data:)", href):
        return None, ""
    elif path == "":
        return None, ""
    else:
        full = os.path.normpath(os.path.join(pagedir, path))
    if path.endswith("/") or os.path.isdir(full):
        full = os.path.join(full, "index.html")
    return full, frag


def ids_of(text):
    return set(re.findall(r'\sid="([^"]+)"', text))


for n, h in html.items():
    pagedir = os.path.dirname(os.path.join(R, n))
    ids = re.findall(r'\sid="([^"]+)"', h)
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
    titles.setdefault(t[0] if t else n, []).append(n)
    descs.setdefault(d[0] if d else n, []).append(n)
    if 'http-equiv="Content-Security-Policy"' not in h or "data-base=" not in h:
        errs.append(f"{n}: missing CSP meta or data-base")
    if n != "404.html":
        for k in ('rel="canonical"', 'property="og:image"', 'name="twitter:card"', "application/ld+json"):
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
    for c in re.findall(r"<canvas\b[^>]*>", h):
        if 'aria-label="' not in c:
            errs.append(f"{n}: canvas without aria-label")
    if re.search(r'(?:href|src)="/(?!/)', h):
        errs.append(f"{n}: root-relative link breaks GitHub Pages project sites")
    for a in re.findall(r'(?:href|src)="([^"]+)"', h):
        full, frag = fs(a, pagedir)
        if full is None:
            continue
        if not os.path.isfile(full):
            errs.append(f"{n}: broken link {a}")
        elif frag and frag not in ids_of(open(full, encoding="utf-8").read()):
            errs.append(f"{n}: missing anchor #{frag} in {a}")
    js, loaded = "", []
    for s in re.findall(r'src="[^"]*assets/(\w+)\.js"', h):
        body = open(f"{R}/assets/{s}.js", encoding="utf-8").read()
        js += body
        if s not in ("core", "config"):
            for i in set(re.findall(r"\$\('(\w+)'\)", body)):
                if i not in ids:
                    errs.append(f"{n}: {s}.js uses missing id #{i}")
    fns = set(re.findall(r"function\s+(\w+)", js))
    for fn in re.findall(r'data-(?:act|chg|inp)="(\w+)"', h):
        if fn not in fns:
            errs.append(f"{n}: no function {fn} for data attribute")

for k, v in list(titles.items()) + list(descs.items()):
    if len(v) > 1:
        errs.append(f"duplicate title/description on {v}")
want = {n for n in html if n != "404.html"}
got = set()
for u in re.findall(r"<loc>(.*?)</loc>", open(R + "/sitemap.xml").read()):
    p = u[len(site):].strip("/")
    got.add((p + "/index.html") if p else "index.html")
if want != got:
    errs.append(f"sitemap mismatch: {sorted(want ^ got)}")
if glob.glob(R + "/**/*.map", recursive=True):
    errs.append("source map files must not be shipped")
for f in ("robots.txt", "llms.txt", "favicon.ico", "favicon.svg", "og-image.png", "apple-touch-icon.png", "manifest.webmanifest", ".well-known/security.txt", ".nojekyll", "sw.js"):
    if not os.path.isfile(os.path.join(R, f)):
        errs.append(f"missing {f}")
print("\n".join(errs) if errs else f"OK: {len(html)} pages checked")
sys.exit(1 if errs else 0)
