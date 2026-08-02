#!/usr/bin/env bash
#
# figma-import.sh — import a fresh Figma Make export using the VENDOR-BRANCH workflow.
#
# ---------------------------------------------------------------------------
# WHY THIS IS NOT A STRAIGHT COPY  (read before changing anything below)
# ---------------------------------------------------------------------------
# apps/web started life as a Figma Make export. Since then we have layered real
# API calls, state management and WebSocket code INTO THE SAME FILES that Figma
# regenerates. A new export therefore cannot be pasted over apps/web — doing so
# silently deletes every bit of wiring we wrote.
#
# Instead we keep a vendor branch:
#
#   figma-baseline   pristine Figma export, zero wiring.
#   staging / main   the wired code.
#
# figma-baseline is the COMMON ANCESTOR of staging (git merge-base staging
# figma-baseline == the baseline tip). That single fact is what makes this work:
#
#   1. commit the new export ONTO figma-baseline  (this script, --apply)
#   2. git checkout staging && git merge figma-baseline   (the human, afterwards)
#
# Git then performs a true 3-way merge. It computes the DESIGN DELTA
# (old baseline -> new export) and replays it onto the wired code, raising a
# conflict only where the design and our wiring touched the same lines. Files we
# wired but Figma did not change merge cleanly. Files Figma changed but we never
# wired merge cleanly. Only the true collisions need a human — and this script's
# default report tells you which those are BEFORE you touch anything.
#
# Corollary: never `git checkout figma-baseline -- apps/web` onto staging, and
# never rebase/squash figma-baseline. Both destroy the ancestry the merge needs.
#
# ---------------------------------------------------------------------------
# THREE CLASSES OF FILE THAT ARE *NOT* PURE DESIGN
# ---------------------------------------------------------------------------
# EXCLUDE_PATHS  — shipped by the export but actively harmful here.
#                  pnpm-workspace.yaml declares `packages: ['.']` (the export is
#                  a standalone project). Dropping that into apps/web/ would
#                  shadow the real monorepo workspace file at the repo root.
#                  Never copied.
#
# ADAPTED_PATHS  — files we deliberately diverged from the export ON the baseline
#                  branch so the export fits the monorepo. Overwriting them from
#                  a new export breaks the build, so they are never auto-copied;
#                  the report prints the diff for manual reconciliation instead.
#                  See the per-entry comments on the array below.
#
# PRESERVE_PATHS — repo infra that lives under apps/web but that the export never
#                  ships (.env.example). Absent-from-export is normal for these,
#                  so they are reported as PRESERVED rather than as a loud
#                  REMOVED. Nothing ever deletes them.
#
# A future export may add new adaptation points. When you hand-fix a file after a
# merge because the monorepo needs it different from Figma, add it to
# ADAPTED_PATHS so the next import stops overwriting it.
# ---------------------------------------------------------------------------

set -euo pipefail

BASELINE_BRANCH="${FIGMA_BASELINE_BRANCH:-figma-baseline}"
WIRED_BRANCH="${FIGMA_WIRED_BRANCH:-staging}"
WEB_PREFIX="apps/web"

# Shipped by the export, never copied into the monorepo. See rationale above.
EXCLUDE_PATHS=(
  "pnpm-workspace.yaml"   # export declares packages:['.'] — would shadow the root workspace
)

# Intentionally divergent on figma-baseline. Never auto-overwritten.
ADAPTED_PATHS=(
  "package.json"          # renamed @tuba/web, adds @tuba/shared workspace dep,
                          # drops the export's pnpm.overrides pin of vite 6.3.5
                          # which conflicts with the root override ^6.4.3
  "src/app/lib/i18n.ts"   # replaced by a re-export shim to @tuba/shared so the
                          # backend reuses the same STRINGS/Lang for PDFs + notifications
)

# Repo infra under apps/web that the export legitimately never ships.
PRESERVE_PATHS=(
  ".env.example"
)

