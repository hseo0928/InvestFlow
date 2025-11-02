#!/usr/bin/env bash
set -euo pipefail

# Setup GitHub Actions repository secrets for Supabase scheduling
# Usage:
#   scripts/setup_github_actions_secrets.sh [owner/repo]
# Requires:
#   - gh (GitHub CLI) authenticated (gh auth login)
#   - Access to the repository

REPO_SLUG="${1:-}"

if ! command -v gh >/dev/null 2>&1; then
  echo "[ERROR] GitHub CLI (gh) not found. Install: https://cli.github.com/" >&2
  exit 1
fi

if [[ -z "$REPO_SLUG" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    origin_url=$(git remote get-url origin 2>/dev/null || echo "")
    # Handle HTTPS and SSH remotes
    if [[ "$origin_url" =~ github.com[:/]+([^/]+/[^/.]+) ]]; then
      REPO_SLUG="${BASH_REMATCH[1]}"
    fi
  fi
fi

if [[ -z "$REPO_SLUG" ]]; then
  echo "[INFO] Could not auto-detect repo slug. Enter (owner/repo):" >&2
  read -r REPO_SLUG
fi

if [[ -z "${SUPABASE_URL:-}" ]]; then
  echo -n "SUPABASE_URL (e.g. https://xxxx.supabase.co): " >&2
  read -r SUPABASE_URL
fi

if [[ -z "${SUPABASE_ANON_KEY:-}" ]]; then
  echo -n "SUPABASE_ANON_KEY (paste anon key, no quotes): " >&2
  read -r SUPABASE_ANON_KEY
fi

echo "[INFO] Setting secrets on $REPO_SLUG ..."

echo -n "$SUPABASE_URL" | gh secret set SUPABASE_URL --repo "$REPO_SLUG" --app actions --body - >/dev/null
echo -n "$SUPABASE_ANON_KEY" | gh secret set SUPABASE_ANON_KEY --repo "$REPO_SLUG" --app actions --body - >/dev/null

echo "[OK] Secrets set: SUPABASE_URL, SUPABASE_ANON_KEY"
echo "You can now run the workflow in GitHub → Actions → 'Fetch Financial News' → 'Run workflow'"

