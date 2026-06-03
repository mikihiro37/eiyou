#!/usr/bin/env bash
set -u

PROJECT_NAME="eiyou"
REQUIRED_TAG="phase-2b-bulk-photo-mvp-complete"

ok() {
  printf '[OK] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

ng() {
  printf '[NG] %s\n' "$1"
}

section() {
  printf '\n=== %s ===\n' "$1"
}

run_or_warn() {
  local description="$1"
  shift

  printf '%s\n' "$description"
  if ! "$@"; then
    warn "Command failed: $*"
  fi
}

contains_eiyou_hint() {
  local repo_root="$1"

  [[ "$(basename "$repo_root")" == "$PROJECT_NAME" ]] && return 0
  [[ -f "$repo_root/wrangler.jsonc" ]] && grep -Eq '"name"[[:space:]]*:[[:space:]]*"eiyou"' "$repo_root/wrangler.jsonc" && return 0
  return 1
}

printf '=== eiyou project state check ===\n'

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  ng "This directory is not inside a Git repository."
  exit 1
fi

GIT_ROOT="$(git rev-parse --show-toplevel)"

if ! contains_eiyou_hint "$GIT_ROOT"; then
  ng "This does not look like the eiyou project: $GIT_ROOT"
  exit 1
fi

cd "$GIT_ROOT" || exit 1

section "Basic information"
printf 'Current directory: %s\n' "$(pwd)"
printf 'Git root: %s\n' "$GIT_ROOT"

CURRENT_BRANCH="$(git branch --show-current 2>/dev/null || true)"
if [[ -n "$CURRENT_BRANCH" ]]; then
  ok "Current branch: $CURRENT_BRANCH"
else
  warn "Current branch could not be determined. HEAD may be detached."
fi

run_or_warn "git status --short:" git status --short
run_or_warn "Recent commits:" git log --oneline --decorate -n 8

section "Remote state"
run_or_warn "git remote -v:" git remote -v

if git show-ref --verify --quiet refs/heads/main && git show-ref --verify --quiet refs/remotes/origin/main; then
  MAIN_LEFT_RIGHT="$(git rev-list --left-right --count main...origin/main 2>/dev/null || true)"
  if [[ -n "$MAIN_LEFT_RIGHT" ]]; then
    MAIN_AHEAD="${MAIN_LEFT_RIGHT%%[[:space:]]*}"
    MAIN_BEHIND="${MAIN_LEFT_RIGHT##*[[:space:]]}"
    if [[ "$MAIN_AHEAD" == "0" && "$MAIN_BEHIND" == "0" ]]; then
      ok "main and origin/main are aligned."
    else
      warn "main and origin/main differ. main ahead: $MAIN_AHEAD, main behind: $MAIN_BEHIND"
    fi
  else
    warn "Could not compare main and origin/main."
  fi
else
  warn "main or origin/main was not found."
fi

UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
if [[ -n "$UPSTREAM" ]]; then
  ok "Current branch upstream: $UPSTREAM"
  BRANCH_LEFT_RIGHT="$(git rev-list --left-right --count HEAD..."$UPSTREAM" 2>/dev/null || true)"
  if [[ -n "$BRANCH_LEFT_RIGHT" ]]; then
    BRANCH_AHEAD="${BRANCH_LEFT_RIGHT%%[[:space:]]*}"
    BRANCH_BEHIND="${BRANCH_LEFT_RIGHT##*[[:space:]]}"
    if [[ "$BRANCH_AHEAD" == "0" && "$BRANCH_BEHIND" == "0" ]]; then
      ok "Current branch and upstream are aligned."
    else
      warn "Current branch and upstream differ. ahead: $BRANCH_AHEAD, behind: $BRANCH_BEHIND"
    fi
  fi
else
  warn "Current branch has no upstream, or HEAD is detached."
fi

section "Important files"
IMPORTANT_FILES=(
  "index.html"
  "checker.html"
  "checker/bulk-photo.js"
  "checker/app.js"
  "checker/style.css"
  "wrangler.jsonc"
)

for file in "${IMPORTANT_FILES[@]}"; do
  if [[ -f "$file" ]]; then
    ok "Found: $file"
  else
    ng "Missing: $file"
  fi
done

section "bulk-photo script loading"
if [[ -f "checker.html" ]]; then
  if grep -Fq "checker/bulk-photo.js" "checker.html"; then
    ok "checker.html references checker/bulk-photo.js"
  else
    warn "checker.html does not reference checker/bulk-photo.js"
  fi
else
  ng "checker.html is missing; bulk-photo loading could not be checked."
fi

section "Cloudflare wrangler config"
if [[ -f "wrangler.jsonc" ]]; then
  if grep -Eq '"name"[[:space:]]*:[[:space:]]*"eiyou"' "wrangler.jsonc"; then
    ok 'wrangler.jsonc has name = "eiyou"'
  else
    warn 'wrangler.jsonc does not appear to have name = "eiyou"'
  fi

  if grep -Eq '"directory"[[:space:]]*:[[:space:]]*"\."' "wrangler.jsonc"; then
    ok 'wrangler.jsonc has assets.directory = "."'
  else
    warn 'wrangler.jsonc does not appear to have assets.directory = "."'
  fi
else
  ng "wrangler.jsonc is missing."
fi

section "Sensitive file name check"
SENSITIVE_PATTERN='(^|/)(\.env|\.clasp\.json|\.clasprc\.json|key\.json)$|secret|token|credential|apikey|api_key|private'
SENSITIVE_MATCHES="$(
  {
    git ls-files
    git ls-files --others --exclude-standard
  } | grep -E -i "$SENSITIVE_PATTERN" || true
)"

if [[ -n "$SENSITIVE_MATCHES" ]]; then
  warn "Potentially sensitive file names found. Review before committing:"
  printf '%s\n' "$SENSITIVE_MATCHES"
else
  ok "No sensitive file names found in tracked or untracked files."
fi

section "Tag check"
if git rev-parse -q --verify "refs/tags/$REQUIRED_TAG" >/dev/null; then
  TAG_COMMIT="$(git rev-list -n 1 "$REQUIRED_TAG")"
  HEAD_COMMIT="$(git rev-parse HEAD)"
  ok "Tag exists: $REQUIRED_TAG"
  printf 'Tag commit: %s\n' "$TAG_COMMIT"
  printf 'HEAD commit: %s\n' "$HEAD_COMMIT"
  if [[ "$TAG_COMMIT" == "$HEAD_COMMIT" ]]; then
    ok "Tag points to current HEAD."
  else
    warn "Tag does not point to current HEAD."
  fi
else
  warn "Tag does not exist: $REQUIRED_TAG"
fi

section "Result"
ok "Project state check completed."
exit 0