# Directory prefixes never read from the export and never written to.
EXCLUDE_DIR_PREFIXES=(
  "node_modules/"
  "dist/"
  "build/"
  ".vite/"
  ".git/"
)

# ---------------------------------------------------------------------------
# presentation
# ---------------------------------------------------------------------------
if [ -t 1 ] && [ -z "${NO_COLOR:-}" ]; then
  C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
  C_RED=$'\033[31m'; C_GRN=$'\033[32m'; C_YEL=$'\033[33m'
  C_BLU=$'\033[34m'; C_MAG=$'\033[35m'; C_CYN=$'\033[36m'
else
  C_RESET=''; C_BOLD=''; C_DIM=''
  C_RED=''; C_GRN=''; C_YEL=''; C_BLU=''; C_MAG=''; C_CYN=''
fi

hr() { printf '%s\n' "------------------------------------------------------------------------"; }
section() { printf '\n%s%s== %s ==%s\n' "$C_BOLD" "$C_BLU" "$1" "$C_RESET"; }
info()  { printf '%s\n' "$*"; }
warn()  { printf '%s%s%s\n' "$C_YEL" "$*" "$C_RESET"; }
err()   { printf '%s%s%s\n' "$C_RED" "$*" "$C_RESET" >&2; }
ok()    { printf '%s%s%s\n' "$C_GRN" "$*" "$C_RESET"; }

die() { err "ERROR: $*"; exit 1; }

usage() {
  cat <<EOF
${C_BOLD}usage${C_RESET}: scripts/figma-import.sh <path-to-new-figma-export> [--apply]

  (no flag)   READ-ONLY report. Classifies every file in the export against the
              '${BASELINE_BRANCH}' branch and tells you which changes will
              collide with our wiring. Mutates nothing.

  --apply     Commit the export onto '${BASELINE_BRANCH}', then return you to the
              branch you started on. Does NOT run the merge — that needs a human.

Example:
  scripts/figma-import.sh "/c/Users/DBL/Downloads/Design System Setup"
  scripts/figma-import.sh "/c/Users/DBL/Downloads/Design System Setup" --apply
EOF
}

# ---------------------------------------------------------------------------
# argument parsing
# ---------------------------------------------------------------------------
EXPORT_DIR=""
APPLY=0

while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) usage; die "unknown flag: $1" ;;
    *)
      [ -n "$EXPORT_DIR" ] && { usage; die "unexpected extra argument: $1"; }
      EXPORT_DIR="$1"; shift ;;
  esac
done

[ -n "$EXPORT_DIR" ] || { usage; exit 1; }

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
in_list() {
  local needle="$1"; shift
  local item
  for item in "$@"; do
    [ "$item" = "$needle" ] && return 0
  done
  return 1
}

# Should this relative path be skipped entirely (never read, never written)?
is_excluded() {
  local rel="$1" p
  for p in "${EXCLUDE_DIR_PREFIXES[@]}"; do
    case "$rel" in "$p"*) return 0 ;; esac
  done
  # never touch env files, in either direction
  case "$(basename -- "$rel")" in .env|.env.*) return 0 ;; esac
  in_list "$rel" "${EXCLUDE_PATHS[@]}" && return 0
  return 1
}

is_adapted()  { in_list "$1" "${ADAPTED_PATHS[@]}"; }
is_preserve() { in_list "$1" "${PRESERVE_PATHS[@]}"; }

# Blob id git WOULD store for this on-disk file at that repo path.
# --path makes git apply the same eol/filter attributes `git add` would, so the
# comparison stays exact under core.autocrlf=true (this repo) instead of
# reporting spurious CHANGED for CRLF-only differences.
export_blob() {
  local rel="$1"
  git hash-object --path="$WEB_PREFIX/$rel" -- "$EXPORT_DIR/$rel"
}

baseline_blob() {
  git rev-parse --verify --quiet "$BASELINE_BRANCH:$WEB_PREFIX/$1" 2>/dev/null
}

