# BCode Rebrand & Claude-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform T3 Code fork into BCode - a Claude-first coding agent GUI that retains full Codex support.

**Architecture:** Three sequential phases: (1) cherry-pick 10 upstream PRs that fix/improve Claude integration, (2) surface-level rebrand from "T3 Code" to "BCode" in user-facing strings only, (3) swap default provider from Codex to Claude. Internal identifiers (env vars, protocol, package scopes) stay unchanged for upstream compatibility.

**Tech Stack:** TypeScript, Effect.js, Vite, Electron, Bun monorepo

---

## Phase 1: Cherry-Pick Upstream PRs

### Task 1: Cherry-pick small Claude fixes (#1757, #1851, #1722)

**Files:** Various - determined by PR diffs

- [ ] **Step 1: Fetch and apply PR #1757 (Fix close claude query in probe finalizer)**

```bash
gh pr diff 1757 --repo pingdotgg/t3code | git apply --check
gh pr diff 1757 --repo pingdotgg/t3code | git apply
```

- [ ] **Step 2: Commit PR #1757**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: close claude query in probe finalizer

Cherry-picked from upstream pingdotgg/t3code#1757
EOF
)"
```

- [ ] **Step 3: Fetch and apply PR #1851 (Fix Claude Code Chats in Supervised Mode)**

```bash
gh pr diff 1851 --repo pingdotgg/t3code | git apply --check
gh pr diff 1851 --repo pingdotgg/t3code | git apply
```

- [ ] **Step 4: Commit PR #1851**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: Claude Code chats in supervised mode

Cherry-picked from upstream pingdotgg/t3code#1851
EOF
)"
```

- [ ] **Step 5: Fetch and apply PR #1722 (Fix Claude content block type narrowing)**

```bash
gh pr diff 1722 --repo pingdotgg/t3code | git apply --check
gh pr diff 1722 --repo pingdotgg/t3code | git apply
```

- [ ] **Step 6: Commit PR #1722**

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix: Claude content block type narrowing

Cherry-picked from upstream pingdotgg/t3code#1722
EOF
)"
```

- [ ] **Step 7: Verify build and tests pass**

```bash
bun install && bun run build && bun run test
```

Expected: All commands succeed with exit code 0.

### Task 2: Cherry-pick trusted performance/reliability PRs (#1687, #1688, #1689)

**Files:** Various - determined by PR diffs

- [ ] **Step 1: Apply and commit PR #1687 (Reduce checkpoint reactor stream fanout)**

```bash
gh pr diff 1687 --repo pingdotgg/t3code | git apply --check
gh pr diff 1687 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
perf: reduce checkpoint reactor stream fanout

Cherry-picked from upstream pingdotgg/t3code#1687
EOF
)"
```

- [ ] **Step 2: Apply and commit PR #1688 (Optimize streaming message projection path)**

```bash
gh pr diff 1688 --repo pingdotgg/t3code | git apply --check
gh pr diff 1688 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
perf: optimize streaming message projection path

Cherry-picked from upstream pingdotgg/t3code#1688
EOF
)"
```

- [ ] **Step 3: Apply and commit PR #1689 (Prioritize control-plane orchestration commands)**

```bash
gh pr diff 1689 --repo pingdotgg/t3code | git apply --check
gh pr diff 1689 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
feat: prioritize control-plane orchestration commands

Cherry-picked from upstream pingdotgg/t3code#1689
EOF
)"
```

- [ ] **Step 4: Verify build and tests pass**

```bash
bun run build && bun run test
```

Expected: All commands succeed with exit code 0.

### Task 3: Cherry-pick Claude stream hardening and provider handoff (#1893, #1911)

**Files:** Various - determined by PR diffs

- [ ] **Step 1: Apply and commit PR #1893 (Harden Claude stream interruption handling)**

```bash
gh pr diff 1893 --repo pingdotgg/t3code | git apply --check
gh pr diff 1893 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
fix: harden Claude stream interruption handling

Cherry-picked from upstream pingdotgg/t3code#1893
EOF
)"
```

- [ ] **Step 2: Apply and commit PR #1911 (Add provider handoff compaction on model switches)**

```bash
gh pr diff 1911 --repo pingdotgg/t3code | git apply --check
gh pr diff 1911 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
feat: add provider handoff compaction on model switches

Cherry-picked from upstream pingdotgg/t3code#1911
EOF
)"
```

- [ ] **Step 3: Verify build and tests pass**

```bash
bun run build && bun run test
```

Expected: All commands succeed with exit code 0.

### Task 4: Cherry-pick larger unvouched PRs (#2042, #1732)

**Files:** Various - determined by PR diffs

- [ ] **Step 1: Apply and commit PR #2042 (Fix Claude process leak)**

```bash
gh pr diff 2042 --repo pingdotgg/t3code | git apply --check
gh pr diff 2042 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
fix: Claude process leak, archiving, and stale session monitoring

