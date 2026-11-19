#!/bin/sh
# Usage: sh scripts/set-domain.sh https://yourdomain.com
# Rewrites the site URL in canonical tags, Open Graph tags, structured data, sitemap, robots.txt, llms.txt and security.txt.
set -e
NEW="${1%/}"
case "$NEW" in https://*) ;; *) echo "Give a full https:// URL, for example https://nexus-forge.vercel.app"; exit 1;; esac
cd "$(dirname "$0")/../frontend"
OLD=$(grep -o '<loc>[^<]*' sitemap.xml | head -1 | sed 's/<loc>//; s#/$##')
[ "$OLD" = "$NEW" ] && { echo "Already $NEW"; exit 0; }
grep -rIl "$OLD" . | while read -r f; do sed -i "s|$OLD|$NEW|g" "$f"; done
echo "Site URL changed from $OLD to $NEW"
python3 ../scripts/check_site.py