# ---------------------------------------------------------------------------
# VALIDATION
# ---------------------------------------------------------------------------
section "VALIDATION"

git rev-parse --git-dir >/dev/null 2>&1 || die "not inside a git repository."
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
info "repo root        : $REPO_ROOT"

[ -e "$EXPORT_DIR" ] || die "export path does not exist: $EXPORT_DIR"
[ -d "$EXPORT_DIR" ] || die "export path is not a directory: $EXPORT_DIR"
EXPORT_DIR="$(cd "$EXPORT_DIR" && pwd)"
info "export path      : $EXPORT_DIR"

# Does it actually look like a Figma Make export?
if [ ! -d "$EXPORT_DIR/src/app/pages" ] && [ ! -d "$EXPORT_DIR/src/app" ]; then
  err "That directory does not look like a Figma Make export."
  err "Expected to find 'src/app/pages/' (or at least 'src/app/') inside it."
  err "The export root is the folder containing src/, index.html and package.json"
  err "— it maps onto ${WEB_PREFIX}/. Point me at that folder and try again."
  exit 1
fi
ok "looks like a Figma export (found src/app/)"

for br in "$BASELINE_BRANCH" "$WIRED_BRANCH"; do
  git rev-parse --verify --quiet "refs/heads/$br" >/dev/null \
    || die "branch '$br' not found. This workflow needs both '$BASELINE_BRANCH' and '$WIRED_BRANCH'."
done
info "baseline branch  : $BASELINE_BRANCH ($(git rev-parse --short "$BASELINE_BRANCH"))"
info "wired branch     : $WIRED_BRANCH ($(git rev-parse --short "$WIRED_BRANCH"))"

MERGE_BASE="$(git merge-base "$WIRED_BRANCH" "$BASELINE_BRANCH" 2>/dev/null || true)"
BASELINE_TIP="$(git rev-parse "$BASELINE_BRANCH")"
if [ "$MERGE_BASE" = "$BASELINE_TIP" ]; then
  ok "ancestry OK: '$BASELINE_BRANCH' is an ancestor of '$WIRED_BRANCH' (3-way merge will work)"
else
  warn "NOTE: '$BASELINE_BRANCH' tip is not the merge-base of '$WIRED_BRANCH'."
  warn "      merge-base = ${MERGE_BASE:-<none>}"
  warn "      That is normal if a previous export was already merged; it is a"
  warn "      problem if the branch was rebased or squashed."
fi

# Branch switching happens in --apply, so a dirty tree is unsafe in any mode.
ORIG_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$ORIG_BRANCH" != "HEAD" ] || die "detached HEAD. Check out a branch before running this."
info "current branch   : $ORIG_BRANCH"

# Dirty-tree guard. We care about the REASON (--apply switches branches and runs
# `git add apps/web`), not the letter of `git status --porcelain`:
#   - modified/staged TRACKED files anywhere  -> hard refuse. git checkout can
#     refuse or carry them across branches, and they could be lost or swept in.
#   - UNTRACKED files under apps/web          -> hard refuse. `git add apps/web`
#     would commit them onto the pristine vendor branch.
#   - UNTRACKED files elsewhere               -> warn only. They do not impede a
#     checkout and `git add apps/web` cannot pick them up. Refusing here would
#     also make this script block itself: scripts/figma-import.sh is itself
#     untracked until someone commits it.
DIRTY_TRACKED="$(git status --porcelain --untracked-files=no)"
UNTRACKED_WEB="$(git ls-files --others --exclude-standard -- "$WEB_PREFIX")"
UNTRACKED_OTHER="$(git ls-files --others --exclude-standard | grep -v "^$WEB_PREFIX/" || true)"

if [ -n "$DIRTY_TRACKED" ]; then
  err "Working tree has uncommitted changes to tracked files. This script switches"
  err "branches, so it refuses to run. Commit or stash them first:"
  err ""
  printf '%s\n' "$DIRTY_TRACKED" | sed 's/^/  /' >&2
  exit 1
