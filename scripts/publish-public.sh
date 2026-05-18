#!/usr/bin/env bash
# publish-public.sh — force-squash push to iran-memorial26/iran-memorial
#
# Intentional design: the public GitHub repo always shows exactly 1 commit.
# Local main keeps full development history. Only the current snapshot ships.
#
# Usage:
#   GITHUB_PAT=ghp_xxx ./scripts/publish-public.sh
#   or: ./scripts/publish-public.sh ghp_xxx
#
# The PAT needs repo + workflow scopes on the iran-memorial26 account.

set -euo pipefail

PAT="${GITHUB_PAT:-${1:-}}"
REMOTE_ORG="iran-memorial26"
REMOTE_REPO="iran-memorial"
ORPHAN_BRANCH="publish-squash-$$"
CURRENT_BRANCH=$(git symbolic-ref --short HEAD)

if [[ -z "$PAT" ]]; then
  echo "ERROR: Provide PAT via GITHUB_PAT env var or first argument." >&2
  exit 1
fi

if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo "ERROR: Must be on main (currently on $CURRENT_BRANCH)." >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: Uncommitted changes detected. Commit or stash first." >&2
  exit 1
fi

COMMIT_DATE=$(date -u +"%Y-%m-%d")
HEAD_SHA=$(git rev-parse --short HEAD)

echo "→ Creating orphan snapshot of main ($HEAD_SHA)..."
git checkout --orphan "$ORPHAN_BRANCH"
git add -A
git commit --no-verify -m "snapshot: $COMMIT_DATE (squashed for public release)"

echo "→ Force-pushing to github.com/$REMOTE_ORG/$REMOTE_REPO ..."
git push \
  "https://${REMOTE_ORG}:${PAT}@github.com/${REMOTE_ORG}/${REMOTE_REPO}.git" \
  "${ORPHAN_BRANCH}:main" \
  --force

echo "→ Returning to main..."
git checkout main
git branch -D "$ORPHAN_BRANCH"

echo "✓ Published. Public repo shows 1 commit. Rotate the PAT now."
