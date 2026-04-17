# PR #2 Execution Breakdown — rebrand/env-protocol-com

> **Execution plan** for PR #2 of the BCode deep identifier rebrand. The behavioral plan of record is `docs/superpowers/plans/2026-04-17-bcode-deep-identifier-rebrand.md` §§ PR #2 (lines 498–1152). This file is a condensed, commit-by-commit checklist with scope adjustments, decisions taken, and verification steps.

## Context

PR #1 merged the workspace scope rename `@t3tools/* → @bcode/*` as `d91a66ea`. PR #2 flips the **env var prefix**, the **desktop internal protocol scheme**, the **COM/bundle ID**, and the **Linux desktop entry/WM class** — ending the upstream-T3 leakage in the runtime layer while preserving backwards compatibility via a one-release env var shim (`T3CODE_*` still read with a deprecation warning through v0.0.19, removed in v0.0.20).

PR #3 (separate branch, later) handles `~/.t3 → ~/.bcode` and `t3code:* → bcode:*` localStorage with idempotent migration modules.

### Scope (inventory from exploration)

- **A — env var prefix `T3CODE_* → BCODE_*`**: 290 occurrences across 34 files. Hottest files: `scripts/dev-runner.ts` (38), `apps/server/src/cli-config.test.ts` (29), `scripts/dev-runner.test.ts` (27), `scripts/build-desktop-artifact.ts` (23), `apps/server/src/cli.ts` (21), `apps/desktop/src/main.ts` (19), `turbo.json` (17).
- **B — desktop scheme `t3:// → bcode://`**: `apps/desktop/src/main.ts:108` (`DESKTOP_SCHEME`) + `.docs/scripts.md:23` doc reference. No OS-level handler was ever registered (`setAsDefaultProtocolClient` is not called), so this is internal-only and safe to flip.
- **C — COM/bundle ID `com.t3tools.t3code → com.berkayorhan.bcode`**: three locations — `apps/desktop/src/main.ts:116`, `apps/desktop/scripts/electron-launcher.mjs:22`, `scripts/build-desktop-artifact.ts:521`.
- **D — Linux entry/WM class + artifact name**: `apps/desktop/src/main.ts:117-118`, `scripts/build-desktop-artifact.ts:523, 552, 557`. Plus **test fixtures** that hardcode the old `T3-Code-*` artifact naming: `scripts/merge-mac-update-manifests.test.ts` (~8 refs) and `scripts/release-smoke.ts` (~8 refs). These were missed by the plan doc; called out explicitly here.
- **E — shell sentinels `__T3CODE_PATH_*` / `__T3CODE_ENV_*`**: `packages/shared/src/shell.ts` (4 definitions) + `packages/shared/src/shell.test.ts` (14 refs).
- **F — bootstrap envelope field `t3Home → bcodeHome`**: `apps/server/src/cli.ts:74, 158, 280-281`, consumed in `apps/desktop/src/main.ts`, `scripts/dev-runner.ts`, and their test fixtures. Internal-to-fork field; no external contract.
- **Deliberate keeps** (per `AGENTS.md:23-26`): `LEGACY_USER_DATA_DIR_NAME`, `USER_DATA_DIR_NAME = "t3code"` (electron's userData subdir — preserves install state), `LEGACY_T3_HOME_DIR_NAME = ".t3"`, `~/.t3` home, `t3code:*` localStorage, historical `docs/superpowers/plans|specs/` files.

### Key decisions (taken without asking, flagged here)

1. **turbo.json `globalEnv`**: add the 17 new `BCODE_*` keys **alongside** the 17 existing `T3CODE_*` keys through v0.0.19. Rationale: cache invalidation must fire when _either_ prefix changes while the shim is active; removing `T3CODE_*` from the list would let stale cache hide dual-read bugs. PR that removes the shim in v0.0.20 also drops the legacy entries.
2. **`t3Home` → `bcodeHome`** schema field rename: proceed. It's internal to the fork (bootstrap envelope between desktop shell and server process); no consumer outside this repo. Aligns with naming convention.
3. **Skip the plan doc's "manual Windows sanity check"** (Task 2.7 Step 4): unit test on the shim + desktop smoke test + CI cover the same surface. Can't drive an interactive dev server from this execution lane.
4. **Stick with the plan doc's Effect `Config.orElse` + `Config.map` pattern** for dual-reading env vars in `apps/server/src/cli.ts`. Verified `Config.logLevel(key)` accepts a key arg; `Config.orElse` is documented in Effect v3. If type inference pushes back on a specific variant (likely `Config.port`/`Config.int` as the plan doc warns), fall back to reading through `bcodeConfigString` + manual parse.

### Carry-forward lessons from PR #1

- CI runner is `ubuntu-24.04` (already fixed).
- Copilot review exceeds file-count limit on large PRs → dispatch `pr-review-toolkit:code-reviewer` + `comment-analyzer` manually before merging.
- Lockfile discipline: if `bun install --lockfile-only` runs, diff and disclose any transitive drift in the PR body.
- `apps/server` has ~23 pre-existing Windows test failures on `main` (e.g. `Manager.test.ts`). **Not a regression** from this PR — disclose in PR body; don't fix inline. Delegate to `/bugfix` if it grows.

---

## Task list (one commit per task unless noted)

### 1. Prep: branch off clean main

- `git switch main && git pull --ff-only`
- `git switch -c rebrand/env-protocol-com`
- Confirm: `bun run typecheck` green, `git status` clean.

### 2. Commit: `feat(shared): add env dual-read shim`

Implements plan doc Task 2.1 (TDD).

- Write failing test at `packages/shared/src/env.test.ts` (4 cases: prefers new, falls back + warns once, undefined when neither, empty string is "set").
- Implement `packages/shared/src/env.ts` with `readEnv(suffix, env?)` + `__resetEnvDeprecationWarningsForTests()`, Set-based one-shot warn per legacy key.
- Add `./env` subpath export to `packages/shared/package.json` (alphabetical, before `./git`).
- Verify: `bun run --cwd packages/shared test` green.

### 3. Commit: `feat(rebrand): flip server CLI env vars via Effect Config shim`

Implements plan doc Task 2.2 steps 1–4, 9.

- Add `bcodeConfigString` + `bcodeConfigWithFallback` helpers to `apps/server/src/cli.ts`.
- Rewrite lines 130–172: every `Config.string("T3CODE_X")` → shim-wrapped `BCODE_X` with `T3CODE_X` fallback + per-key `console.warn`.
- Flag descriptions on lines 98 and 123: `T3CODE_*` → `BCODE_*` in user-facing text.
- Rename the `t3Home` schema field (line 74) → `bcodeHome`; update the `Option.fromUndefinedOr(env.t3Home)` / `bootstrap?.t3Home` merger.
- Update `apps/server/src/cli-config.test.ts`: flip primary fixtures to `BCODE_HOME`, rename `t3Home:` → `bcodeHome:`, add one regression test asserting `T3CODE_HOME` still works + emits one warning.
- Verify: `bun run --cwd apps/server test -- cli`.

### 4. Commit: `feat(rebrand): flip desktop + scripts env readers to readEnv helper`

Implements plan doc Task 2.2 steps 5–6.

- `apps/desktop/src/main.ts:103`: replace `process.env.T3CODE_HOME` with `readEnv("HOME")` (import `readEnv` from `@bcode/shared/env`). Path default stays `.t3` here — PR #3 flips to `.bcode`.
- `apps/desktop/src/updateState.ts` + its test: replace T3CODE\_ env reads with `readEnv`.
- `apps/web/vite.config.ts`, `apps/web/test/perf/{serverEnv,appHarness,supportHelpers.test}.ts`: flip to `readEnv` (or inline fallback where runtime layer can't import `@bcode/shared`).
- `apps/server/integration/perf/serverPerfHarness.ts`, `apps/server/src/perf/config.ts`, `apps/server/src/perf/PerfProviderAdapter.test.ts`: flip to `readEnv` / `BCODE_*`.
- `apps/server/src/terminal/Layers/Manager{,.test}.ts`, `apps/server/src/project/Layers/ProjectSetupScriptRunner.test.ts`, `apps/server/src/git/Layers/CodexTextGeneration.test.ts`, `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`, `apps/server/src/telemetry/Layers/AnalyticsService{,.test}.ts`, `apps/web/src/projectScripts.test.ts`, `apps/web/src/components/ChatView.browser.tsx`: flip to `BCODE_*` (trust shim for runtime compat).
- `scripts/dev-runner.ts` + `.test.ts`, `scripts/build-desktop-artifact.ts` + `.test.ts`, `scripts/mock-update-server.ts`, `scripts/open-perf-app.ts`: flip. Dev-runner and build-desktop-artifact both need to **write** `BCODE_*` into spawned child env and **also** propagate any inbound `T3CODE_*` (shim-side: the child's `readEnv` handles it).
- `apps/desktop/scripts/electron-launcher.mjs`: **cannot** import `@bcode/shared/env` (standalone ESM launcher, confirmed). Inline the fallback: `process.env.BCODE_X ?? process.env.T3CODE_X` with a one-shot `console.warn` on the legacy path.
- Verify: `bun run --cwd apps/server test`, `bun run --cwd apps/web test`, `bun run --cwd scripts test` (or root `bun run test`).

### 5. Commit: `feat(rebrand): flip shell sentinels __T3CODE_* → __BCODE_*`

Implements plan doc Task 2.2 steps 7–8.

- `packages/shared/src/shell.ts` lines 4–5, 107, 111: `__T3CODE_PATH_START__` / `_END_` / `__T3CODE_ENV_${name}_START__` / `_END_` → `__BCODE_*`.
- `packages/shared/src/shell.test.ts`: update all 14 sentinel assertions.
- `packages/shared/src/projectScripts.ts`: context-check each occurrence; if it's a sentinel (internal, non-persisted), flip cleanly. If it's a persisted value, wrap in `readEnv`.
- Verify: `bun run --cwd packages/shared test`.

### 6. Commit: `chore(rebrand): add BCODE_* entries to turbo globalEnv cache`

- `turbo.json` lines 8–24: add the 17 `BCODE_*` parallel keys while keeping the 17 `T3CODE_*` entries. When the shim is dropped in v0.0.20, the `T3CODE_*` entries get removed in that PR.

### 7. Commit: `feat(rebrand): rename desktop internal protocol scheme t3:// → bcode://`

Implements plan doc Task 2.3.

- `apps/desktop/src/main.ts:108`: `const DESKTOP_SCHEME = "bcode";`.
- Grep `apps/desktop` for any remaining `t3://` — expect zero.
- `.docs/scripts.md:23`: `t3://app/index.html` → `bcode://app/index.html`.
- Verify: `bun run test:desktop-smoke`.

### 8. Commit: `feat(rebrand): rename COM/bundle ID + artifactName to bcode`

Implements plan doc Task 2.4.

- `apps/desktop/src/main.ts:116`: `APP_USER_MODEL_ID` → `com.berkayorhan.bcode` / `.dev`.
- `apps/desktop/scripts/electron-launcher.mjs:22`: `APP_BUNDLE_ID` → `com.berkayorhan.bcode` / `.dev`.
- `scripts/build-desktop-artifact.ts:521`: `appId: "com.berkayorhan.bcode"`.
- `scripts/build-desktop-artifact.ts:523`: `artifactName: "BCode-${version}-${arch}.${ext}"`.
- Verify grep: `grep -rn 'com.t3tools' apps scripts --include='*.ts' --include='*.mjs'` → zero.

### 9. Commit: `feat(rebrand): rename Linux desktop entry + WM class`

Implements plan doc Task 2.5.

- `apps/desktop/src/main.ts:117-118`: `LINUX_DESKTOP_ENTRY_NAME = "bcode.desktop"` / `"bcode-dev.desktop"`; `LINUX_WM_CLASS = "bcode"` / `"bcode-dev"`.
- `scripts/build-desktop-artifact.ts:552, 557`: `executableName: "bcode"`, `StartupWMClass: "bcode"`.
- Verify grep: `grep -rn 't3code' apps/desktop scripts --include='*.ts' --include='*.mjs'` → only the `USER_DATA_DIR_NAME = "t3code"` line remains (deliberate keep, per `AGENTS.md:25`).

### 10. Commit: `test(rebrand): update release smoke + update-manifest test fixtures`

**Not in the plan doc** — surfaced during exploration.

- `scripts/merge-mac-update-manifests.test.ts`: ~8 occurrences of `T3-Code-` artifact-name fixtures → `BCode-`.
- `scripts/release-smoke.ts`: ~8 occurrences → `BCode-`.
- Verify: `bun run --cwd scripts test -- merge-mac-update-manifests`, `bun run release:smoke` if feasible locally.

### 11. Commit: `docs(rebrand): rewrite current docs for BCODE_*, bcode://, ~/.bcode`

Implements plan doc Task 2.6.

- Bulk replace `T3CODE_` → `BCODE_` in: `docs/observability.md` (30 refs), `docs/release.md` (2), `docs/perf-benchmarks.md` (7), `.docs/quick-start.md` (1), `.docs/scripts.md` (5 remaining), `CLAUDE.md` (if any post-PR-#1 refs linger), `KEYBINDINGS.md`, `.claude/rules/debugging.md`.
- Add a deprecation-window note at the top of `docs/observability.md` § Configuration (new `> Note:` block calling out the v0.0.20 removal).
- Flip `~/.t3` → `~/.bcode` in `KEYBINDINGS.md`, `.claude/rules/debugging.md`, `docs/observability.md`. Runtime home dir still reads `.t3` until PR #3 — this is a forward-pointing doc update only.
- **Do not** touch historical files under `docs/superpowers/plans/`, `docs/superpowers/specs/`, `.plans/`, or existing commit messages.

### 12. Optional fmt-fixup commit

Run `bun run fmt` after commit 11. If it rewrites anything, one trailing `style: fmt fixup` commit; otherwise skip.

---

## Verification gates

Before pushing:

1. `bun run fmt` — zero diff after.
2. `bun run lint` — green.
3. `bun run typecheck` — green.
4. `bun run test` — pre-existing ~23 Windows failures expected; compare against baseline on `main` to confirm no new regressions.
5. `bun run --cwd apps/web test:browser` — green.
6. `bun run test:desktop-smoke` — green (validates protocol rename).
7. `grep -rn 'T3CODE_\|com\.t3tools\|t3://\|t3code\.desktop\|__T3CODE_' apps packages scripts turbo.json --include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.md' --include='*.json'` — remaining hits should be (a) the shim's own `T3CODE_` references in `packages/shared/src/env.ts`, (b) `USER_DATA_DIR_NAME` line in `main.ts`, (c) legacy-read paths in `scripts/dev-runner.ts` / `scripts/build-desktop-artifact.ts` / `electron-launcher.mjs` / turbo.json globalEnv, (d) cli-config regression test fixture.

## PR creation

```
gh pr create --repo Berkay2002/bcode --base main --head rebrand/env-protocol-com \
  --title "feat(rebrand): env T3CODE_* → BCODE_*, protocol t3:// → bcode://, COM/Linux IDs" \
  --body "$(...)"
```

PR body must disclose:

- The 23 pre-existing Windows test failures (identical to `main`, not introduced here).
- The deliberate keeps (`USER_DATA_DIR_NAME`, `LEGACY_*`, home/localStorage deferred to PR #3).
- The shim deprecation window (v0.0.19 accepts both; v0.0.20 drops legacy).
- The turbo globalEnv having both prefixes during the shim window.
- Test fixture updates in `scripts/merge-mac-update-manifests.test.ts` / `release-smoke.ts` added beyond the plan doc.

After push: dispatch `pr-review-toolkit:code-reviewer` + `pr-review-toolkit:comment-analyzer` manually (Copilot will likely exceed its file-count limit). Wait for CI, address, squash-merge.