fi

if [ -n "$UNTRACKED_WEB" ]; then
  err "Untracked files exist under $WEB_PREFIX/. --apply runs 'git add $WEB_PREFIX',"
  err "which would commit them onto the pristine '$BASELINE_BRANCH' branch."
  err "Move, remove or commit them first:"
  err ""
  printf '%s\n' "$UNTRACKED_WEB" | sed 's/^/  /' >&2
  exit 1
fi

ok "no uncommitted changes to tracked files"
if [ -n "$UNTRACKED_OTHER" ]; then
  warn "note: untracked files exist outside $WEB_PREFIX/ (harmless here, not committed):"
  printf '%s\n' "$UNTRACKED_OTHER" | sed 's/^/    /'
fi

# ---------------------------------------------------------------------------
# BUILD FILE LISTS
# ---------------------------------------------------------------------------
TMPDIR_SELF="$(mktemp -d)"
cleanup_tmp() { rm -rf "$TMPDIR_SELF"; }
trap cleanup_tmp EXIT

EXPORT_LIST="$TMPDIR_SELF/export.txt"
BASELINE_LIST="$TMPDIR_SELF/baseline.txt"
WIRED_LIST="$TMPDIR_SELF/wired.txt"

( cd "$EXPORT_DIR" && find . -type f -not -path './node_modules/*' -not -path './.git/*' \
    | sed 's|^\./||' | LC_ALL=C sort ) > "$EXPORT_LIST"

git ls-tree -r --name-only "$BASELINE_BRANCH" -- "$WEB_PREFIX" \
  | sed "s|^$WEB_PREFIX/||" | LC_ALL=C sort > "$BASELINE_LIST"

# Files we have wired = differ between baseline and the wired branch.
git diff --name-only "$BASELINE_BRANCH" "$WIRED_BRANCH" -- "$WEB_PREFIX" \
  | sed "s|^$WEB_PREFIX/||" | LC_ALL=C sort > "$WIRED_LIST"

is_wired() { grep -qxF -- "$1" "$WIRED_LIST"; }

# ---------------------------------------------------------------------------
# CLASSIFY
# ---------------------------------------------------------------------------
RECONCILE=(); FAST=(); WIRE_NEEDED=(); UNCHANGED=(); ADAPTED_DIFF=()
ADAPTED_SAME=(); SKIPPED=(); REMOVED=(); PRESERVED=()

while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  if is_excluded "$rel"; then
    SKIPPED+=("$rel"); continue
  fi

  b_blob="$(baseline_blob "$rel" || true)"
  e_blob="$(export_blob "$rel")"

  if [ -z "$b_blob" ]; then
    WIRE_NEEDED+=("$rel"); continue
  fi

  if [ "$b_blob" = "$e_blob" ]; then
    if is_adapted "$rel"; then ADAPTED_SAME+=("$rel"); else UNCHANGED+=("$rel"); fi
    continue
  fi

  # content differs
  if is_adapted "$rel"; then
    ADAPTED_DIFF+=("$rel"); continue
  fi
  if is_wired "$rel"; then
    RECONCILE+=("$rel")
  else
    FAST+=("$rel")
  fi
done < "$EXPORT_LIST"

# Baseline files the export does not ship.
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  grep -qxF -- "$rel" "$EXPORT_LIST" && continue
  # is_preserve is checked BEFORE is_excluded so known repo infra (.env.example,
  # which also matches the .env* exclusion) is reported as PRESERVED rather than
  # silently vanishing from the report. Neither class is ever deleted or copied.
  if is_preserve "$rel"; then PRESERVED+=("$rel"); continue; fi
  is_excluded "$rel" && continue
  REMOVED+=("$rel")
done < "$BASELINE_LIST"

