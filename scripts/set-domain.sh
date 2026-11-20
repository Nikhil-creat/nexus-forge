#!/bin/sh
# Usage: sh scripts/set-domain.sh [https://your-real-url.vercel.app]
# Rewrites the site URL in canonical tags, Open Graph tags, structured data, sitemap, robots.txt, llms.txt and security.txt.
set -e
RAW="$1"
if [ -z "$RAW" ]; then printf 'Paste your Vercel site URL and press Enter: '; read -r RAW; fi
# keep only scheme://host (drops /api/health, query strings, spaces), add https:// when missing
NEW=$(printf '%s' "$RAW" | tr -d ' \r\n' | sed -E 's|^(https?://[^/?#]+).*|\1|')
case "$NEW" in http://*|https://*) ;; "") ;; *) NEW="https://$(printf '%s' "$NEW" | sed -E 's|/.*||')";; esac
case "$NEW" in
  ""|*YOUR*|*EXACT*|*REAL*|*example*) echo "Give your real site URL (copy it from the Vercel dashboard), not the placeholder."; exit 1;;
esac
case "$NEW" in
  https://*) ;;
  http://*) [ "$ALLOW_HTTP" = "1" ] || { echo "Use an https:// URL."; exit 1;};;
esac
if [ "$NO_CHECK" != "1" ] && command -v curl >/dev/null 2>&1; then
  OUT=$(curl -s --max-time 20 -w '\n%{http_code}' "$NEW/api/health" 2>/dev/null || true)
  CODE=$(printf '%s' "$OUT" | tail -n 1)
  if ! printf '%s' "$OUT" | grep -q '"status":"ok"'; then
    echo "Check failed for $NEW (HTTP ${CODE:-none})."
    case "$CODE" in
      000|"") echo "Could not reach it. Look for typos in the address and check your internet.";;
      401|403) echo "Vercel Deployment Protection is blocking this address. Use the Production domain: Vercel, your project, Settings, Domains.";;
      404) echo "The address exists but /api/health was not found. It may not be your Nexus Forge deployment, or the latest code is not deployed there yet.";;
      *) echo "Unexpected answer from the server.";;
    esac
    echo "Open Vercel, Deployments, press Visit, and copy the address from the browser. For a custom domain that is not live yet, put NO_CHECK=1 in front of the command."
    exit 1
  fi
fi
cd "$(dirname "$0")/../frontend"
OLD=$(grep -o '<loc>[^<]*' sitemap.xml | head -1 | sed 's/<loc>//; s#/$##')
if [ "$OLD" = "$NEW" ]; then echo "Already set to $NEW"; exit 0; fi
grep -rIlF "$OLD" . | while read -r f; do sed -i "s|$OLD|$NEW|g" "$f"; done
echo "Site URL changed from $OLD to $NEW"
if command -v python3 >/dev/null 2>&1; then
  python3 ../scripts/check_site.py || echo "Warning: the site check reported problems"
else
  echo "python3 is not installed, so the optional site check was skipped"
fi
