#!/usr/bin/env bash
# Set FANOUT_TOKEN on every repository the release fan-out touches.
#
# This package dispatches a repository_dispatch to each app on release; each app's
# web-core-bump.yml then checks out and opens the bump PR with the same PAT. So the
# secret has to exist here (the sender) and in every app (the receivers).
#
# The app list is read out of release.yml rather than repeated here: the fan-out
# matrix is the definition of which repos take part, and a second copy of it would
# drift the first time an app is added.
#
# What this cannot do: a fine-grained PAT's *repository access* is not exposed by the
# REST API, so granting a token access to a new repo stays a manual step in the GitHub
# UI. This only distributes a token you have already minted.
#
# Usage:
#   scripts/rotate-fanout-token.sh              # prompts for the token, input hidden
#   FANOUT_TOKEN=github_pat_... scripts/rotate-fanout-token.sh
#   scripts/rotate-fanout-token.sh --check      # report where the secret exists
#   scripts/rotate-fanout-token.sh --dry-run    # print what would be set

set -euo pipefail

OWNER=gregor
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASE_WORKFLOW="$ROOT/.github/workflows/release.yml"

MODE="set"
case "${1:-}" in
  --check)   MODE="check" ;;
  --dry-run) MODE="dry-run" ;;
  '')        ;;
  *) echo "unknown argument: $1" >&2; exit 2 ;;
esac

command -v gh >/dev/null || { echo "gh is not installed" >&2; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "gh is not authenticated; run: gh auth login" >&2; exit 1; }
[ -f "$RELEASE_WORKFLOW" ] || { echo "cannot find $RELEASE_WORKFLOW" >&2; exit 1; }

# The single `repo: [...]` line in the fan-out matrix, split on commas.
apps_line="$(grep -oE '^ *repo: \[[^]]*\]' "$RELEASE_WORKFLOW" | head -1 | sed -E 's/^ *repo: \[//; s/\]$//')"
if [ -z "$apps_line" ]; then
  echo "could not read the fan-out matrix from $RELEASE_WORKFLOW" >&2
  echo "expected a line of the form:  repo: [web-budget, web-dashboard, ...]" >&2
  exit 1
fi
IFS=',' read -ra APPS <<< "$apps_line"
APPS=("${APPS[@]// /}")

# This repo sends the dispatch, so it needs the token too.
REPOS=("$(basename "$ROOT")" "${APPS[@]}")

if [ "$MODE" = "check" ]; then
  printf '%-16s %s\n' REPOSITORY FANOUT_TOKEN
  for repo in "${REPOS[@]}"; do
    if ! gh repo view "$OWNER/$repo" >/dev/null 2>&1; then
      printf '%-16s %s\n' "$repo" "unreachable"
    elif updated="$(gh secret list -R "$OWNER/$repo" --json name,updatedAt \
        -q '.[] | select(.name == "FANOUT_TOKEN") | .updatedAt' 2>/dev/null)" && [ -n "$updated" ]; then
      printf '%-16s %s\n' "$repo" "set  $updated"
    else
      printf '%-16s %s\n' "$repo" "MISSING"
    fi
  done
  exit 0
fi

# Read the token without echoing it and without letting it reach the shell history or
# a process listing.
if [ -z "${FANOUT_TOKEN:-}" ] && [ "$MODE" != "dry-run" ]; then
  read -rsp "FANOUT_TOKEN (input hidden): " FANOUT_TOKEN
  echo
fi
if [ "$MODE" != "dry-run" ] && [ -z "${FANOUT_TOKEN:-}" ]; then
  echo "no token given" >&2
  exit 1
fi

# Fail before writing anything rather than leaving half the repos rotated.
missing=()
for repo in "${REPOS[@]}"; do
  gh repo view "$OWNER/$repo" >/dev/null 2>&1 || missing+=("$repo")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "cannot reach: ${missing[*]}" >&2
  echo "check the repo names in the fan-out matrix, and that your gh login can see them" >&2
  exit 1
fi

for repo in "${REPOS[@]}"; do
  if [ "$MODE" = "dry-run" ]; then
    echo "would set FANOUT_TOKEN on $OWNER/$repo"
    continue
  fi
  # --body - keeps the token off the command line.
  printf '%s' "$FANOUT_TOKEN" | gh secret set FANOUT_TOKEN -R "$OWNER/$repo" --body -
  echo "set FANOUT_TOKEN on $OWNER/$repo"
done

if [ "$MODE" = "dry-run" ]; then
  exit 0
fi

cat <<'REMINDER'

Done. Two things the API cannot do for you:

  1. Grant the PAT repository access — Settings → Developer settings → Personal access
     tokens → Fine-grained tokens → the token → Repository access. The app repos
     above need Contents: write and Pull requests: write, plus Workflows: write
     (without that, the bump PR's reusable-workflow repin commit is dropped with a
     warning and Dependabot repins it on its next weekly run instead). This repo only
     stores the token to dispatch with; it needs no access to itself.

  2. Revoke the old token, once a release has proven the new one works.

Verify with: scripts/rotate-fanout-token.sh --check
REMINDER