print_list() {
  local label="$1" colour="$2"; shift 2
  [ $# -eq 0 ] && return 0
  printf '\n%s%s%s (%d)\n' "$colour" "$label" "$C_RESET" "$#"
  printf '  %s\n' "$@"
}

# ---------------------------------------------------------------------------
# REPORT
# ---------------------------------------------------------------------------
section "CLASSIFICATION  (export vs '$BASELINE_BRANCH')"

print_list "RECONCILE   — design changed AND we wired it; merge may conflict" "$C_RED$C_BOLD" "${RECONCILE[@]}"
print_list "WIRE-NEEDED — new file in the export; copy in, then wire to the API" "$C_MAG" "${WIRE_NEEDED[@]}"
print_list "FAST        — design changed, not wired; should merge cleanly" "$C_CYN" "${FAST[@]}"
print_list "REMOVED     — on $BASELINE_BRANCH but MISSING from the export (may be a rename!)" "$C_RED$C_BOLD" "${REMOVED[@]}"
print_list "ADAPTED     — monorepo-adapted; export differs, NOT auto-copied" "$C_YEL$C_BOLD" "${ADAPTED_DIFF[@]}"
print_list "ADAPTED(=)  — monorepo-adapted and export matches; left alone" "$C_YEL" "${ADAPTED_SAME[@]}"
print_list "SKIPPED     — excluded by policy, never copied" "$C_DIM" "${SKIPPED[@]}"
print_list "PRESERVED   — repo infra the export never ships; kept as-is" "$C_DIM" "${PRESERVED[@]}"

if [ "${#UNCHANGED[@]}" -gt 0 ]; then
  printf '\n%sUNCHANGED   — identical to %s (%d)%s\n' "$C_GRN" "$BASELINE_BRANCH" "${#UNCHANGED[@]}" "$C_RESET"
  printf '  %s(listing suppressed; set FIGMA_SHOW_UNCHANGED=1 to see them)%s\n' "$C_DIM" "$C_RESET"
  [ -n "${FIGMA_SHOW_UNCHANGED:-}" ] && printf '  %s\n' "${UNCHANGED[@]}"
fi

section "SUMMARY"
printf '  %-12s %4d   %s\n' "RECONCILE"   "${#RECONCILE[@]}"    "needs human attention during the merge"
printf '  %-12s %4d   %s\n' "WIRE-NEEDED" "${#WIRE_NEEDED[@]}"  "new screens to wire after the merge"
printf '  %-12s %4d   %s\n' "FAST"        "${#FAST[@]}"         "should merge cleanly"
printf '  %-12s %4d   %s\n' "UNCHANGED"   "${#UNCHANGED[@]}"    "no design delta"
printf '  %-12s %4d   %s\n' "REMOVED"     "${#REMOVED[@]}"      "missing from export — check for renames"
printf '  %-12s %4d   %s\n' "ADAPTED"     "${#ADAPTED_DIFF[@]}" "reconcile by hand, never auto-copied"
printf '  %-12s %4d   %s\n' "SKIPPED"     "${#SKIPPED[@]}"      "excluded by policy"
printf '  %-12s %4d   %s\n' "PRESERVED"   "${#PRESERVED[@]}"    "kept, export does not ship them"
hr
printf '  %-12s %4d   %s\n' "wired files" "$(wc -l < "$WIRED_LIST" | tr -d ' ')" \
       "differ between $BASELINE_BRANCH and $WIRED_BRANCH"

# ---------------------------------------------------------------------------
# WORK-LIST
# ---------------------------------------------------------------------------
if [ "${#RECONCILE[@]}" -gt 0 ] || [ "${#ADAPTED_DIFF[@]}" -gt 0 ] || [ "${#REMOVED[@]}" -gt 0 ]; then
  section "YOUR WORK-LIST"
fi

if [ "${#RECONCILE[@]}" -gt 0 ]; then
  printf '%sThese files changed in the design AND carry our wiring. Git will 3-way\n' "$C_BOLD"
  printf 'merge them; review every conflict hunk and keep BOTH the new markup and\n'
  printf 'the existing API/socket calls:%s\n\n' "$C_RESET"
  printf '  %s\n' "${RECONCILE[@]}"
  printf '\n  Inspect one before merging:\n'
  printf '    %sgit diff %s:%s/<file> -- "%s/<file>"%s\n' \
         "$C_DIM" "$BASELINE_BRANCH" "$WEB_PREFIX" "$WEB_PREFIX" "$C_RESET"
fi

if [ "${#ADAPTED_DIFF[@]}" -gt 0 ]; then
  printf '\n%sMonorepo-adapted files the new export also changed.%s\n' "$C_YEL$C_BOLD" "$C_RESET"
  printf 'They are NOT copied automatically — that would undo the adaptation.\n'
  printf 'Diff each one and hand-port only the genuinely new design/dependency bits:\n\n'
  for f in "${ADAPTED_DIFF[@]}"; do
    printf '  %s\n' "$f"
    printf '    %sgit show %s:%s/%s | diff - "%s/%s"%s\n' \
           "$C_DIM" "$BASELINE_BRANCH" "$WEB_PREFIX" "$f" "$EXPORT_DIR" "$f" "$C_RESET"
  done
fi

if [ "${#REMOVED[@]}" -gt 0 ]; then
  printf '\n%sFiles on %s that the export no longer ships.%s\n' "$C_RED$C_BOLD" "$BASELINE_BRANCH" "$C_RESET"
  printf 'Nothing is deleted automatically. Check whether each was RENAMED in Figma\n'
  printf '(look for a matching WIRE-NEEDED entry above) before removing anything:\n\n'
  printf '  %s\n' "${REMOVED[@]}"
fi

# ---------------------------------------------------------------------------
# NEXT STEPS  (report mode)
# ---------------------------------------------------------------------------
if [ "$APPLY" -eq 0 ]; then
  section "NEXT STEPS  (nothing has been modified)"
  info "This was a read-only report. The working tree, index and all branches are"
  info "untouched. When the work-list above looks right:"
  printf '\n  %s1.%s commit the export onto the vendor branch\n' "$C_BOLD" "$C_RESET"
  printf '     %sscripts/figma-import.sh "%s" --apply%s\n' "$C_GRN" "$EXPORT_DIR" "$C_RESET"
  printf '\n  %s2.%s replay the design delta onto the wired code (conflicts land here)\n' "$C_BOLD" "$C_RESET"
  printf '     %sgit checkout %s && git merge %s%s\n' "$C_GRN" "$WIRED_BRANCH" "$BASELINE_BRANCH" "$C_RESET"
  printf '\n  %s3.%s resolve, then verify the app builds\n' "$C_BOLD" "$C_RESET"
  printf '     %spnpm -C %s build%s\n' "$C_GRN" "$WEB_PREFIX" "$C_RESET"
  printf '\n'
  exit 0
fi

# ---------------------------------------------------------------------------
# APPLY
# ---------------------------------------------------------------------------
section "APPLY  (committing export onto '$BASELINE_BRANCH')"

SWITCHED=0
restore_branch() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$SWITCHED" -eq 1 ]; then
    local now; now="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
    if [ "$now" != "$ORIG_BRANCH" ]; then
      printf '\n'
      warn "returning you to '$ORIG_BRANCH'..."
      if git checkout "$ORIG_BRANCH" >/dev/null 2>&1; then
        ok "back on '$ORIG_BRANCH'"
      else
        err "COULD NOT return to '$ORIG_BRANCH'. You are on '$now'."
        err "Your work is safe, but resolve this before continuing:"
        err "  git status"
        err "  git checkout $ORIG_BRANCH"
      fi
    fi
  fi
  if [ "$rc" -ne 0 ]; then
    printf '\n'
    err "--apply did not finish cleanly (exit $rc)."
    err "State: branch '$BASELINE_BRANCH' may or may not have the new commit."
    err "Check with:  git log --oneline -3 $BASELINE_BRANCH"
    err "Nothing was force-pushed, reset or deleted."
  fi
  cleanup_tmp
  exit "$rc"
}
trap restore_branch EXIT INT TERM

