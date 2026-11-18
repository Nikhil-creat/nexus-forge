#!/bin/sh
# Usage: sh scripts/set-domain.sh https://yourdomain.com
# Rewrites the site URL in canonical tags, Open Graph tags, structured data, sitemap, robots.txt, llms.txt and security.txt.
set -e
NEW="${1%/}"
OLD="https://nexus-forge.vercel.app"
case "$NEW" in https://*) ;; *) echo "Give a full https:// URL"; exit 1;; esac
cd "$(dirname "$0")/../frontend"
grep -rl "$OLD" . | while read -r f; do sed -i "s|$OLD|$NEW|g" "$f"; done
echo "Site URL is now $NEW"
python3 ../scripts/check_site.py
