#!/bin/sh
# Usage: sh ship.sh [https://your-real-url.vercel.app] [path/to/your/git/repo]   (with no URL it asks you to paste it)
# Run it from the unzipped copy (for example ~/nf-new/nexus-forge). It sets your URL, finds your repo, copies the files in and pushes.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
sh "$SRC/scripts/set-domain.sh" "$1"
URL=$(grep -o '<loc>[^<]*' "$SRC/frontend/sitemap.xml" | head -1 | sed 's/<loc>//; s#/$##')
REPO="$2"
if [ -z "$REPO" ]; then
  for g in $(find "$HOME" -maxdepth 3 -type d -name .git 2>/dev/null); do
    d=$(dirname "$g")
    [ "$d" = "$SRC" ] && continue
    if git -C "$d" remote get-url origin 2>/dev/null | grep -q "nexus-forge"; then REPO="$d"; break; fi
  done
fi
if [ -z "$REPO" ]; then
  REPO="$HOME/nexus-repo"
  echo "No local copy of the repository was found. Cloning it into $REPO ..."
  git clone https://github.com/Nikhil-creat/nexus-forge.git "$REPO"
fi
[ "$REPO" = "$SRC" ] && { echo "Run this from the unzipped copy, not from the repository folder."; exit 1; }
echo "Using repository: $REPO"
cd "$REPO"
git config user.email >/dev/null 2>&1 || git config user.email "sriramojunikhil66@gmail.com"
git config user.name >/dev/null 2>&1 || git config user.name "Nikhil Chary Sriramoju"
git rm -rq --ignore-unmatch frontend .github scripts backend deploy >/dev/null 2>&1 || true
cp -r "$SRC"/. "$REPO"/
git add -A
if git diff --cached --quiet; then echo "No new changes to commit."; else git commit -q -m "${MSG:-Update Nexus Forge}"; fi
git push 2>/dev/null || git push -u origin HEAD
echo "Done. Vercel redeploys in about a minute. Then open $URL/api/health"