info "checking out '$BASELINE_BRANCH'..."
git checkout "$BASELINE_BRANCH" >/dev/null 2>&1 || die "could not check out '$BASELINE_BRANCH'"
SWITCHED=1
ok "on '$BASELINE_BRANCH'"

# Overlay copy: writes only files the export ships. Never deletes, never mirrors.
# (Deliberately NOT rsync --delete: files we added and the export does not carry
#  — src/app/lib/api.ts, components/States.tsx, .env.example — must survive.)
copied=0; skipped_copy=0
while IFS= read -r rel; do
  [ -n "$rel" ] || continue
  if is_excluded "$rel" || is_adapted "$rel"; then
    skipped_copy=$((skipped_copy + 1)); continue
  fi
  dest="$WEB_PREFIX/$rel"
  mkdir -p "$(dirname -- "$dest")"
  cp -- "$EXPORT_DIR/$rel" "$dest"
  copied=$((copied + 1))
done < "$EXPORT_LIST"

ok "overlaid $copied file(s); left $skipped_copy excluded/adapted file(s) alone"
info "nothing deleted — wired-only files under $WEB_PREFIX are intact"

# safecrlf=false silences the per-file "LF will be replaced by CRLF" notices.
# This repo has core.autocrlf=true and no .gitattributes, so that conversion is
# expected for every file on Windows and the notices drown the real output. The
# conversion still happens; only the advisory is suppressed. Classification above
# already accounts for it via `git hash-object --path=`.
git -c core.safecrlf=false add -- "$WEB_PREFIX"

