# BCode: Rebrand & Claude-First Transformation

## Context

This repo is a fork of [pingdotgg/t3code](https://github.com/pingdotgg/t3code) - a minimal web GUI for coding agents. The fork will diverge in identity and direction: **BCode** will be Claude-first while maintaining existing Codex capabilities. The upstream will continue to be tracked for cherry-picking future improvements.

Currently the app is Codex-first (`DEFAULT_PROVIDER_KIND = "codex"`, default model `gpt-5.4`). Claude integration exists and is substantial (~150KB of adapter code) but is secondary. The provider abstraction layer (`ProviderAdapterShape`) cleanly separates both implementations.

**Goals:**
- Establish BCode as its own product identity
- Make Claude the default AI provider
- Incorporate upstream Claude-related bug fixes and improvements
- Preserve all existing Codex functionality
- Minimize merge conflicts for future upstream cherry-picks

## Approach: Cherry-Pick → Rebrand → Claude-First

Sequenced to minimize merge conflicts: apply upstream PRs against unmodified code first, then layer identity and default changes on top.

---

## Phase 1: Cherry-Pick Upstream PRs

Apply 10 PRs from `pingdotgg/t3code` in order from smallest/safest to largest.

### Small Claude Fixes (low risk)

| PR | Title | Size | What it fixes |
|----|-------|------|---------------|
| #1757 | Fix close claude query in probe finalizer | XS | Resource leak in Claude provider probing |
| #1851 | Fix Claude Code Chats in Supervised Mode | XS | Claude sessions broken in non-full-access mode |
| #1722 | Fix Claude content block type narrowing | M | Type safety in Claude response parsing |

### Trusted Performance & Reliability

| PR | Title | Size | What it improves |
|----|-------|------|------------------|
| #1687 | Reduce checkpoint reactor stream fanout | S | Less overhead in state checkpointing |
| #1688 | Optimize streaming message projection path | L | Faster message rendering during streaming |
| #1689 | Prioritize control-plane orchestration commands | L | Agent commands don't get queued behind data |
| #1893 | Harden Claude stream interruption handling | L | Graceful recovery when Claude streams are interrupted |
| #1911 | Add provider handoff compaction on model switches | XL | Cleaner context when switching between providers/models |

### Larger Unvouched (review carefully)

| PR | Title | Size | What it adds |
|----|-------|------|--------------|
| #2042 | Fix Claude process leak, archiving, stale session monitoring | L | Prevents orphaned Claude processes consuming memory |
| #1732 | Display provider usage limits in settings | XXL | Shows token/rate limits in settings UI |

### Cherry-Pick Process

For each PR:
1. `gh pr diff <number> --repo pingdotgg/t3code > /tmp/pr-<number>.patch`
2. Attempt `git apply --check` to verify clean application
3. Apply and commit with message referencing upstream PR
4. If conflicts arise, resolve manually and note in commit message
5. Build and run tests after each PR to catch regressions early

---

## Phase 2: Surface-Level Rebrand to BCode

Change only user-facing strings and display names. Keep all internal identifiers unchanged to minimize upstream merge conflicts.

### Files to Modify

**Core branding:**
- `apps/desktop/src/appBranding.ts` - `APP_BASE_NAME`: "T3 Code" → "BCode"
- `apps/web/src/branding.ts` - fallback `APP_BASE_NAME`: "T3 Code" → "BCode"
- `apps/desktop/package.json` - `productName`: "T3 Code (Alpha)" → "BCode (Alpha)"

**Web UI:**
- `apps/web/index.html` - `<title>`, aria-labels, alt text
- `apps/web/src/components/SplashScreen.tsx` - aria-label, alt text

**Desktop dialogs:**
- `apps/desktop/src/main.ts` - dialog titles/messages (lines ~802, 906, 907)

**CI/Release:**
- `.github/workflows/release.yml` - release name template: "T3 Code v$version" → "BCode v$version"

**Documentation:**
- `README.md` - product name references
- `CONTRIBUTING.md` - product name references
- `AGENTS.md` - product name references

### NOT Changing (Progressive Rebrand - Later)

These stay as-is to preserve upstream compatibility:
- Environment variables: `T3CODE_*` prefix
- Protocol scheme: `t3://`
- Home directory: `~/.t3`
- Package scopes: `@t3tools/*`
- COM identifiers: `com.t3tools.t3code`
- Linux desktop entries: `t3code.desktop`
- localStorage keys: `t3code:theme`
- Icons/logos: reuse existing assets temporarily

---

## Phase 3: Claude-First Defaults

Swap the default provider from Codex to Claude. Codex remains fully functional and selectable.

### Files to Modify

**Default provider:**
- `packages/contracts/src/orchestration.ts` line 44:
  ```typescript
  // Before:
  export const DEFAULT_PROVIDER_KIND: ProviderKind = "codex";
  // After:
  export const DEFAULT_PROVIDER_KIND: ProviderKind = "claudeAgent";
  ```

**Default model:**
- `packages/contracts/src/model.ts` line 59:
  ```typescript
  // Before:
  export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.codex;
  // After:
  export const DEFAULT_MODEL = DEFAULT_MODEL_BY_PROVIDER.claudeAgent;
  ```

**Text generation default:**
- `apps/web/src/modelSelection.ts` line 176: change fallback from "codex" to "claudeAgent"

### What Stays the Same
- Codex provider remains registered in `ProviderAdapterRegistry`
- Codex appears in `ProviderModelPicker.tsx` UI
- All Codex settings, models, and capabilities unchanged
- Users can freely switch to Codex at any time

---

## Verification Plan

### After Phase 1 (Cherry-Picks)
- `bun install` succeeds
- `bun run build` succeeds across all packages
- `bun run test` passes (especially Claude adapter tests)
- Launch desktop app, start a Claude session, verify streaming works
- Verify Codex sessions still work

### After Phase 2 (Rebrand)
- Window title shows "BCode" not "T3 Code"
- Splash screen shows "BCode"
- Web `<title>` shows "BCode"
- Desktop about/dialogs show "BCode"
- `bun run build` succeeds

### After Phase 3 (Claude-First)
- New session defaults to Claude provider and claude-sonnet-4-6 model
- Provider picker shows Claude as selected by default
- Switching to Codex still works
- Existing threads/sessions not affected

---

## Future Work (Not In Scope)

- Custom BCode icons and logos
- Deep rebrand of env vars, protocol, package scopes
- Additional Claude-exclusive features
- Removing or deprecating Codex