Cherry-picked from upstream pingdotgg/t3code#2042
EOF
)"
```

- [ ] **Step 2: Apply and commit PR #1732 (Display provider usage limits in settings)**

```bash
gh pr diff 1732 --repo pingdotgg/t3code | git apply --check
gh pr diff 1732 --repo pingdotgg/t3code | git apply
git add -A
git commit -m "$(cat <<'EOF'
feat: display provider usage limits in settings

Cherry-picked from upstream pingdotgg/t3code#1732
EOF
)"
```

- [ ] **Step 3: Verify build and tests pass**

```bash
bun run build && bun run test
```

Expected: All commands succeed with exit code 0.

**Note on conflict resolution:** If any `git apply --check` fails, download the diff, inspect it, and resolve conflicts manually. For each conflict:
1. Read the failed hunks to understand intent
2. Apply the non-conflicting hunks: `gh pr diff <N> --repo pingdotgg/t3code | git apply --reject`
3. Manually merge the `.rej` files
4. Clean up `.rej` files and commit with a note about manual resolution

---

## Phase 2: Surface-Level Rebrand to BCode

### Task 5: Rebrand core branding constants

**Files:**
- Modify: `apps/desktop/src/appBranding.ts:5`
- Modify: `apps/web/src/branding.ts:13`

- [ ] **Step 1: Update desktop app base name**

In `apps/desktop/src/appBranding.ts` line 5, change:

```typescript
// Before:
const APP_BASE_NAME = "T3 Code";
// After:
const APP_BASE_NAME = "BCode";
```

- [ ] **Step 2: Update web app fallback base name**

In `apps/web/src/branding.ts` line 13, change:

```typescript
// Before:
export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "T3 Code";
// After:
export const APP_BASE_NAME = injectedDesktopAppBranding?.baseName ?? "BCode";
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/appBranding.ts apps/web/src/branding.ts
git commit -m "$(cat <<'EOF'
chore: rebrand core app name from T3 Code to BCode
EOF
)"
```

### Task 6: Rebrand desktop package and dialogs

**Files:**
- Modify: `apps/desktop/package.json:29`
- Modify: `apps/desktop/src/main.ts:120,802,907`

- [ ] **Step 1: Update desktop productName**

In `apps/desktop/package.json` line 29, change:

```json
"productName": "BCode (Alpha)"
```

- [ ] **Step 2: Update desktop dialog strings**

In `apps/desktop/src/main.ts`:

Line 120 - legacy user data dir name (keep for backwards compat with existing installs):
```typescript
// Before:
const LEGACY_USER_DATA_DIR_NAME = isDevelopment ? "T3 Code (Dev)" : "T3 Code (Alpha)";
// After (keep as-is for migration compatibility - this references old directory names):
const LEGACY_USER_DATA_DIR_NAME = isDevelopment ? "T3 Code (Dev)" : "T3 Code (Alpha)";
```
**Note:** Do NOT change `LEGACY_USER_DATA_DIR_NAME` - it must match the old directory name for migration.

Line 802 - error dialog:
```typescript
// Before:
dialog.showErrorBox("T3 Code failed to start", `Stage: ${stage}\n${message}${detail}`);
// After:
dialog.showErrorBox("BCode failed to start", `Stage: ${stage}\n${message}${detail}`);
```

Line 907 - update dialog:
```typescript
// Before:
message: `T3 Code ${updateState.currentVersion} is currently the newest version available.`,
// After:
message: `BCode ${updateState.currentVersion} is currently the newest version available.`,
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json apps/desktop/src/main.ts
git commit -m "$(cat <<'EOF'
chore: rebrand desktop app name and dialogs to BCode
EOF
)"
```

### Task 7: Rebrand web UI

**Files:**
- Modify: `apps/web/index.html:89,94,95`
- Modify: `apps/web/src/components/SplashScreen.tsx:4,5`

- [ ] **Step 1: Update index.html**

In `apps/web/index.html`:

Line 89 - page title:
```html
<title>BCode (Alpha)</title>
```

Line 94 - boot shell aria-label:
```html
<div id="boot-shell-card" aria-label="BCode splash screen">
```

Line 95 - boot shell logo alt:
```html
<img id="boot-shell-logo" src="/apple-touch-icon.png" alt="BCode" />
```

- [ ] **Step 2: Update SplashScreen component**

In `apps/web/src/components/SplashScreen.tsx`:

Line 4:
```tsx
<div className="flex size-24 items-center justify-center" aria-label="BCode splash screen">
```

Line 5:
```tsx
<img alt="BCode" className="size-16 object-contain" src="/apple-touch-icon.png" />
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/index.html apps/web/src/components/SplashScreen.tsx
git commit -m "$(cat <<'EOF'
chore: rebrand web UI title and splash screen to BCode
EOF
)"
```

### Task 8: Rebrand CI/release workflow and documentation

**Files:**
- Modify: `.github/workflows/release.yml:106`
- Modify: `README.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update release workflow**