if git diff --cached --quiet; then
  info ""
  ok "No changes to commit — '$BASELINE_BRANCH' already matches this export."
  info "(Safe to re-run; this script is idempotent.)"
  NOTHING_COMMITTED=1
else
  printf '\n%sstaged changes:%s\n' "$C_BOLD" "$C_RESET"
  git diff --cached --stat | sed 's/^/  /'
  git commit -q -m "chore(figma): import export from '$(basename -- "$EXPORT_DIR")'

Source: $EXPORT_DIR
Imported: $(date '+%Y-%m-%d %H:%M:%S %z')

Vendor-branch import via scripts/figma-import.sh. Pristine design only —
no wiring. Merge into $WIRED_BRANCH to replay the design delta onto the
wired code."
  printf '\n'
  ok "committed $(git rev-parse --short HEAD) on '$BASELINE_BRANCH'"
  NOTHING_COMMITTED=0
fi

git checkout "$ORIG_BRANCH" >/dev/null 2>&1
SWITCHED=0
ok "back on '$ORIG_BRANCH'"

trap cleanup_tmp EXIT
trap - INT TERM

section "NEXT STEP  —  THE MERGE IS YOURS TO RUN"
if [ "$NOTHING_COMMITTED" -eq 1 ]; then
  info "Nothing new landed on '$BASELINE_BRANCH', so there is likely nothing to merge."
  info "Run this only if a previous import has not been merged yet:"
else
  info "The export is committed on '$BASELINE_BRANCH'. Now replay the design delta"
  info "onto the wired code. This is NOT run automatically — conflicts need you:"
fi
printf '\n  %sgit checkout %s && git merge %s%s\n\n' "$C_GRN$C_BOLD" "$WIRED_BRANCH" "$BASELINE_BRANCH" "$C_RESET"
if [ "${#RECONCILE[@]}" -gt 0 ]; then
  warn "Expect conflicts in ${#RECONCILE[@]} RECONCILE file(s) listed above."
  info "In each: keep the new Figma markup AND our existing API/socket calls."
fi
info "Then:  pnpm -C $WEB_PREFIX build"
printf '\n'
