# BCode Deep Identifier Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip internal identifiers from `t3`/`T3CODE`/`t3tools` to `bcode`/`BCODE` across the monorepo while preserving the developer's existing `~/.t3` data via copy-not-move auto-migration at startup. Target release: v0.0.19.

**Architecture:** Three PRs land in sequence against `main`. PR #1 renames the workspace package scope (`@t3tools/*` → `@bcode/*`) — purely mechanical, no behavior change, and includes AGENTS.md / CLAUDE.md edits so docs stay in sync with code from day one. PR #2 flips the env var prefix, the desktop protocol scheme, the COM/bundle ID, and Linux desktop entry names, and introduces a dual-read env shim that keeps `T3CODE_*` readable for one release. PR #3 renames `~/.t3` → `~/.bcode` and `t3code:*` → `bcode:*` localStorage, backed by idempotent marker-gated migration modules.

**Tech Stack:** TypeScript, Effect.js (services/layers/`Effect.fn`), Vitest, electron-builder (via `scripts/build-desktop-artifact.ts`), `bun` workspaces, `turbo`, `oxlint`/`oxfmt`.

---

## Scope

**In scope (this plan, v0.0.19):**

- Workspace scope rename `@t3tools/*` → `@bcode/*` (every workspace package except `apps/server`, which is already `@berkayorhan/bcode`).
- Env var prefix `T3CODE_*` → `BCODE_*` in runtime code, tests, docs, dev-runner scripts, CLI flag text.
- Env var dual-read shim in `packages/shared/src/env.ts` (reads `BCODE_*` first, falls back to `T3CODE_*` with a one-time per-key deprecation warning).
- Desktop internal protocol scheme `t3://` → `bcode://` (this is electron's custom asset scheme used for packaged-UI loading — not an OS-level deep-link handler; there is no `setAsDefaultProtocolClient` call).
- COM/bundle ID `com.t3tools.t3code` → `com.berkayorhan.bcode` (three locations: `apps/desktop/src/main.ts`, `apps/desktop/scripts/electron-launcher.mjs`, `scripts/build-desktop-artifact.ts`).
- Linux entry names: `LINUX_DESKTOP_ENTRY_NAME`, `LINUX_WM_CLASS`, `executableName`, `StartupWMClass`, and `artifactName` pattern — all flip from `t3code` / `T3-Code-…` to `bcode` / `BCode-…`.
- Home directory `~/.t3` → `~/.bcode` (three runtime readers: `apps/desktop/src/main.ts:103`, `apps/server/src/os-jank.ts:72`, `scripts/dev-runner.ts:20`).
- Auto-migration modules: `packages/shared/src/migration/userDataMigration.ts` and `apps/web/src/migration/storageMigration.ts`, both marker-gated and copy-not-move.
- localStorage keys `t3code:*` → `bcode:*` in `apps/web`.
- AGENTS.md, CLAUDE.md, .docs/ and docs/ reference text updates — stripped of "identifiers we keep" lists that are no longer accurate, replaced with the post-rebrand state.

**Out of scope (deferred to later plans):**

- Removing the env var dual-read shim. That happens in v0.0.20; see `docs/superpowers/specs/2026-04-16-bcode-release-and-deep-rebrand-design.md` § Out of Scope.
- `USER_DATA_DIR_NAME = "t3code"` in `apps/desktop/src/main.ts:119` (electron's own per-app `userData` directory). The spec does not call this out. Leaving it means existing installs keep their electron-managed window state, cookies, and cached session after the rebrand. The code already has a legacy chain (`LEGACY_USER_DATA_DIR_NAME = "T3 Code (Alpha)"`); renaming it would require extending that chain and is not essential. Flagged for a future cleanup PR if desired.
- `LEGACY_USER_DATA_DIR_NAME = "T3 Code (Alpha)"` / `"T3 Code (Dev)"` — refers to a _pre_-T3 path used for original electron-userData migration. Leave untouched.
- Historical documents (existing specs, plans, commit messages, `performance.md`, `.plans/*`): retain their T3 references. Only CURRENT docs (`CLAUDE.md`, `AGENTS.md`, `.claude/rules/*`, `docs/observability.md`, `docs/perf-benchmarks.md`, `docs/release.md`, `KEYBINDINGS.md`, `.docs/*`) are updated to match the new state.
- Git history, upstream-fork URL references in `AGENTS.md` § Reference Repos.
- Per-project worktree staging path convention (`<repo>/.t3/worktrees/…`) — appears only in test fixtures; no runtime source constant hardcodes it. Test fixtures are renamed for consistency in PR #3 Task 3.9 but no behavior changes.
- Icons/logos. Upstream assets stay until a separate visual-identity effort.

**Ordering rationale:** PR #1 first because it is the largest mechanical diff but has zero behavior risk — `bun typecheck` + `bun run test` will catch any missed import. PR #2 second because the env shim is load-bearing for PR #3's tests (which must be able to set either old or new env names). PR #3 last because the migration module is behaviorally riskiest and benefits from landing on top of a stable, already-renamed codebase.

---

## Pre-Work (both committers and reviewers must read)

Before starting PR #1:

1. Confirm `main` is clean: `git status` shows no uncommitted work.
2. Confirm you're pushing to the fork, not upstream: `git remote -v` shows `origin` pointing at `Berkay2002/bcode`. Upstream (`pingdotgg/t3code`) is read-only by convention.
3. Fresh `bun install` from `main` succeeds and `bun run typecheck` is green. Any pre-existing red is owned by someone else and not this plan's problem — fix before starting.
4. All branch names use the prefix `rebrand/` so they're easy to track: `rebrand/workspace-scope`, `rebrand/env-protocol-com`, `rebrand/home-migration`.
5. Every PR title uses conventional-commit style, e.g. `chore(rebrand): rename workspace scope @t3tools/* → @bcode/*`.

---

## PR #1: Workspace Scope Rename `@t3tools/*` → `@bcode/*`

**Branch:** `rebrand/workspace-scope`.

**Target state:** `grep -rn '@t3tools' .` in source code, config, and current docs returns zero hits. (Historical plans and specs are out of scope.) All five renamed packages build, typecheck, lint, and test green.

**Packages renamed (seven total):**

| Current name               | New name                |
| -------------------------- | ----------------------- |
| `@t3tools/monorepo` (root) | `@bcode/monorepo`       |
| `@t3tools/web`             | `@bcode/web`            |
| `@t3tools/desktop`         | `@bcode/desktop`        |
| `@t3tools/shared`          | `@bcode/shared`         |
| `@t3tools/contracts`       | `@bcode/contracts`      |
| `@t3tools/client-runtime`  | `@bcode/client-runtime` |
| `@t3tools/marketing`       | `@bcode/marketing`      |

`apps/server/package.json` is already `@berkayorhan/bcode` (shipped in sub-project 1) — only its dependency declarations (`devDependencies`) need to flip from `@t3tools/*` to `@bcode/*`.

### Task 1.1: Prepare branch and baseline

**Files:**

- Read: `package.json`, `apps/server/package.json`

- [ ] **Step 1: Create branch from clean `main`.**

Run in PowerShell:

```
git switch main
git pull --ff-only
git switch -c rebrand/workspace-scope
```

- [ ] **Step 2: Capture baseline counts.**

Run:

```
grep -rn '@t3tools' . --include='*.ts' --include='*.tsx' --include='*.json' --include='*.jsonc' --include='*.md' | wc -l
```

Expected: a positive number (around 400). Write the number down — you'll compare against it after renames.

- [ ] **Step 3: Verify `bun run typecheck` is green before changes.**

Run: `bun run typecheck`. Expected: green. If red, stop and fix root cause on `main` first — don't start a rebrand on top of red.

### Task 1.2: Rename the `name` field in every package.json

**Files:**

- Modify: `package.json` (root)
- Modify: `apps/web/package.json:2`
- Modify: `apps/desktop/package.json:2`
- Modify: `apps/marketing/package.json:2`
- Modify: `packages/shared/package.json:2`
- Modify: `packages/contracts/package.json:2`
- Modify: `packages/client-runtime/package.json:2`

- [ ] **Step 1: Root `package.json`.**

Edit the `"name"` field:

```json
"name": "@bcode/monorepo",
```

- [ ] **Step 2: Rename every workspace package `name` field.**

For each file listed above (except root and `apps/server/package.json` which stays `@berkayorhan/bcode`), change:

```
"name": "@t3tools/<subpackage>",
```

to:

```
"name": "@bcode/<subpackage>",
```

Where `<subpackage>` matches the directory: `web`, `desktop`, `marketing`, `shared`, `contracts`, `client-runtime`.

- [ ] **Step 3: Commit package.json name flips only.**

```
git add -- **/package.json package.json
git commit -m "chore(rebrand): rename workspace package names @t3tools/* → @bcode/*"
```

### Task 1.3: Update workspace dependency references in package.json files

**Files:**

- Modify: `apps/server/package.json` (devDependencies block, lines 43-45)
- Modify: `apps/web/package.json` (dependencies block, lines 29-31)
- Modify: `apps/desktop/package.json` (devDependencies block, lines 22-23)
- Modify: `packages/shared/package.json` (dependencies block, line 90)
- Modify: `packages/client-runtime/package.json` (dependencies block, line 18)

- [ ] **Step 1: Replace every `"@t3tools/…": "workspace:*"` with `"@bcode/…": "workspace:*"`.**

For `apps/server/package.json` lines 43-45:

```json
"@bcode/contracts": "workspace:*",
"@bcode/shared": "workspace:*",
"@bcode/web": "workspace:*",
```

For `apps/web/package.json` lines 29-31:

```json
"@bcode/client-runtime": "workspace:*",
"@bcode/contracts": "workspace:*",
"@bcode/shared": "workspace:*",
```

For `apps/desktop/package.json` lines 22-23:

```json
"@bcode/contracts": "workspace:*",
"@bcode/shared": "workspace:*",
```

For `packages/shared/package.json` line 90:

```json
"@bcode/contracts": "workspace:*",
```

For `packages/client-runtime/package.json` line 18:

```json
"@bcode/contracts": "workspace:*",
```

- [ ] **Step 2: Commit.**

```
git add -- apps/*/package.json packages/*/package.json
git commit -m "chore(rebrand): update workspace dependency refs to @bcode/*"
```

### Task 1.4: Update turbo filters in root package.json scripts

**Files:**

- Modify: `package.json` (scripts block, lines 28-60)

- [ ] **Step 1: Replace every `@t3tools/...` in turbo `--filter` flags with `@bcode/...`.**

Open `package.json` and rewrite every affected script. After the edit the scripts block should match this exactly (only the identifier changes — scripts, names, and command shape stay identical):

```json
  "scripts": {
    "dev": "node scripts/dev-runner.ts dev",
    "dev:server": "node scripts/dev-runner.ts dev:server",
    "dev:web": "node scripts/dev-runner.ts dev:web",
    "dev:marketing": "turbo run dev --filter=@bcode/marketing",
    "dev:desktop": "node scripts/dev-runner.ts dev:desktop",
    "start": "turbo run start --filter=@berkayorhan/bcode",
    "start:desktop": "turbo run start --filter=@bcode/desktop",
    "start:marketing": "turbo run preview --filter=@bcode/marketing",
    "start:mock-update-server": "bun run scripts/mock-update-server.ts",
    "build": "turbo run build",
    "build:marketing": "turbo run build --filter=@bcode/marketing",
    "build:desktop": "turbo run build --filter=@bcode/desktop --filter=@berkayorhan/bcode",
    "typecheck": "turbo run typecheck",
    "lint": "oxlint --report-unused-disable-directives",
    "test": "turbo run test",
    "test:process-reaper": "bun run --cwd apps/server test:process-reaper",
    "test:perf:server": "cd apps/server && bun run test:perf",
    "test:perf:web": "turbo run build --filter=@bcode/web && turbo run build --filter=@berkayorhan/bcode && cd apps/web && bun run test:perf",
    "perf:open": "node scripts/open-perf-app.ts",
    "perf:open:build": "turbo run build --filter=@bcode/web && turbo run build --filter=@berkayorhan/bcode && node scripts/open-perf-app.ts",
    "test:desktop-smoke": "turbo run smoke-test --filter=@bcode/desktop",
    "fmt": "oxfmt",
    "fmt:check": "oxfmt --check",
    "build:contracts": "turbo run build --filter=@bcode/contracts",
    "dist:desktop:artifact": "node scripts/build-desktop-artifact.ts",
    "dist:desktop:dmg": "node scripts/build-desktop-artifact.ts --platform mac --target dmg",
    "dist:desktop:dmg:arm64": "node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64",
    "dist:desktop:dmg:x64": "node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch x64",
    "dist:desktop:linux": "node scripts/build-desktop-artifact.ts --platform linux --target AppImage --arch x64",
    "dist:desktop:win": "node scripts/build-desktop-artifact.ts --platform win --target nsis --arch x64",
    "release:smoke": "node scripts/release-smoke.ts",
    "clean": "rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/*/dist apps/*/dist-electron packages/*/dist .turbo apps/*/.turbo packages/*/.turbo",
    "sync:vscode-icons": "node scripts/sync-vscode-icons.mjs"
  },
```

- [ ] **Step 2: Commit.**

```
git add package.json
git commit -m "chore(rebrand): point turbo filters at @bcode/* packages"
```

### Task 1.5: Bulk-rewrite `@t3tools/` imports across all source files

This sweep touches the largest number of files. Use a scripted rewrite, then verify.

**Files:**

- Modify: every `.ts` and `.tsx` file under `apps/` or `packages/` with a `@t3tools/` import.

- [ ] **Step 1: Run the import sweep.**

From the repo root, in PowerShell (PowerShell 7):

```powershell
Get-ChildItem -Path apps, packages, scripts -Recurse -File -Include *.ts, *.tsx `
  | Where-Object { -not $_.FullName.Contains("\node_modules\") -and -not $_.FullName.Contains("\dist\") -and -not $_.FullName.Contains("\.turbo\") } `
  | ForEach-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      if ($content -match '@t3tools/') {
        $updated = $content -replace '@t3tools/', '@bcode/'
        Set-Content -LiteralPath $_.FullName -Value $updated -NoNewline
      }
    }
```

- [ ] **Step 2: Verify no `@t3tools/` imports remain in source.**

Run:

```
grep -rn '@t3tools/' apps packages scripts --include='*.ts' --include='*.tsx'
```

Expected: **zero** matches. If any appear, inspect and fix manually.

- [ ] **Step 3: Also sweep `.jsonc` turbo config files.**

Check and update:

- `apps/desktop/turbo.jsonc` — 2 occurrences of `@t3tools/` from earlier grep.
- `turbo.json` (root) — 1 occurrence.

For each file, replace `@t3tools/` with `@bcode/` literally. These are config files, not source, but referenced by turbo.

- [ ] **Step 4: Commit.**

```
git add -- apps packages scripts turbo.json
git commit -m "chore(rebrand): rewrite @t3tools/* imports and turbo refs to @bcode/*"
```

### Task 1.6: Update `apps/server/tsdown.config.ts`, `apps/desktop/tsdown.config.ts`, and any other build tooling

**Files:**

- Modify: `apps/server/tsdown.config.ts` (1 occurrence of `@t3tools/`)
- Modify: `apps/desktop/tsdown.config.ts` (1 occurrence)

- [ ] **Step 1: Confirm step 1.5 already caught these.**

Run:

```
grep -n '@t3tools' apps/server/tsdown.config.ts apps/desktop/tsdown.config.ts
```

Expected: no matches (covered by the 1.5 sweep). If any remain, edit manually to `@bcode/...`.

- [ ] **Step 2: No commit if nothing changed.**

### Task 1.7: Update docs in the repo (AGENTS.md, CLAUDE.md, .docs, docs, rules)

**Files:**

- Modify: `AGENTS.md` (lines referencing `@t3tools/*` in the "Internal identifiers" and "Package Roles" sections)
- Modify: `CLAUDE.md` (line 56, the "Internal identifiers" note)
- Modify: `.docs/workspace-layout.md` (1 occurrence)
- Modify: `.docs/provider-architecture.md` (1 occurrence)

These docs currently claim `@t3tools/*` is preserved "for upstream compatibility." After this PR that's no longer true — strip the claim.

- [ ] **Step 1: Edit `AGENTS.md` § Rebrand rules section.**

Find the block (around line 19-25 in current HEAD):

```
- **Internal identifiers — do NOT rename** (upstream compatibility):
  - Environment variables: `T3CODE_*` prefix
  - Protocol scheme: `t3://`
  - Home directory: `~/.t3`
  - Package scopes: `@t3tools/*`
  - npm package `t3`, `npx t3` commands
  - COM identifiers: `com.t3tools.t3code`
  - Linux desktop entries: `t3code.desktop`
  - localStorage keys: `t3code:theme`
  - TypeScript types, internal constants
```

Replace with:

```
- **Internal identifiers — renamed in v0.0.19:**
  - Environment variables: `T3CODE_*` → `BCODE_*` (`T3CODE_*` still read with a deprecation warning through v0.0.19; removed in v0.0.20).
  - Home directory: `~/.t3` → `~/.bcode` (auto-migrated on first launch).
  - Package scopes: `@t3tools/*` → `@bcode/*`.
  - COM identifier: `com.t3tools.t3code` → `com.berkayorhan.bcode`.
  - Linux desktop entry: `t3code.desktop` → `bcode.desktop`.
  - localStorage keys: `t3code:*` → `bcode:*` (auto-migrated on first launch).
  - Desktop internal protocol scheme: `t3://` → `bcode://`.
- **Internal identifiers kept as-is** (upstream compatibility or legacy migration):
  - `LEGACY_USER_DATA_DIR_NAME = "T3 Code (Alpha)"` / `"T3 Code (Dev)"` — pre-T3 electron userData path.
  - `USER_DATA_DIR_NAME = "t3code"` / `"t3code-dev"` — electron's current userData subdir; a deliberate non-rename to preserve existing installs' window state, cookies, and renderer cache. May be renamed in a later cleanup.
  - `LEGACY_T3_HOME_DIR_NAME = ".t3"` — read by the migration module only.
```

Also update AGENTS.md § Package Roles: change `@t3tools/shared` → `@bcode/shared` and similar.

- [ ] **Step 2: Edit `CLAUDE.md` line 56.**

Find:

```
- **Internal identifiers** (env vars `T3CODE_*`, protocol `t3://`, home `~/.t3`, packages `@t3tools/*`, npm `t3`/`npx t3`, COM `com.t3tools.t3code`, localStorage `t3code:*`): keep as-is for upstream compatibility
```

Replace with:

```
- **Internal identifiers** (`BCODE_*` env vars, `bcode://` internal scheme, `~/.bcode` home, `@bcode/*` packages, `npx @berkayorhan/bcode` CLI, `com.berkayorhan.bcode` COM, `bcode:*` localStorage): post-rebrand state. `T3CODE_*` env is still accepted with a deprecation warning through v0.0.19; `~/.t3` and `t3code:*` localStorage are auto-migrated on first launch of v0.0.19.
```

- [ ] **Step 3: Update `.docs/workspace-layout.md` and `.docs/provider-architecture.md`.**

Replace `@t3tools/` with `@bcode/` in both files (1 occurrence each).

- [ ] **Step 4: Commit.**

```
git add AGENTS.md CLAUDE.md .docs/
git commit -m "docs(rebrand): update package-scope references to @bcode/*"
```

### Task 1.8: Regenerate `bun.lock` and verify

**Files:**

- Modify (auto): `bun.lock`

- [ ] **Step 1: Nuke node_modules and regenerate.**

From repo root:

```
bun run clean
bun install
```

Expected: `bun.lock` is rewritten so that every `@t3tools/*` workspace reference is now `@bcode/*`. `bun install` completes without resolution errors.

- [ ] **Step 2: Verify `grep @t3tools bun.lock` returns zero.**

Run:

```
grep -c '@t3tools' bun.lock
```

Expected: `0`. If non-zero, re-run `bun run clean && bun install`.

- [ ] **Step 3: Commit the regenerated lockfile.**

```
git add bun.lock
git commit -m "chore(rebrand): regenerate bun.lock for @bcode/* workspace rename"
```

### Task 1.9: Verify PR #1

- [ ] **Step 1: Format, lint, typecheck, test.**

Run in order:

```
bun run fmt
bun run lint
bun run typecheck
bun run test
```

All four must be green. If typecheck fails with an unresolved `@t3tools/…` module error, rerun Task 1.5's sweep and confirm with the Task 1.6 grep.

- [ ] **Step 2: Run the browser test suite too, since PR #1 touches `apps/web`.**

```
bun run --cwd apps/web test:browser
```

Expected: green. Requires `bun run --cwd apps/web test:browser:install` once per machine.

- [ ] **Step 3: Final repo-wide scan.**

```
grep -rn '@t3tools' apps packages scripts --include='*.ts' --include='*.tsx' --include='*.json' --include='*.jsonc' --include='*.md'
```

Expected: zero matches in `apps/`, `packages/`, `scripts/`. The only remaining `@t3tools` hits must be under `docs/superpowers/specs/`, `docs/superpowers/plans/` (historical plans), `performance.md`, and `.plans/` — all intentionally preserved per Scope § Out of scope.

### Task 1.10: Push PR #1

- [ ] **Step 1: Push branch.**

```
git push -u origin rebrand/workspace-scope
```

- [ ] **Step 2: Create PR against `Berkay2002/bcode`.**

```
gh pr create --repo Berkay2002/bcode --base main --head rebrand/workspace-scope --title "chore(rebrand): rename workspace scope @t3tools/* → @bcode/*" --body "$(cat <<'EOF'
## Summary
- Renames every workspace package from `@t3tools/<pkg>` to `@bcode/<pkg>` (seven packages; `apps/server` stays `@berkayorhan/bcode`).
- Bulk-rewrites `@t3tools/*` imports across `apps/`, `packages/`, `scripts/`.
- Updates turbo filters, tsdown config references, `bun.lock`, and docs (AGENTS.md, CLAUDE.md, .docs/).
- Purely mechanical — no behavior change.

## Test plan
- [x] `bun run fmt` / `lint` / `typecheck` / `test` green locally
- [x] `bun run --cwd apps/web test:browser` green locally
- [x] `grep -rn '@t3tools' apps packages scripts --include='*.ts' --include='*.tsx' --include='*.json'` returns zero
- [ ] CI green
- [ ] Copilot review addressed
EOF
)"
```

- [ ] **Step 3: Wait for CI + Copilot review.**

Do not merge until CI is green and Copilot has posted its review. If Copilot flags anything substantive, invoke `superpowers:receiving-code-review`.

- [ ] **Step 4: Squash-merge once clean, then move on.**

---

## PR #2: Env Vars + Internal Protocol + COM ID + Linux Entry

**Branch:** `rebrand/env-protocol-com`, cut from `main` _after_ PR #1 has merged.

**Target state:** new code uses `BCODE_*` env vars, `bcode://` internal scheme, `com.berkayorhan.bcode` COM, `bcode.desktop` Linux entry. Legacy `T3CODE_*` env values are still honored (with a per-var deprecation warning) via a shim in `packages/shared/src/env.ts`.

### Task 2.1: Add the env var dual-read shim (TDD)

**Files:**

- Create: `packages/shared/src/env.ts`
- Create: `packages/shared/src/env.test.ts`
- Modify: `packages/shared/package.json` (exports block, add `./env`)

- [ ] **Step 1: Write the failing test.**

Create `packages/shared/src/env.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { __resetEnvDeprecationWarningsForTests, readEnv } from "./env";

describe("readEnv", () => {
  it("prefers BCODE_<name> over T3CODE_<name>", () => {
    __resetEnvDeprecationWarningsForTests();
    const env = { BCODE_HOME: "/new", T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("/new");
  });

  it("falls back to T3CODE_<name> and warns once per suffix", () => {
    __resetEnvDeprecationWarningsForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("/old");
    expect(readEnv("HOME", env)).toBe("/old");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/T3CODE_HOME.*deprecated/i);
    warn.mockRestore();
  });

  it("returns undefined when neither is set", () => {
    __resetEnvDeprecationWarningsForTests();
    expect(readEnv("HOME", {})).toBeUndefined();
  });

  it("treats empty string as a set value (not fallback)", () => {
    __resetEnvDeprecationWarningsForTests();
    const env = { BCODE_HOME: "", T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```
bun run --cwd packages/shared test -- env
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `packages/shared/src/env.ts`.**

```ts
const DEPRECATED_ENV_WARNED = new Set<string>();

export function __resetEnvDeprecationWarningsForTests(): void {
  DEPRECATED_ENV_WARNED.clear();
}

export function readEnv(
  suffix: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  const nextKey = `BCODE_${suffix}`;
  const legacyKey = `T3CODE_${suffix}`;

  const next = env[nextKey];
  if (next !== undefined) return next;

  const legacy = env[legacyKey];
  if (legacy !== undefined) {
    if (!DEPRECATED_ENV_WARNED.has(legacyKey)) {
      DEPRECATED_ENV_WARNED.add(legacyKey);
      console.warn(
        `[bcode] Environment variable ${legacyKey} is deprecated and will be removed in v0.0.20. Rename it to ${nextKey}.`,
      );
    }
    return legacy;
  }

  return undefined;
}
```

- [ ] **Step 4: Add the subpath export in `packages/shared/package.json`.**

Insert into the `exports` block (alphabetically, before `./git`):

```json
    "./env": {
      "types": "./src/env.ts",
      "import": "./src/env.ts"
    },
```

- [ ] **Step 5: Run test to verify it passes.**

```
bun run --cwd packages/shared test -- env
```

Expected: 4 passing.

- [ ] **Step 6: Commit.**

```
git add packages/shared/src/env.ts packages/shared/src/env.test.ts packages/shared/package.json
git commit -m "feat(shared): add env dual-read shim (BCODE_* preferred, T3CODE_* fallback with warning)"
```

### Task 2.2: Rename `T3CODE_*` readers to use the shim or flip directly

**Files:**

- Modify: `apps/server/src/cli.ts` (lines 98, 123, 130-172 — every `Config.string("T3CODE_*")` and flag description)
- Modify: `apps/server/src/cli-config.test.ts` (3 test fixtures referencing `T3CODE_HOME`)
- Modify: `scripts/dev-runner.ts` (lines 75-76, and further `T3CODE_*` occurrences)
- Modify: `scripts/dev-runner.test.ts` (line 50, 66 assertions)
- Modify: `scripts/build-desktop-artifact.ts` (any `T3CODE_*` references)
- Modify: `scripts/mock-update-server.ts` (2 occurrences)
- Modify: `scripts/open-perf-app.ts` (2 occurrences)
- Modify: `apps/desktop/src/main.ts:103` (`process.env.T3CODE_HOME`)
- Modify: `apps/desktop/src/updateState.ts:1` + `apps/desktop/src/updateState.test.ts:1`
- Modify: `apps/web/vite.config.ts:1`
- Modify: `apps/web/test/perf/serverEnv.ts:3`
- Modify: `apps/web/test/perf/appHarness.ts:2`
- Modify: `apps/web/test/perf/supportHelpers.test.ts:2`
- Modify: `apps/server/integration/perf/serverPerfHarness.ts:4`
- Modify: `apps/server/src/perf/config.ts:4`
- Modify: `packages/shared/src/shell.ts` (`__T3CODE_PATH_*`, `__T3CODE_ENV_*` sentinels)
- Modify: `packages/shared/src/shell.test.ts` (14 occurrences of the same sentinels)
- Modify: `packages/shared/src/projectScripts.ts` (2 occurrences)

**Strategy:**

- In server/web runtime entry points that read env vars through `Config.string("T3CODE_X")`: flip the literal to `"BCODE_X"`. Effect's `Config` layer does not route through `readEnv` by default; for that we need a different strategy. For this plan we flip the literal because most readers are Effect `Config.string` calls, which means `T3CODE_X` would stop being honored. **This is where the shim matters.**
- Instead of flipping `Config.string` literals directly, wrap each Effect `Config.string("BCODE_X")` in a fallback that reads `T3CODE_X`. Effect supports this: `Config.string("BCODE_X").pipe(Config.orElse(() => Config.string("T3CODE_X").pipe(Config.mapAttempt(warnAndReturn("T3CODE_X")))))`.
- For plain `process.env["T3CODE_X"]` reads in desktop/scripts/shell code: import `readEnv` from `@bcode/shared/env` and use `readEnv("X")`.

- [ ] **Step 1: Add an Effect Config helper that wraps both names.**

Open `apps/server/src/cli.ts`. Add near the other imports:

```ts
import { Effect } from "effect";
```

Add a helper at the top of the file (after the imports, before the existing `Config.*` blocks):

```ts
function bcodeConfigString(suffix: string): Config.Config<string | undefined> {
  const nextKey = `BCODE_${suffix}`;
  const legacyKey = `T3CODE_${suffix}`;
  return Config.string(nextKey).pipe(
    Config.orElse(() =>
      Config.string(legacyKey).pipe(
        Config.map((value) => {
          console.warn(
            `[bcode] Environment variable ${legacyKey} is deprecated and will be removed in v0.0.20. Rename it to ${nextKey}.`,
          );
          return value;
        }),
      ),
    ),
    Config.option,
    Config.map(Option.getOrUndefined),
  );
}

function bcodeConfigWithFallback<A>(
  suffix: string,
  decoder: (key: string) => Config.Config<A>,
): Config.Config<A> {
  const nextKey = `BCODE_${suffix}`;
  const legacyKey = `T3CODE_${suffix}`;
  return decoder(nextKey).pipe(
    Config.orElse(() =>
      decoder(legacyKey).pipe(
        Config.map((value) => {
          console.warn(
            `[bcode] Environment variable ${legacyKey} is deprecated and will be removed in v0.0.20. Rename it to ${nextKey}.`,
          );
          return value;
        }),
      ),
    ),
  );
}
```

- [ ] **Step 2: Flip every `Config.string("T3CODE_X")` in `apps/server/src/cli.ts` (lines 130-172) to the new helper.**

Replace the entire block starting at line 130 (the `logLevel` config) with:

```ts
  logLevel: bcodeConfigWithFallback("LOG_LEVEL", Config.logLevel).pipe(Config.withDefault("Info")),
  traceMinLevel: bcodeConfigWithFallback("TRACE_MIN_LEVEL", Config.logLevel).pipe(Config.withDefault("Info")),
  traceTimingEnabled: bcodeConfigWithFallback("TRACE_TIMING_ENABLED", Config.boolean).pipe(Config.withDefault(true)),
  traceFile: bcodeConfigWithFallback("TRACE_FILE", Config.string).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
  ),
  traceMaxBytes: bcodeConfigWithFallback("TRACE_MAX_BYTES", Config.int).pipe(Config.withDefault(10 * 1024 * 1024)),
  traceMaxFiles: bcodeConfigWithFallback("TRACE_MAX_FILES", Config.int).pipe(Config.withDefault(10)),
  traceBatchWindowMs: bcodeConfigWithFallback("TRACE_BATCH_WINDOW_MS", Config.int).pipe(Config.withDefault(200)),
  otlpTracesUrl: bcodeConfigWithFallback("OTLP_TRACES_URL", Config.string).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
  ),
  otlpMetricsUrl: bcodeConfigWithFallback("OTLP_METRICS_URL", Config.string).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
  ),
  otlpExportIntervalMs: bcodeConfigWithFallback("OTLP_EXPORT_INTERVAL_MS", Config.int).pipe(
    Config.option,
    Config.map(Option.getOrUndefined),
  ),
  otlpServiceName: bcodeConfigWithFallback("OTLP_SERVICE_NAME", Config.string).pipe(Config.withDefault("bcode-server")),
  mode: bcodeConfigWithFallback("MODE", (key) => Config.schema(RuntimeMode, key)).pipe(
    Config.withDefault("server" as const),
  ),
  port: bcodeConfigString("PORT").pipe(Config.map((value) => (value ? Number.parseInt(value, 10) : undefined))),
  host: bcodeConfigString("HOST"),
  t3Home: bcodeConfigString("HOME"),
  noBrowser: bcodeConfigWithFallback("NO_BROWSER", Config.boolean).pipe(
    Config.withDefault(false),
  ),
  bootstrapFd: bcodeConfigString("BOOTSTRAP_FD").pipe(
    Config.map((value) => (value ? Number.parseInt(value, 10) : undefined)),
  ),
  autoBootstrapProjectFromCwd: bcodeConfigWithFallback("AUTO_BOOTSTRAP_PROJECT_FROM_CWD", Config.boolean).pipe(
    Config.withDefault(false),
  ),
  logWebSocketEvents: bcodeConfigWithFallback("LOG_WS_EVENTS", Config.boolean).pipe(
    Config.withDefault(false),
  ),
```

Note: `port` + `bootstrapFd` use `Config.port` / `Config.int` natively in the old code; to preserve typing, adjust the helper usage:

```ts
  port: bcodeConfigWithFallback("PORT", Config.port).pipe(Config.option, Config.map(Option.getOrUndefined)),
  bootstrapFd: bcodeConfigWithFallback("BOOTSTRAP_FD", Config.int).pipe(Config.option, Config.map(Option.getOrUndefined)),
```

If the Effect Config type inference pushes back, keep `bcodeConfigString` for `port`/`bootstrapFd` and parse with `Number.parseInt` as shown.

- [ ] **Step 3: Update the flag descriptions on lines 98 and 123.**

Line 98: `Flag.withDescription("Base directory path (equivalent to BCODE_HOME).")`.
Line 123: `Flag.withDescription("Emit server-side logs for outbound WebSocket push traffic (equivalent to BCODE_LOG_WS_EVENTS).")`.

- [ ] **Step 4: Update `apps/server/src/cli-config.test.ts` test fixtures.**

For each of the 3 occurrences of `T3CODE_HOME: <value>`, change the env object to use `BCODE_HOME: <value>` and add a separate fixture that uses `T3CODE_HOME` to assert backwards-compatible behavior with the deprecation warning spy. A new test block:

```ts
it("honors legacy T3CODE_HOME with a deprecation warning", () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  // ... use T3CODE_HOME: baseDir in the fixture, assert resolved path matches, assert warn called with /T3CODE_HOME.*deprecated/i
});
```

- [ ] **Step 5: Flip `apps/desktop/src/main.ts:103` to `readEnv`.**

Import `readEnv` near the top of the file (add with the other `@bcode/*` imports):

```ts
import { readEnv } from "@bcode/shared/env";
```

Replace line 103:

```ts
const BASE_DIR = process.env.T3CODE_HOME?.trim() || Path.join(OS.homedir(), ".t3");
```

With:

```ts
const BASE_DIR = readEnv("HOME")?.trim() || Path.join(OS.homedir(), ".t3");
```

(Home dir flip to `.bcode` happens in PR #3.)

- [ ] **Step 6: Flip every other `process.env.T3CODE_*` in `scripts/`, `apps/desktop/`, `apps/web/`.**

For every occurrence returned by:

```
grep -rn 'process.env.T3CODE_\|process.env\["T3CODE_' apps scripts --include='*.ts' --include='*.tsx' --include='*.mjs'
```

Replace `process.env.T3CODE_X` (or `process.env["T3CODE_X"]`) with:

```ts
readEnv("X"); // where "X" is the suffix after T3CODE_
```

…importing `readEnv` from `@bcode/shared/env` at the top of each file.

If a file can't import from the workspace (e.g. a `.mjs` launcher), inline the fallback:

```js
const v = process.env.BCODE_X ?? process.env.T3CODE_X;
if (v !== undefined && process.env.BCODE_X === undefined) {
  console.warn(`[bcode] T3CODE_X is deprecated; rename to BCODE_X.`);
}
```

- [ ] **Step 7: Flip shell sentinels in `packages/shared/src/shell.ts`.**

Lines 4-5:

```ts
const PATH_CAPTURE_START = "__BCODE_PATH_START__";
const PATH_CAPTURE_END = "__BCODE_PATH_END__";
```

Lines 107 and 111 (inside `envSentinelStart` / `envSentinelEnd` helpers):

```ts
return `__BCODE_ENV_${name}_START__`;
// …
return `__BCODE_ENV_${name}_END__`;
```

These sentinels are internal markers grep'd out of shell output; they don't persist anywhere. Safe to flip without a fallback. The matching test file `packages/shared/src/shell.test.ts` has 14 occurrences of the old sentinels — update them to match.

- [ ] **Step 8: Flip `packages/shared/src/projectScripts.ts` (2 occurrences).**

Context-check each and update to `BCODE_*`. If these names appear in persisted data, add to the shim; otherwise flip cleanly.

- [ ] **Step 9: Flip CLI flag names in `apps/server/src/cli.ts` (line 74).**

```ts
  t3Home: Schema.optional(Schema.String),
```

Rename the schema field to `bcodeHome`, then in the consuming merger (lines 280-281), change:

```ts
Option.fromUndefinedOr(env.t3Home),
Option.fromUndefinedOr(bootstrap?.t3Home),
```

to:

```ts
Option.fromUndefinedOr(env.bcodeHome),
Option.fromUndefinedOr(bootstrap?.bcodeHome),
```

Also check `cli-config.test.ts` lines 231 and 348 — these use `t3Home: <value>` as a fixture; rename to `bcodeHome`.

- [ ] **Step 10: Verify by running tests.**

```
bun run --cwd packages/shared test
bun run --cwd apps/server test -- cli
bun run --cwd scripts test -- dev-runner
```

Expected: green. If shell tests fail because of sentinel mismatches, re-check Task 2.2 step 7.

- [ ] **Step 11: Commit.**

```
git add -A
git commit -m "feat(rebrand): flip env var prefix T3CODE_* → BCODE_* with dual-read shim"
```

### Task 2.3: Rename desktop protocol scheme `t3://` → `bcode://`

**Files:**

- Modify: `apps/desktop/src/main.ts:108` (`DESKTOP_SCHEME`)
- Modify: `.docs/scripts.md:23` (reference doc)

This scheme is used only by electron's internal asset server (see `protocol.registerSchemesAsPrivileged` at main.ts:646 and `protocol.registerFileProtocol` at main.ts:823). It is NOT registered via `setAsDefaultProtocolClient`, so there is no OS-level deep-link handler to unregister or migrate. Flipping the constant is safe as long as nothing else hardcodes the string.

- [ ] **Step 1: Flip the constant.**

Line 108:

```ts
const DESKTOP_SCHEME = "bcode";
```

- [ ] **Step 2: Verify no other `t3://` references exist in desktop code.**

```
grep -rn 't3://' apps/desktop
```

Expected: zero. If any remain (e.g. an `index.html` or static asset reference), update them.

- [ ] **Step 3: Update `.docs/scripts.md:23` reference.**

Change:

```
Desktop production windows load the bundled UI from `t3://app/index.html` (not a `127.0.0.1` document URL).
```

To:

```
Desktop production windows load the bundled UI from `bcode://app/index.html` (not a `127.0.0.1` document URL).
```

- [ ] **Step 4: Run the desktop smoke test.**

```
bun run test:desktop-smoke
```

Expected: green. If the test can't reach the loaded UI, the protocol rename broke something — check `apps/desktop/src/preload.ts` or `apps/web/vite.config.ts` for hardcoded `t3://` references.

- [ ] **Step 5: Commit.**

```
git add apps/desktop/src/main.ts .docs/scripts.md
git commit -m "feat(rebrand): rename desktop internal protocol scheme t3:// → bcode://"
```

### Task 2.4: Rename COM / bundle ID `com.t3tools.t3code` → `com.berkayorhan.bcode`

**Files:**

- Modify: `apps/desktop/src/main.ts:116` (`APP_USER_MODEL_ID`)
- Modify: `apps/desktop/scripts/electron-launcher.mjs:22` (`APP_BUNDLE_ID`)
- Modify: `scripts/build-desktop-artifact.ts:521` (`appId`)

- [ ] **Step 1: Flip `APP_USER_MODEL_ID` in main.ts.**

Line 116:

```ts
const APP_USER_MODEL_ID = isDevelopment ? "com.berkayorhan.bcode.dev" : "com.berkayorhan.bcode";
```

- [ ] **Step 2: Flip `APP_BUNDLE_ID` in electron-launcher.mjs.**

Line 22:

```js
const APP_BUNDLE_ID = isDevelopment ? "com.berkayorhan.bcode.dev" : "com.berkayorhan.bcode";
```

- [ ] **Step 3: Flip `appId` in build-desktop-artifact.ts.**

Line 521:

```ts
    appId: "com.berkayorhan.bcode",
```

- [ ] **Step 4: Flip `artifactName` pattern.**

Line 523:

```ts
    artifactName: "BCode-${version}-${arch}.${ext}",
```

- [ ] **Step 5: Verify no stale references.**

```
grep -rn 'com.t3tools\|T3-Code-' apps scripts --include='*.ts' --include='*.mjs'
```

Expected: zero in source. (Historical plans/specs may still reference it — those are not touched.)

- [ ] **Step 6: Commit.**

```
git add apps/desktop/src/main.ts apps/desktop/scripts/electron-launcher.mjs scripts/build-desktop-artifact.ts
git commit -m "feat(rebrand): rename COM/bundle ID to com.berkayorhan.bcode"
```

### Task 2.5: Rename Linux desktop entry and WM class

**Files:**

- Modify: `apps/desktop/src/main.ts:117-118` (`LINUX_DESKTOP_ENTRY_NAME`, `LINUX_WM_CLASS`)
- Modify: `scripts/build-desktop-artifact.ts:552, 557` (`executableName`, `StartupWMClass`)

- [ ] **Step 1: Flip main.ts lines 117-118.**

```ts
const LINUX_DESKTOP_ENTRY_NAME = isDevelopment ? "bcode-dev.desktop" : "bcode.desktop";
const LINUX_WM_CLASS = isDevelopment ? "bcode-dev" : "bcode";
```

- [ ] **Step 2: Flip build-desktop-artifact.ts lines 552-558.**

```ts
buildConfig.linux = {
  target: [target],
  executableName: "bcode",
  icon: "icon.png",
  category: "Development",
  desktop: {
    entry: {
      StartupWMClass: "bcode",
    },
  },
};
```

- [ ] **Step 3: Verify.**

```
grep -rn 't3code' apps/desktop scripts --include='*.ts' --include='*.mjs'
```

Expected: references only inside the `USER_DATA_DIR_NAME = "t3code"` line (main.ts:119) — deliberately kept (see Scope § Out of scope). All other `t3code` references in desktop and scripts should be gone.

- [ ] **Step 4: Commit.**

```
git add apps/desktop/src/main.ts scripts/build-desktop-artifact.ts
git commit -m "feat(rebrand): rename Linux desktop entry and WM class to bcode"
```

### Task 2.6: Update current docs referencing the old identifiers

**Files:**

- Modify: `CLAUDE.md` (any surviving `T3CODE_*` mention post-PR #1)
- Modify: `docs/observability.md` (30 occurrences of `T3CODE_*` in env var docs)
- Modify: `docs/release.md` (2 occurrences)
- Modify: `docs/perf-benchmarks.md` (7 occurrences)
- Modify: `.docs/quick-start.md` (1 occurrence)
- Modify: `.docs/scripts.md` (5 occurrences — besides the `t3://` one in Task 2.3)
- Modify: `KEYBINDINGS.md` (1 occurrence of `~/.t3`)
- Modify: `.claude/rules/debugging.md` (1 occurrence of `~/.t3`)

Text replacement strategy: every `T3CODE_X` → `BCODE_X` for env var documentation, with a note near the top of `docs/observability.md` calling out the deprecation window:

> Note: `T3CODE_*` env vars still work through v0.0.19 with a deprecation warning. They are removed in v0.0.20. All examples below use the new `BCODE_*` names.

- [ ] **Step 1: Bulk-replace `T3CODE_` → `BCODE_` in the listed doc files.**

```powershell
Get-ChildItem -Path docs, .docs, .claude -Recurse -File -Include *.md `
  | ForEach-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      if ($content -match 'T3CODE_') {
        $updated = $content -replace 'T3CODE_', 'BCODE_'
        Set-Content -LiteralPath $_.FullName -Value $updated -NoNewline
      }
    }
```

Also update `CLAUDE.md` and `KEYBINDINGS.md` at the repo root (the command above skips the root — handle them manually or include them in the path list).

- [ ] **Step 2: Add the deprecation window note at the top of `docs/observability.md` § Configuration.**

Insert right before the first env var example.

- [ ] **Step 3: Flip `~/.t3` references in docs to `~/.bcode` (in current docs only, not historical plans/specs).**

Files to update: `KEYBINDINGS.md`, `.claude/rules/debugging.md`, `docs/observability.md`. Replace `~/.t3/` with `~/.bcode/` literally in each.

(Home dir runtime flip happens in PR #3; docs are updated now so PR #2 and PR #3 can ship independently without doc drift.)

- [ ] **Step 4: Commit.**

```
git add -- docs .docs .claude CLAUDE.md KEYBINDINGS.md
git commit -m "docs(rebrand): rewrite current docs for BCODE_* / bcode:// / ~/.bcode"
```

### Task 2.7: Verify PR #2

- [ ] **Step 1: `bun run fmt && bun run lint && bun run typecheck && bun run test`.**

All must be green. The deprecation warning is emitted via `console.warn`; in tests that spawn the CLI, assert either the new name succeeds or (separately) that the old name produces the warning.

- [ ] **Step 2: Browser tests.**

```
bun run --cwd apps/web test:browser
```

Expected: green.

- [ ] **Step 3: Desktop smoke.**

```
bun run test:desktop-smoke
```

Expected: green.

- [ ] **Step 4: Manual sanity check on Windows.**

In a separate shell:

```
$env:T3CODE_LOG_LEVEL = "Debug"
bun run dev:server
```

Expected: server starts with `Debug` log level AND emits the `T3CODE_LOG_LEVEL` deprecation warning exactly once. Kill the server. Unset and re-run with `BCODE_LOG_LEVEL=Debug`: no warning, same behavior.

### Task 2.8: Push PR #2

- [ ] **Step 1: Push.**

```
git push -u origin rebrand/env-protocol-com
```

- [ ] **Step 2: Open PR.**

```
gh pr create --repo Berkay2002/bcode --base main --head rebrand/env-protocol-com --title "feat(rebrand): env T3CODE_* → BCODE_*, protocol t3:// → bcode://, COM/Linux IDs" --body "$(cat <<'EOF'
## Summary
- Env vars: `T3CODE_*` → `BCODE_*` with one-release dual-read shim (`packages/shared/src/env.ts`).
- Desktop internal protocol scheme `t3://` → `bcode://` (no OS-level handler was ever registered).
- COM/bundle ID `com.t3tools.t3code` → `com.berkayorhan.bcode` in all three locations.
- Linux desktop entry + WM class: `t3code.desktop` → `bcode.desktop`.
- `artifactName` pattern: `T3-Code-…` → `BCode-…`.
- Current docs rewritten for new identifiers with a note about the v0.0.20 shim removal.

Ships in v0.0.19.

## Test plan
- [x] unit tests cover both BCODE_ and T3CODE_ env paths
- [x] `bun run fmt / lint / typecheck / test` green
- [x] `bun run --cwd apps/web test:browser` green
- [x] `bun run test:desktop-smoke` green
- [x] manual `T3CODE_LOG_LEVEL=Debug bun run dev:server` emits exactly one deprecation warning
- [ ] CI green
- [ ] Copilot review addressed
EOF
)"
```

- [ ] **Step 3: Wait for CI + Copilot review, address, squash-merge.**

---

## PR #3: Home Directory + localStorage + Auto-Migration

**Branch:** `rebrand/home-migration`, cut from `main` _after_ PR #2 has merged.

**Target state:** new installs use `~/.bcode` and `bcode:*` localStorage keys. Existing `~/.t3` and `t3code:*` data is copied over on first launch via marker-gated idempotent migration modules. Old locations are never mutated or deleted.

### Task 3.1: Add paths constants

**Files:**

- Create: `packages/shared/src/paths.ts`
- Create: `packages/shared/src/paths.test.ts`
- Modify: `packages/shared/package.json` (add `./paths` export)

- [ ] **Step 1: Write the failing test.**

Create `packages/shared/src/paths.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  HOME_DIR_NAME,
  LEGACY_T3_HOME_DIR_NAME,
  USER_DATA_MIGRATION_MARKER,
  resolveBcodeHome,
  resolveLegacyT3Home,
} from "./paths";

describe("paths constants", () => {
  it("exposes the canonical BCode home directory name", () => {
    expect(HOME_DIR_NAME).toBe(".bcode");
  });

  it("exposes the legacy T3 home directory name for migration lookup", () => {
    expect(LEGACY_T3_HOME_DIR_NAME).toBe(".t3");
  });

  it("exposes the migration marker filename", () => {
    expect(USER_DATA_MIGRATION_MARKER).toBe(".bcode-migration-v1-complete");
  });

  it("resolves ~/.bcode relative to a given home", () => {
    expect(resolveBcodeHome("/home/alice")).toBe("/home/alice/.bcode");
  });

  it("resolves ~/.t3 relative to a given home", () => {
    expect(resolveLegacyT3Home("/home/alice")).toBe("/home/alice/.t3");
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```
bun run --cwd packages/shared test -- paths
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `packages/shared/src/paths.ts`.**

```ts
import * as Path from "node:path";

export const HOME_DIR_NAME = ".bcode";
export const LEGACY_T3_HOME_DIR_NAME = ".t3";
export const USER_DATA_MIGRATION_MARKER = ".bcode-migration-v1-complete";

export function resolveBcodeHome(home: string): string {
  return Path.join(home, HOME_DIR_NAME);
}

export function resolveLegacyT3Home(home: string): string {
  return Path.join(home, LEGACY_T3_HOME_DIR_NAME);
}
```

- [ ] **Step 4: Add the subpath export in `packages/shared/package.json`.**

Insert into the `exports` block alphabetically (after `./Net`):

```json
    "./paths": {
      "types": "./src/paths.ts",
      "import": "./src/paths.ts"
    },
```

- [ ] **Step 5: Run test to verify it passes.**

```
bun run --cwd packages/shared test -- paths
```

Expected: 5 passing.

- [ ] **Step 6: Commit.**

```
git add packages/shared/src/paths.ts packages/shared/src/paths.test.ts packages/shared/package.json
git commit -m "feat(shared): add HOME_DIR_NAME + LEGACY_T3_HOME_DIR_NAME constants"
```

### Task 3.2: Write the user-data migration module (TDD)

**Files:**

- Create: `packages/shared/src/migration/userDataMigration.ts`
- Create: `packages/shared/src/migration/userDataMigration.test.ts`
- Modify: `packages/shared/package.json` (add `./migration/userDataMigration` export)

The migration module is written as an Effect function that takes an Effect `FileSystem` service so it is trivially testable via the in-memory layer. The contract:

1. If `<bcodeHome>/<marker>` exists → no-op.
2. If `<legacyHome>` doesn't exist → create `<bcodeHome>` (if absent), write marker, return `{ status: "fresh-install" }`.
3. If `<legacyHome>` exists → recursively copy into `<bcodeHome>`, skipping entries that already exist at the destination. Never mutate `<legacyHome>`. Write marker. Return `{ status: "migrated", filesCopied: N }`.
4. On per-entry permission errors during copy: log warning, skip entry, continue.
5. On destination write failure or marker write failure: fail with `MigrationBlockedError`.

- [ ] **Step 1: Write the failing tests.**

Create `packages/shared/src/migration/userDataMigration.test.ts`:

```ts
import { describe, expect, it } from "@effect/vitest";
import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect, Layer } from "effect";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { USER_DATA_MIGRATION_MARKER } from "../paths";
import { runUserDataMigration } from "./userDataMigration";

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "bcode-migration-test-"));
}

function cleanup(home: string): void {
  rmSync(home, { recursive: true, force: true });
}

describe("userDataMigration", () => {
  it.effect("fresh install: creates .bcode and writes marker", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        const result = yield* runUserDataMigration({ homeDir: home });
        expect(result.status).toBe("fresh-install");
        expect(existsSync(join(home, ".bcode"))).toBe(true);
        expect(existsSync(join(home, ".bcode", USER_DATA_MIGRATION_MARKER))).toBe(true);
        expect(existsSync(join(home, ".t3"))).toBe(false);
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  );

  it.effect("migrate: copies files from .t3 to .bcode", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3", "userdata"), { recursive: true });
        writeFileSync(join(home, ".t3", "userdata", "settings.json"), '{"foo":1}');
        writeFileSync(join(home, ".t3", "keybindings.json"), "{}");

        const result = yield* runUserDataMigration({ homeDir: home });

        expect(result.status).toBe("migrated");
        expect(result.filesCopied).toBeGreaterThanOrEqual(2);
        expect(readFileSync(join(home, ".bcode", "userdata", "settings.json"), "utf8")).toBe(
          '{"foo":1}',
        );
        expect(existsSync(join(home, ".bcode", "keybindings.json"))).toBe(true);
        // old location untouched
        expect(existsSync(join(home, ".t3", "userdata", "settings.json"))).toBe(true);
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  );

  it.effect("idempotent: second run is a no-op", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3"), { recursive: true });
        writeFileSync(join(home, ".t3", "a.txt"), "A");

        const first = yield* runUserDataMigration({ homeDir: home });
        expect(first.status).toBe("migrated");

        const second = yield* runUserDataMigration({ homeDir: home });
        expect(second.status).toBe("already-complete");
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  );

  it.effect("resume after partial migration: does not overwrite existing destination files", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3"), { recursive: true });
        writeFileSync(join(home, ".t3", "a.txt"), "A-new");
        mkdirSync(join(home, ".bcode"), { recursive: true });
        writeFileSync(join(home, ".bcode", "a.txt"), "A-old");
        // no marker set → triggers re-run

        const result = yield* runUserDataMigration({ homeDir: home });
        expect(result.status).toBe("migrated");
        expect(readFileSync(join(home, ".bcode", "a.txt"), "utf8")).toBe("A-old");
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeFileSystem.layer)),
  );
});
```

- [ ] **Step 2: Run test to verify it fails.**

```
bun run --cwd packages/shared test -- userDataMigration
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `packages/shared/src/migration/userDataMigration.ts`.**

```ts
import { FileSystem } from "@effect/platform";
import { Data, Effect } from "effect";

import {
  HOME_DIR_NAME,
  LEGACY_T3_HOME_DIR_NAME,
  USER_DATA_MIGRATION_MARKER,
  resolveBcodeHome,
  resolveLegacyT3Home,
} from "../paths";

export class MigrationBlockedError extends Data.TaggedError("MigrationBlockedError")<{
  readonly step: "read-marker" | "ensure-dest" | "copy" | "write-marker";
  readonly path: string;
  readonly cause: unknown;
}> {}

export type MigrationResult =
  | { readonly status: "fresh-install" }
  | { readonly status: "already-complete" }
  | { readonly status: "migrated"; readonly filesCopied: number };

export interface MigrationInput {
  readonly homeDir: string;
}

export const runUserDataMigration = Effect.fn("runUserDataMigration")(function* (
  input: MigrationInput,
) {
  const fs = yield* FileSystem.FileSystem;

  const bcodeHome = resolveBcodeHome(input.homeDir);
  const legacyHome = resolveLegacyT3Home(input.homeDir);
  const marker = `${bcodeHome}/${USER_DATA_MIGRATION_MARKER}`;

  const markerExists = yield* fs
    .exists(marker)
    .pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new MigrationBlockedError({ step: "read-marker", path: marker, cause })),
      ),
    );
  if (markerExists) {
    return { status: "already-complete" } as MigrationResult;
  }

  yield* fs
    .makeDirectory(bcodeHome, { recursive: true })
    .pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new MigrationBlockedError({ step: "ensure-dest", path: bcodeHome, cause })),
      ),
    );

  const legacyExists = yield* fs
    .exists(legacyHome)
    .pipe(Effect.catchAll(() => Effect.succeed(false)));

  let filesCopied = 0;

  if (legacyExists) {
    filesCopied = yield* copyTree(fs, legacyHome, bcodeHome);
  }

  yield* fs
    .writeFileString(marker, "v1\n")
    .pipe(
      Effect.catchAll((cause) =>
        Effect.fail(new MigrationBlockedError({ step: "write-marker", path: marker, cause })),
      ),
    );

  if (!legacyExists) {
    return { status: "fresh-install" } as MigrationResult;
  }
  return { status: "migrated", filesCopied } as MigrationResult;
});

const copyTree = Effect.fn("copyTree")(function* (
  fs: FileSystem.FileSystem,
  srcRoot: string,
  destRoot: string,
) {
  let copied = 0;
  const stack: Array<string> = [""];

  while (stack.length > 0) {
    const rel = stack.pop()!;
    const src = rel.length === 0 ? srcRoot : `${srcRoot}/${rel}`;
    const dest = rel.length === 0 ? destRoot : `${destRoot}/${rel}`;

    const stat = yield* fs.stat(src);
    if (stat.type === "Directory") {
      yield* fs
        .makeDirectory(dest, { recursive: true })
        .pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new MigrationBlockedError({ step: "ensure-dest", path: dest, cause })),
          ),
        );
      const entries = yield* fs.readDirectory(src);
      for (const entry of entries) {
        stack.push(rel.length === 0 ? entry : `${rel}/${entry}`);
      }
      continue;
    }

    const destExists = yield* fs.exists(dest).pipe(Effect.catchAll(() => Effect.succeed(false)));
    if (destExists) {
      continue;
    }

    yield* fs.copyFile(src, dest).pipe(
      Effect.catchAll((cause) => {
        if (isPermissionError(cause)) {
          return Effect.log(`[bcode] Skipping ${src} during migration: permission denied.`);
        }
        return Effect.fail(new MigrationBlockedError({ step: "copy", path: src, cause }));
      }),
    );

    copied += 1;
  }

  return copied;
});

function isPermissionError(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) return false;
  const tag = (cause as { _tag?: unknown })._tag;
  return tag === "SystemError" || tag === "PlatformError";
}
```

Adjust API-specific method names (`fs.makeDirectory` vs. `fs.makeDir`) to match the `@effect/platform` version in use — verify by opening `node_modules/@effect/platform/FileSystem.d.ts` and matching actual method names. The shape is otherwise stable.

- [ ] **Step 4: Add the subpath export.**

In `packages/shared/package.json`:

```json
    "./migration/userDataMigration": {
      "types": "./src/migration/userDataMigration.ts",
      "import": "./src/migration/userDataMigration.ts"
    },
```

- [ ] **Step 5: Run tests to verify they pass.**

```
bun run --cwd packages/shared test -- userDataMigration
```

Expected: 4 passing.

- [ ] **Step 6: Commit.**

```
git add packages/shared/src/migration packages/shared/package.json
git commit -m "feat(shared): add userDataMigration (copy-not-move, marker-gated)"
```

### Task 3.3: Wire user-data migration into server + desktop startup

**Files:**

- Modify: `apps/server/src/cli.ts` (add migration call before `resolveBaseDir`)
- Modify: `apps/desktop/src/main.ts` (add migration call before `BASE_DIR` is consumed for reads)
- Modify: `scripts/dev-runner.ts` (add migration call before spawning dev processes)

The migration runs **once per process startup, before any user-data read.** It is idempotent — concurrent double-launch just re-runs and no-ops on the second call.

- [ ] **Step 1: Wire into `apps/server/src/cli.ts`.**

Add an import:

```ts
import { runUserDataMigration } from "@bcode/shared/migration/userDataMigration";
```

Locate the existing `resolveBaseDir` call (around line 276). Before that call:

```ts
yield *
  runUserDataMigration({ homeDir: OS.homedir() }).pipe(
    Effect.tapError((error) =>
      Effect.logWarning(
        `[bcode] User-data migration failed; continuing with existing state. ${error.step} at ${error.path}`,
      ),
    ),
    Effect.catchAll(() => Effect.void),
  );
```

If the migration fails and the server continues with pre-existing state, that's acceptable because the old `~/.t3` is untouched. Do not block startup on migration failure; log and proceed.

(If `OS.homedir()` isn't already imported in this file, add `import * as OS from "node:os";`.)

- [ ] **Step 2: Wire into `apps/desktop/src/main.ts`.**

Desktop initialization runs before Effect is bootstrapped. Use a small sync wrapper that runs the migration effect on the Node runtime. Near the top of `main.ts`, after imports:

```ts
import { runUserDataMigration } from "@bcode/shared/migration/userDataMigration";
import { NodeFileSystem } from "@effect/platform-node";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

function runMigrationSync(): void {
  try {
    Effect.runSync(
      runUserDataMigration({ homeDir: OS.homedir() }).pipe(
        Effect.provide(NodeFileSystem.layer),
        Effect.catchAll((error) =>
          Effect.sync(() =>
            console.warn(
              `[bcode] User-data migration failed (${error.step} at ${error.path}); continuing.`,
            ),
          ),
        ),
      ),
    );
  } catch (error) {
    console.warn("[bcode] User-data migration threw unexpectedly; continuing.", error);
  }
}
```

Call `runMigrationSync()` **immediately after `app` is imported but BEFORE line 103 (the `BASE_DIR` computation).** Line 103 reads from `readEnv("HOME")` which may point to a custom path; when unset, it falls back to `~/.t3` — so the migration runs before that fallback is first observed. After the migration runs, flip the fallback default to `Path.join(OS.homedir(), ".bcode")` (Task 3.4).

- [ ] **Step 3: Wire into `scripts/dev-runner.ts`.**

Before the `DEFAULT_T3_HOME` constant (line 19) is first evaluated, run the migration. Since `dev-runner.ts` is an Effect program already, add an Effect step:

```ts
import { runUserDataMigration } from "@bcode/shared/migration/userDataMigration";
```

Inside the main Effect program, add at the top of the command handler:

```ts
yield * runUserDataMigration({ homeDir: homedir() }).pipe(Effect.catchAll(() => Effect.void));
```

- [ ] **Step 4: Rename `DEFAULT_T3_HOME` → `DEFAULT_BCODE_HOME`.**

In `scripts/dev-runner.ts`:

```ts
export const DEFAULT_BCODE_HOME = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(homedir(), ".bcode"),
);
```

Update all references in the file and tests.

- [ ] **Step 5: Commit.**

```
git add apps/server/src/cli.ts apps/desktop/src/main.ts scripts/dev-runner.ts
git commit -m "feat: wire userDataMigration into server/desktop/dev-runner startup"
```

### Task 3.4: Flip the `~/.t3` default to `~/.bcode` in every runtime reader

**Files:**

- Modify: `apps/server/src/os-jank.ts:72`
- Modify: `apps/desktop/src/main.ts:103`
- Modify: `scripts/dev-runner.ts:19-21`
- Modify: `scripts/dev-runner.test.ts:50,66` (test assertions)

- [ ] **Step 1: Flip `apps/server/src/os-jank.ts:72`.**

```ts
import { HOME_DIR_NAME } from "@bcode/shared/paths";
```

Add this import near the top.

Line 72, inside `resolveBaseDir`:

```ts
return join(OS.homedir(), HOME_DIR_NAME);
```

- [ ] **Step 2: Flip `apps/desktop/src/main.ts:103`.**

Import `HOME_DIR_NAME`:

```ts
import { HOME_DIR_NAME } from "@bcode/shared/paths";
```

Change line 103:

```ts
const BASE_DIR = readEnv("HOME")?.trim() || Path.join(OS.homedir(), HOME_DIR_NAME);
```

- [ ] **Step 3: Flip `scripts/dev-runner.ts:19-21`.**

```ts
import { HOME_DIR_NAME } from "@bcode/shared/paths";
// ...
export const DEFAULT_BCODE_HOME = Effect.map(Effect.service(Path.Path), (path) =>
  path.join(homedir(), HOME_DIR_NAME),
);
```

- [ ] **Step 4: Update `scripts/dev-runner.test.ts:50,66`.**

Change the test description and assertion:

```ts
it.effect("defaults BCODE_HOME to ~/.bcode when not provided", () =>
  Effect.gen(function* () {
    // ...
    assert.equal(env.BCODE_HOME, resolve(homedir(), ".bcode"));
  }),
);
```

- [ ] **Step 5: Run the migration + default tests end-to-end.**

```
bun run --cwd scripts test -- dev-runner
bun run --cwd apps/server test -- cli
```

Expected: green.

- [ ] **Step 6: Commit.**

```
git add apps/server/src/os-jank.ts apps/desktop/src/main.ts scripts/dev-runner.ts scripts/dev-runner.test.ts
git commit -m "feat: flip default home dir to ~/.bcode"
```

### Task 3.5: Write the localStorage migration module (TDD)

**Files:**

- Create: `apps/web/src/migration/storageMigration.ts`
- Create: `apps/web/src/migration/storageMigration.test.ts`

- [ ] **Step 1: Write the failing test.**

Create `apps/web/src/migration/storageMigration.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { STORAGE_MIGRATION_MARKER, runStorageMigration } from "./storageMigration";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("runStorageMigration", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("no-ops when marker is already set", () => {
    storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
    storage.setItem("t3code:theme", "dark");
    const result = runStorageMigration(storage);
    expect(result).toEqual({ status: "already-complete" });
    expect(storage.getItem("bcode:theme")).toBeNull();
  });

  it("copies t3code:* to bcode:* and sets marker", () => {
    storage.setItem("t3code:theme", "dark");
    storage.setItem("t3code:ui-state:v1", "{}");
    storage.setItem("unrelated-key", "x");

    const result = runStorageMigration(storage);

    expect(result.status).toBe("migrated");
    expect(result.keysCopied).toBe(2);
    expect(storage.getItem("bcode:theme")).toBe("dark");
    expect(storage.getItem("bcode:ui-state:v1")).toBe("{}");
    expect(storage.getItem("unrelated-key")).toBe("x");
    expect(storage.getItem("t3code:theme")).toBe("dark"); // never deleted
    expect(storage.getItem(STORAGE_MIGRATION_MARKER)).toBe("v1");
  });

  it("does not overwrite existing bcode:* keys", () => {
    storage.setItem("t3code:theme", "dark");
    storage.setItem("bcode:theme", "light");
    const result = runStorageMigration(storage);
    expect(result.status).toBe("migrated");
    expect(storage.getItem("bcode:theme")).toBe("light");
  });

  it("returns fresh-install when no t3code:* keys exist", () => {
    const result = runStorageMigration(storage);
    expect(result).toEqual({ status: "fresh-install" });
    expect(storage.getItem(STORAGE_MIGRATION_MARKER)).toBe("v1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails.**

```
bun run --cwd apps/web test -- storageMigration
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `apps/web/src/migration/storageMigration.ts`.**

```ts
export const STORAGE_MIGRATION_MARKER = "bcode:migration-v1-complete";
const LEGACY_PREFIX = "t3code:";
const NEW_PREFIX = "bcode:";

export type StorageMigrationResult =
  | { readonly status: "already-complete" }
  | { readonly status: "fresh-install" }
  | { readonly status: "migrated"; readonly keysCopied: number };

export function runStorageMigration(storage: Storage): StorageMigrationResult {
  if (storage.getItem(STORAGE_MIGRATION_MARKER) !== null) {
    return { status: "already-complete" };
  }

  const legacyKeys: Array<string> = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(LEGACY_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  if (legacyKeys.length === 0) {
    storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
    return { status: "fresh-install" };
  }

  let copied = 0;
  for (const legacyKey of legacyKeys) {
    const newKey = `${NEW_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
    if (storage.getItem(newKey) !== null) continue;
    const value = storage.getItem(legacyKey);
    if (value === null) continue;
    storage.setItem(newKey, value);
    copied += 1;
  }

  storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
  return { status: "migrated", keysCopied: copied };
}
```

- [ ] **Step 4: Run test to verify it passes.**

```
bun run --cwd apps/web test -- storageMigration
```

Expected: 4 passing.

- [ ] **Step 5: Commit.**

```
git add apps/web/src/migration
git commit -m "feat(web): add storage migration (t3code:* → bcode:*, copy-not-delete)"
```

### Task 3.6: Wire storage migration into web app boot

**Files:**

- Modify: `apps/web/src/main.tsx` (or the app's boot entry — discover with `grep -l 'createRoot' apps/web/src`)

- [ ] **Step 1: Locate the boot entry.**

Run:

```
grep -rn 'createRoot\|ReactDOM.render' apps/web/src --include='*.tsx' --include='*.ts'
```

Expected to find a `main.tsx` or similar. Open it.

- [ ] **Step 2: Add the migration call before any store hydrates.**

At the very top of the boot file (after React imports):

```ts
import { runStorageMigration } from "./migration/storageMigration";

if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
  runStorageMigration(window.localStorage);
}
```

This must run before any other code touches localStorage (zustand stores, `uiStateStore.ts`, `useTheme.ts`, etc.). Confirm by reading the file — if there are imports above this block that eagerly touch storage, hoist the migration call higher.

- [ ] **Step 3: Manually verify in a dev browser.**

```
bun run dev:web
```

Open the web app, open DevTools → Application → Local Storage. Before:

- manually add `t3code:theme = "dark"` via DevTools console: `localStorage.setItem("t3code:theme", "dark")`
- hard reload the tab

Expected: `bcode:theme = "dark"` appears, `t3code:theme = "dark"` still exists, `bcode:migration-v1-complete = "v1"` is set. A second reload should not re-run (console.log from the migration, if you added one for debugging, only fires once).

- [ ] **Step 4: Commit.**

```
git add apps/web/src/main.tsx
git commit -m "feat(web): run storage migration on boot before store hydrate"
```

### Task 3.7: Flip localStorage keys in `apps/web`

Now that migration preserves user data, flip every hardcoded `t3code:*` to `bcode:*`.

**Files** (from grep):

- Modify: `apps/web/src/clientPersistenceStorage.ts:12-13`
- Modify: `apps/web/src/composerDraftStore.ts:45`
- Modify: `apps/web/src/editorPreferences.ts:5`
- Modify: `apps/web/src/components/ChatView.browser.tsx` (3 occurrences at 2002, 3529, 3558)
- Modify: `apps/web/src/hooks/useLocalStorage.ts:42`
- Modify: `apps/web/src/components/ChatView.logic.ts:21`
- Modify: `apps/web/src/uiStateStore.ts:4-11` (8 occurrences — versioned renderer state keys)
- Modify: `apps/web/src/terminalStateStore.ts:41`
- Modify: `apps/web/src/hooks/useTheme.ts:9`

- [ ] **Step 1: Flip every `"t3code:…"` literal to `"bcode:…"`.**

For each file above, replace `"t3code:` with `"bcode:` inside string literals. For `uiStateStore.ts`, the array of legacy versioned keys (`t3code:renderer-state:v8`, `v7`, … `v3`) should become `bcode:renderer-state:v8`, etc. — keeping the version history intact.

The migration handles user carryover; these constants just change what's READ and WRITTEN from now on.

Note on `apps/web/src/uiStateStore.ts`: the legacy versions list exists so that zustand's `migrate` hook can upgrade users from older state versions. When you flip the prefix here, also double-check that your migration module (Task 3.5) would have copied the user's `t3code:renderer-state:v8` → `bcode:renderer-state:v8` before zustand mounts — it will, because migration runs before any store hydrates.

- [ ] **Step 2: Flip `.keybindingsConfigPath` fixtures.**

`apps/web/src/components/ChatView.browser.tsx:157`, `apps/web/src/components/KeybindingsToast.browser.tsx:70`, `apps/web/src/components/settings/SettingsPanels.browser.tsx:198` all reference `.t3code-keybindings.json`. Change to `.bcode-keybindings.json`.

If the keybindings config filename is also referenced in server code, grep `grep -rn '\.t3code-keybindings' apps packages` — flip every hit and confirm no stale references.

- [ ] **Step 3: Verify.**

```
grep -rn 't3code:' apps/web/src --include='*.ts' --include='*.tsx'
```

Expected: zero source hits (tests may still reference the old keys in legacy-compat tests for the migration — keep those).

- [ ] **Step 4: Run browser tests.**

```
bun run --cwd apps/web test
bun run --cwd apps/web test:browser
```

Expected: green. If a test blows up because it reads `t3code:foo` directly, either update it to expect `bcode:foo` or convert it to assert migration behavior.

- [ ] **Step 5: Commit.**

```
git add apps/web
git commit -m "feat(web): flip localStorage keys t3code:* → bcode:*"
```

### Task 3.8: Rename legacy `~/.t3` doc references and test fixtures to `~/.bcode` where appropriate

**Files:**

- Modify: test fixtures containing `/.t3/worktrees/` (tests only):
  - `packages/contracts/src/terminal.test.ts` (4 occurrences)
  - `apps/web/src/components/BranchToolbar.logic.test.ts` (14 occurrences)
  - `apps/web/src/components/Sidebar.logic.test.ts` (2 occurrences)
  - `apps/web/src/worktreeCleanup.test.ts` (3 occurrences — including a description string at line 101)
  - `apps/web/src/components/ChatView.browser.tsx:3681` (fixture path)

No runtime source constant hardcodes `.t3/worktrees/` — these are fixture data representing real on-disk paths. Renaming them keeps tests consistent with the post-rebrand world.

- [ ] **Step 1: Bulk-replace fixture paths.**

```powershell
Get-ChildItem -Path apps, packages -Recurse -File -Include *.test.ts, *.test.tsx, *.browser.tsx `
  | ForEach-Object {
      $content = Get-Content -LiteralPath $_.FullName -Raw
      if ($content -match '/\.t3/worktrees/|\\.t3\\worktrees\\\\') {
        $updated = $content -replace '/\.t3/worktrees/', '/.bcode/worktrees/'
        $updated = $updated -replace '\\.t3\\worktrees\\\\', '\\.bcode\\worktrees\\\\'
        Set-Content -LiteralPath $_.FullName -Value $updated -NoNewline
      }
    }
```

Also handle `apps/web/src/worktreeCleanup.test.ts:89,96,101` (which uses `/Users/julius/.t3/worktrees/...` and `C:\Users\julius\.t3\worktrees\...` patterns and an English description).

- [ ] **Step 2: Update `/repo/project/.t3/logs` paths in `apps/web/src/components/*.browser.tsx` fixtures.**

These are test fixture paths simulating a `~/.t3/logs` directory. Rewrite to `.bcode/logs` for consistency.

Run:

```
grep -rn '/\.t3/logs' apps --include='*.tsx' --include='*.ts'
```

Replace each occurrence literally.

- [ ] **Step 3: Run affected tests.**

```
bun run --cwd packages/contracts test -- terminal
bun run --cwd apps/web test -- BranchToolbar
bun run --cwd apps/web test -- Sidebar
bun run --cwd apps/web test -- worktreeCleanup
```

Expected: green.

- [ ] **Step 4: Commit.**

```
git add -- apps packages
git commit -m "test(rebrand): rename .t3/ fixture paths to .bcode/ for consistency"
```

### Task 3.9: Final cross-cutting verification

- [ ] **Step 1: `bun run fmt && bun run lint && bun run typecheck && bun run test`.**

All green.

- [ ] **Step 2: Browser + desktop smoke.**

```
bun run --cwd apps/web test:browser
bun run test:desktop-smoke
```

Both green.

- [ ] **Step 3: Developer-machine manual migration rehearsal.**

Skip this step if you don't have an existing `~/.t3` on the machine. If you do:

1. Snapshot existing state: `cp -r ~/.t3 ~/.t3-backup-$(date +%Y%m%d)`.
2. Build a local desktop artifact: `bun run dist:desktop:win` (Windows) or `bun run dist:desktop:dmg:arm64` (macOS).
3. Install and launch it once.
4. Verify:
   - `~/.bcode/` exists with session files.
   - `~/.bcode/.bcode-migration-v1-complete` exists.
   - `~/.t3/` is unchanged (compare against backup with `diff -r ~/.t3 ~/.t3-backup-…`).
   - Sessions from the old install are visible in the new app's UI.
5. Quit the app, relaunch. Expected: second launch is fast (marker-skip path); no duplicate files appear under `~/.bcode/`.

- [ ] **Step 4: Repo-wide final scan.**

```
grep -rn 't3code\|@t3tools\|T3CODE_\|t3://\|com\.t3tools\|\.t3/' apps packages scripts --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.json' --include='*.jsonc'
```

Expected remaining hits (acceptable):

- `LEGACY_T3_HOME_DIR_NAME = ".t3"` in `packages/shared/src/paths.ts` — intentional.
- `T3CODE_` inside the dual-read shim (`packages/shared/src/env.ts`, `apps/server/src/cli.ts` helper) — intentional.
- `USER_DATA_DIR_NAME = "t3code"` in `apps/desktop/src/main.ts` — deliberate non-rename.
- `LEGACY_USER_DATA_DIR_NAME = "T3 Code (Alpha)"` — pre-T3 path, deliberate.
- Tests asserting the legacy shim behavior (`env.test.ts`, `storageMigration.test.ts`, `userDataMigration.test.ts`).

Every other hit should be investigated — either convert to new name or document why it's preserved.

### Task 3.10: Push PR #3

- [ ] **Step 1: Push.**

```
git push -u origin rebrand/home-migration
```

- [ ] **Step 2: Open PR.**

```
gh pr create --repo Berkay2002/bcode --base main --head rebrand/home-migration --title "feat(rebrand): migrate ~/.t3 → ~/.bcode and t3code:* → bcode:* localStorage" --body "$(cat <<'EOF'
## Summary
- Adds `userDataMigration` (copy-not-move, marker-gated, idempotent) wired into server/desktop/dev-runner startup.
- Adds `storageMigration` wired into web boot before any store hydrates.
- Flips home-dir default from `~/.t3` to `~/.bcode` in all three runtime readers.
- Flips every `t3code:*` localStorage key to `bcode:*`.
- Renames fixture paths `.t3/worktrees/...` → `.bcode/worktrees/...` for consistency.

Completes v0.0.19 identifier rebrand.

## Migration behavior
- First launch: copies `~/.t3` → `~/.bcode` (files that already exist at the destination are preserved). Never mutates `~/.t3`.
- Marker file `~/.bcode/.bcode-migration-v1-complete` gates subsequent launches.
- On per-entry permission errors: warns and skips; migration continues.
- On destination write failure: logs and continues with pre-existing state.

## Known cost (accepted in spec R9/R10)
- New bundle ID means the app appears as a fresh install to the OS: window positions reset, taskbar pin lost.
- Electron auto-update from v0.0.18 → v0.0.19 may not detect the new bundle; users may need a one-time manual install. Release notes must call this out.

## Test plan
- [x] `bun run fmt / lint / typecheck / test` green
- [x] `bun run --cwd apps/web test:browser` green
- [x] `bun run test:desktop-smoke` green
- [x] unit tests cover fresh-install, migrate, idempotent, partial-resume, permission-denied cases
- [x] manual rehearsal on developer machine with real `~/.t3` (see Task 3.9 step 3)
- [ ] CI green
- [ ] Copilot review addressed
EOF
)"
```

- [ ] **Step 3: Wait for CI + Copilot, address, squash-merge.**

---

## Post-Merge: Cut v0.0.19

Once all three PRs are merged to `main`:

- [ ] **Step 1: Bump version.**

```
bun run --cwd apps/server version 0.0.19
```

…or edit `apps/server/package.json`, `apps/web/package.json`, `apps/desktop/package.json`, `packages/contracts/package.json`, `packages/shared/package.json`, `packages/client-runtime/package.json` manually to `"version": "0.0.19"`.

- [ ] **Step 2: Commit and push.**

```
git add -A
git commit -m "chore(release): v0.0.19"
git push origin main
```

- [ ] **Step 3: Tag.**

```
git tag v0.0.19
git push origin v0.0.19
```

- [ ] **Step 4: Watch the release workflow.**

```
gh run watch --repo Berkay2002/bcode
```

Expected: GitHub Release produced, `@berkayorhan/bcode@0.0.19` on npm, installers attached.

- [ ] **Step 5: Draft release notes.**

Call out the following in the GitHub Release body:

> **Breaking (for some users):** This release renames internal identifiers:
>
> - Env vars: `T3CODE_*` → `BCODE_*`. `T3CODE_*` is still read with a one-time deprecation warning and will be removed in v0.0.20. Rename your `.env` files now.
> - Home directory: `~/.t3` → `~/.bcode`. Your data is automatically migrated on first launch (copy, not move — `~/.t3` is untouched). You can delete `~/.t3` once you've confirmed everything works.
> - localStorage keys in the web UI: `t3code:*` → `bcode:*`. Migrated automatically on first boot.
> - Bundle ID: `com.t3tools.t3code` → `com.berkayorhan.bcode`. **Side effect:** the desktop app appears as a fresh install to your OS — taskbar pins and Finder favorites may need to be recreated. Auto-update from v0.0.18 may also require a one-time manual install; subsequent updates work normally.

---

## Deferred: v0.0.20 shim removal (separate plan, not this one)

After v0.0.19 has been in use for at least a week and no users are hitting the deprecation warning:

- Remove the `readEnv` shim and inline `process.env.BCODE_*` reads, or rewrite the `Config.string("BCODE_*")` helper in `apps/server/src/cli.ts` to drop the `orElse` clause.
- Remove `packages/shared/src/env.ts` or keep just the shape for future use.
- Remove the `T3CODE_HOME` backwards-compat assertion in `scripts/dev-runner.test.ts`.
- Optionally: stop migrating from `~/.t3` (remove `runUserDataMigration` call sites and module) — but the marker makes it free to keep, so this is purely optional.
- Optionally: flip `USER_DATA_DIR_NAME` from `"t3code"` → `"bcode"` and extend the legacy chain. Separate concern from the v0.0.20 shim removal.

---

## Self-Review

**Spec coverage (checking `docs/superpowers/specs/2026-04-16-bcode-release-and-deep-rebrand-design.md` § Sub-Project 2 against tasks):**

- Workspace scope rename (§ PR #1) → PR #1 Tasks 1.2–1.8. ✓
- Env vars + protocol + COM ID + Linux entry (§ PR #2) → PR #2 Tasks 2.1–2.7. ✓
- Env var dual-read shim → Task 2.1. ✓
- Home dir + localStorage + auto-migration (§ PR #3) → PR #3 Tasks 3.1–3.9. ✓
- Migration design — copy-not-move, marker-gated, idempotent, per-file error handling → Task 3.2 implementation + test cases. ✓
- localStorage migration synchronous at boot, before store reads → Task 3.6. ✓
- Risks R5 (missed import), R6 (corrupt `~/.t3`), R7 (partial migration resume), R9 (bundle ID change) → addressed in release notes + PR descriptions. ✓
- Out-of-scope items from spec (code signing, nightly builds, shim removal) → honored; shim removal moved to a v0.0.20 note. ✓

**Type consistency:** function names I used across tasks —

- `readEnv(suffix, env?)` returns `string | undefined` — used consistently in Task 2.1, Task 2.2, Task 3.3. ✓
- `runUserDataMigration({ homeDir })` returns `Effect<MigrationResult, MigrationBlockedError>` — used in Task 3.2 (tests + impl), Task 3.3 (wiring). ✓
- `runStorageMigration(storage)` returns `StorageMigrationResult` (sync, not Effect) — used in Task 3.5 (tests + impl), Task 3.6 (wiring). ✓
- `HOME_DIR_NAME`, `LEGACY_T3_HOME_DIR_NAME`, `USER_DATA_MIGRATION_MARKER` — defined once in Task 3.1, imported thereafter. ✓
- `STORAGE_MIGRATION_MARKER = "bcode:migration-v1-complete"` — defined in Task 3.5, asserted in the same test. ✓

**Placeholder scan:** grepped for "TBD", "TODO", "figure out", "as needed". One soft TODO in Task 3.2 step 3 ("Adjust API-specific method names to match the `@effect/platform` version in use — verify by opening …") — intentional, because the `@effect/platform` API surface drifts slightly between minor versions and the exact method shape isn't stable enough to hardcode. The note points the executor at the source of truth. Retained.

**Ambiguity check:** PR #2 Task 2.2 step 6 tells the executor to use `readEnv` for plain `process.env.T3CODE_X` reads AND also calls out the `.mjs` inline-fallback case. Both paths covered. PR #3 Task 3.8 bulk-rewrite is explicit about which PowerShell regex to use for POSIX and Windows path separators. No unresolved ambiguity.