In `.github/workflows/release.yml` line 106:

```bash
# Before:
echo "name=T3 Code v$version" >> "$GITHUB_OUTPUT"
# After:
echo "name=BCode v$version" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 2: Update README.md**

Replace all user-facing "T3 Code" references with "BCode". Keep technical references (like `t3code` package names, `npx t3` commands) as-is since those are internal identifiers we're not changing yet.

Line 1:
```markdown
# BCode
```

Line 3:
```markdown
BCode is a minimal web GUI for coding agents (currently Claude and Codex, more coming soon).
```

Line 8 (note Claude listed first now):
```markdown
> BCode currently supports Claude and Codex.
```

- [ ] **Step 3: Update AGENTS.md**

Line 10:
```markdown
BCode is a minimal web GUI for using coding agents like Claude and Codex.
```

Line 35:
```markdown
BCode is currently Claude-first. The server manages provider sessions (Claude agent SDK and Codex app-server via JSON-RPC over stdio), then streams structured events to the browser through WebSocket push messages.
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/release.yml README.md AGENTS.md
git commit -m "$(cat <<'EOF'
chore: rebrand release workflow and docs to BCode
EOF
)"
```

- [ ] **Step 5: Verify build passes**

```bash
bun run build
```

Expected: Build succeeds. The rebrand only touches strings, not logic.

---

## Phase 3: Claude-First Defaults

### Task 9: Swap default provider to Claude

**Files:**
- Modify: `packages/contracts/src/orchestration.ts:44`
- Modify: `packages/contracts/src/model.ts:59`
- Modify: `apps/web/src/modelSelection.ts:175-178`

- [ ] **Step 1: Change DEFAULT_PROVIDER_KIND**

In `packages/contracts/src/orchestration.ts` line 44:

```typescript
// Before:
export const DEFAULT_PROVIDER_KIND: ProviderKind = "codex";
// After:
export const DEFAULT_PROVIDER_KIND: ProviderKind = "claudeAgent";
```

- [ ] **Step 2: Change DEFAULT_MODEL**

In `packages/contracts/src/model.ts` line 59:

```typescript
// Before:
export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.codex;
// After:
export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.claudeAgent;
```

- [ ] **Step 3: Change text generation model fallback**

In `apps/web/src/modelSelection.ts` lines 175-178:

```typescript
// Before:
const selection = settings.textGenerationModelSelection ?? {
  provider: "codex" as const,
  model: DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER.codex,
};
// After:
const selection = settings.textGenerationModelSelection ?? {
  provider: "claudeAgent" as const,
  model: DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER.claudeAgent,
};
```

- [ ] **Step 4: Commit**

```bash
git add packages/contracts/src/orchestration.ts packages/contracts/src/model.ts apps/web/src/modelSelection.ts
git commit -m "$(cat <<'EOF'
feat: make Claude the default provider

Switch DEFAULT_PROVIDER_KIND from codex to claudeAgent and update
default model references. Codex remains fully available in the
provider picker.
EOF
)"
```

- [ ] **Step 5: Build and run tests**

```bash
bun run build && bun run test
```

Expected: Build and tests pass. Some tests may need updating if they assert on default provider being "codex" - if so, update those assertions.

---

## Phase 4: Final Verification

### Task 10: End-to-end verification

- [ ] **Step 1: Full clean build**

```bash
rm -rf node_modules/.cache
bun install && bun run build
```

Expected: Clean build with no errors.

- [ ] **Step 2: Run full test suite**

```bash
bun run test
```

Expected: All tests pass.

- [ ] **Step 3: Launch desktop app and verify branding**

```bash
bun run --filter=@t3tools/desktop dev
```

Verify:
- Window title shows "BCode (Dev)" not "T3 Code (Dev)"
- Error dialogs (if triggered) show "BCode"
- About/update dialogs show "BCode"

- [ ] **Step 4: Launch web app and verify branding**

```bash
bun run --filter=@t3tools/web dev
```

Verify:
- Browser tab title shows "BCode (Dev)"
- Splash screen aria-label and alt text say "BCode"

- [ ] **Step 5: Verify Claude is default provider**

In the web UI:
- Open provider/model picker
- Confirm Claude (claude-sonnet-4-6) is selected by default
- Confirm Codex is still available and selectable
- Start a new thread and verify it uses Claude

- [ ] **Step 6: Verify Codex still works**

- Switch to Codex in the provider picker
- Start a new thread with Codex
- Confirm it functions correctly

- [ ] **Step 7: Commit verification notes (optional)**

If any test assertions needed updating, commit those changes:

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: update assertions for Claude-first defaults
EOF
)"
```
