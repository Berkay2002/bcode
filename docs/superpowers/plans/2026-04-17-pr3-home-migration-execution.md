# PR #3 Execution Plan — Home Directory + localStorage Auto-Migration (v0.0.19 final)

> Working name `atomic-finding-reef`. Rename to `2026-04-17-pr3-home-migration-execution.md` after approval if the user wants the date-slug convention.

## Context

BCode is mid-rebrand from T3 Code. PR #1 (merged `d91a66ea`) renamed the workspace scope `@t3tools/*` → `@bcode/*`. PR #2 (merged `de84bc75`) renamed env vars `T3CODE_*` → `BCODE_*` (with dual-read shim), the desktop protocol `t3://` → `bcode://`, the COM identifier, the Linux desktop entry, and a pile of internal constants.

PR #3 is the last v0.0.19 piece: flip the runtime home directory from `~/.t3` to `~/.bcode` and localStorage keys from `t3code:*` to `bcode:*`, behind **idempotent, marker-gated auto-migration** that runs on first launch. Existing installs must not lose user data. The old `~/.t3` is copied-not-moved — never mutated or deleted — so a crash mid-migration or a downgrade to a pre-v0.0.19 build both leave the user in a recoverable state.

Deferred to v0.0.20: removing the env-var dual-read shim, removing the dual-write of `T3CODE_PROJECT_ROOT`/`T3CODE_WORKTREE_PATH` in `projectScripts.ts`, removing `T3CODE_*` entries from `turbo.json` globalEnv, renaming electron's `USER_DATA_DIR_NAME = "t3code"` subdir. Those stay out of PR #3.

The full task-level spec with TDD test bodies already exists at `docs/superpowers/plans/2026-04-17-bcode-deep-identifier-rebrand.md` §§ "PR #3: Home Directory + localStorage + Auto-Migration" (lines 1156–2049). **This execution plan does not restate the steps — it references the source plan by task number and records current-state drift plus execution order.**

## Drift from the original plan (verified 2026-04-17)

The Task 3.3 / Task 3.4 references drifted slightly because PR #2 already renamed several identifiers. The original plan is internally consistent but some line numbers and identifier names lag behind main. Corrections:

| Plan item                                      | Plan says                           | Actual on main                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task 3.3 Step 1 — cli.ts `resolveBaseDir` call | line 276                            | `apps/server/src/cli.ts:324` (inside `Effect.gen`, right before `deriveServerPaths`; `env.bcodeHome` already wired at line 328)                                                                                                                                            |
| Task 3.4 Step 2 — desktop `BASE_DIR`           | line 103                            | `apps/desktop/src/main.ts:104`                                                                                                                                                                                                                                             |
| Task 3.3 Step 3/4 — dev-runner constant        | called `DEFAULT_T3_HOME` at line 19 | already renamed to `DEFAULT_BCODE_HOME` at `scripts/dev-runner.ts:19–21`; still returns `".t3"` on line 20. No rename needed — only the literal flips.                                                                                                                     |
| Task 3.7 inventory — `uiStateStore.ts`         | lines 4–11                          | lines 4–15 also contain additional legacy `t3code:renderer-state:v3–v8` and `codething:*` keys. Flip the `bcode:` ones, leave the legacy-read list alone (it's how zustand migrates from older versions; those reads survive via the storage migration copying them over). |
| Task 3.8 fixtures — `.t3/worktrees/`           | 5 files                             | Single remaining runtime-fixture match is `apps/web/src/worktreeCleanup.test.ts:89`. The other files listed (BranchToolbar, Sidebar, etc.) may have already been updated or use different path shapes — re-grep at execution time and fix whatever hits come back.         |
| Task 3.7 keybindings fixtures                  | 3 files                             | Confirmed exact: `ChatView.browser.tsx:157`, `KeybindingsToast.browser.tsx:70`, `SettingsPanels.browser.tsx:198`.                                                                                                                                                          |

The original plan's implementation code for `paths.ts`, `userDataMigration.ts`, `storageMigration.ts`, and all Effect `FileSystem` method calls (`exists`, `makeDirectory`, `stat`, `readDirectory`, `copyFile`, `writeFileString`) is **confirmed compatible** with the `@effect/platform` version in use — these methods are all actively called elsewhere in the repo.

## Execution order

Eleven commits on branch `rebrand/home-migration` (one per task plus one commit for the ancillary deprecation-window docs note). TDD-first for the two new modules; the flip commits go in after both migration modules land and are tested, so no intermediate state exists where the new home dir is read before migration runs.

1. **Task 3.1** — `packages/shared/src/paths.ts` + test + package.json export. Plan §1162.
2. **Task 3.2** — `packages/shared/src/migration/userDataMigration.ts` + test + package.json export. Plan §1260. Verify Effect `FileSystem` method shape matches what's already used in the server tests — don't invent new method names.
3. **Task 3.3** — wire `runUserDataMigration` into server CLI (`cli.ts:324`, inside the existing `Effect.gen` before `resolveBaseDir`), desktop (`main.ts`, sync wrapper before `BASE_DIR` is computed on line 104), and dev-runner (`dev-runner.ts`, before `DEFAULT_BCODE_HOME` is first consumed at line 163). Plan §1552.
4. **Task 3.4** — flip the three runtime-reader literals to import `HOME_DIR_NAME` from `@bcode/shared/paths`: `os-jank.ts:72`, `main.ts:104`, `dev-runner.ts:20`. Update `scripts/dev-runner.test.ts:50,66` assertions. Plan §1653.
5. **Task 3.5** — `apps/web/src/migration/storageMigration.ts` + test. Plan §1729. Pure DOM-Storage contract, no Effect.
6. **Task 3.6** — wire `runStorageMigration(window.localStorage)` into `apps/web/src/main.tsx` **before line 17** (`getRouter(history)`), since routes can carry zustand loaders that hydrate storage eagerly. Safe slot: right after the `./env` import on line 9. Plan §1882. Manual DevTools verification per plan Step 3.
7. **Task 3.7 part A** — flip `t3code:*` literals to `bcode:*` in the 9 web source files. Regrep `t3code:` after edits; zero hits in `apps/web/src` except inside the storage-migration module's legacy-prefix const and any test that asserts migration behavior. Plan §1932.
8. **Task 3.7 part B** — flip `.t3code-keybindings.json` → `.bcode-keybindings.json` in the three fixture files listed above. Plan §1956.
9. **Task 3.8** — update test fixture paths `/.t3/worktrees/` → `/.bcode/worktrees/` and `/.t3/logs` → `/.bcode/logs`. Use a fresh grep at execution time since the inventory may have shifted; don't trust the plan's list verbatim. Plan §1986.
10. **Task 3.9** — cross-cutting verification: `bun run fmt && bun run lint && bun run typecheck && bun run test`. Disclose the ~23 pre-existing `apps/server` test failures in the PR body (per handoff — identical on main).
11. **Docs** — short addition to `AGENTS.md` §§ "Naming Convention" noting that `~/.t3` → `~/.bcode` and `t3code:*` → `bcode:*` are runtime-flipped in v0.0.19 and auto-migrated on first launch. Keep the "deliberate keeps" list unchanged. No rename of `CLAUDE.md` / `AGENTS.md`.

## Critical files to modify

**Create:**

- `packages/shared/src/paths.ts` + `.test.ts`
- `packages/shared/src/migration/userDataMigration.ts` + `.test.ts`
- `apps/web/src/migration/storageMigration.ts` + `.test.ts`

**Modify:**

- `packages/shared/package.json` (add two subpath exports, flat shape matching existing entries)
- `apps/server/src/cli.ts` (insertion at line 324)
- `apps/server/src/os-jank.ts` (line 72 flip)
- `apps/desktop/src/main.ts` (migration call before line 104, literal flip at 104)
- `scripts/dev-runner.ts` (migration call + literal flip at line 20)
- `scripts/dev-runner.test.ts` (assertion update around lines 50, 66)
- `apps/web/src/main.tsx` (migration call before line 17)
- 9 web files for localStorage key flips (see plan §1937–1946)
- 3 web files for keybindings fixture flips (see plan §1956–1958)
- `apps/web/src/worktreeCleanup.test.ts` + any other test-fixture hits discovered by regrep
- `AGENTS.md` (naming-convention note)

**Do NOT modify** (per `AGENTS.md` §§ 23–26):

- `USER_DATA_DIR_NAME = "t3code"` / `"t3code-dev"` in `apps/desktop/src/main.ts:120` — electron userData subdir, rename would break existing installs' window state.
- `LEGACY_USER_DATA_DIR_NAME = "T3 Code (Alpha)"` / `"T3 Code (Dev)"` — pre-T3 migration target.
- `packages/shared/src/env.ts` dual-read shim, `bcodeConfigWithFallback` helpers — v0.0.20 scope.
- `packages/shared/src/projectScripts.ts` dual-write — v0.0.20 scope.
- `turbo.json` globalEnv `T3CODE_*` entries — v0.0.20 scope.

## Existing utilities to reuse

- `@bcode/shared/env` `readEnv` — already wraps env access with the `BCODE_*`/`T3CODE_*` fallback. Do not reimplement env reading.
- `@bcode/shared/path` (already exported) — generic path helpers, distinct from the new `./paths` module which exports BCode-specific constants.
- Existing `Effect.fn` pattern from `@docs/effect-fn-checklist.md` — the user-data migration is Effect-based and should follow this pattern.
- `NodeFileSystem.layer` from `@effect/platform-node` — already used across the server codebase to provide `FileSystem.FileSystem`. The desktop sync-wrapper uses `Effect.runSync` with this layer.

## Verification

After each task commit, the per-task `bun run --cwd <pkg> test -- <name>` command from the source plan must pass.

After all 11 commits, run in order:

1. `bun run fmt` — zero diffs expected.
2. `bun run lint` — zero new violations.
3. `bun run typecheck` — clean. Watch for stale `T3CODE_*`-referencing types; there shouldn't be any.
4. `bun run test` — expect the documented ~23 pre-existing `apps/server` failures (Manager.test.ts etc.) to remain. Any _new_ red test that isn't one of those is a regression — stop and diagnose.
5. `bun run --cwd apps/web test:browser` — Playwright/Chromium. Required because Task 3.6/3.7 touch rendering paths.
6. Manual DevTools check from Task 3.6 Step 3 (set `t3code:theme = "dark"`, hard-reload, observe `bcode:theme` appears, marker written, old key untouched).
7. Manual desktop smoke: build the desktop app on a temp home with a seeded `~/.t3/userdata/settings.json`, first launch, confirm `~/.bcode/userdata/settings.json` exists and `~/.bcode/.bcode-migration-v1-complete` marker is written. Second launch should be a silent no-op.

## Workflow

- Branch: `rebrand/home-migration`, cut from clean `main`. Branches, not worktrees.
- PR: `gh pr create --repo Berkay2002/bcode` — the default `gh` remote is upstream `pingdotgg/t3code` which is wrong.
- Commits: conventional, lowercase after prefix, one per task. Split matches the 11-item list above.
- `git add` specific files, never `-A` (user runs parallel work in this repo).
- PR body: summarize migration contract, list the two new modules, call out the idempotency + copy-not-move invariants, disclose the pre-existing server test failures, link the source plan by line range.
- Copilot review triggers automatically on PR creation — expect 5–10 comments and plan for one iteration.
- Merge via squash once CI is green and Copilot feedback is addressed.

## Risks and mitigations

- **Migration runs twice concurrently** (e.g. desktop + CLI both starting): marker-gated idempotency + copy-not-overwrite means both converge to the same end state. No lock needed.
- **Partial migration from interrupted run**: the "skip if destination exists" rule ensures resumption is safe. The marker is written _last_, so a crash mid-copy leaves no marker and the next run retries — also safe because the second run skips anything already copied.
- **Effect `FileSystem` method rename across @effect/platform versions**: Explore-verified all six methods used are currently active in this repo. If a future platform upgrade renames one, the migration test will fail fast.
- **Web boot order**: inserting `runStorageMigration` before `getRouter(history)` is required because route loaders may touch zustand stores that read localStorage at module init. The plan's Step 3 manual verification catches this.
- **Desktop migration throws before Effect runtime is ready**: the sync wrapper catches all exceptions and logs-and-continues. Startup is never blocked on migration failure — the old `~/.t3` is untouched, so the user can always recover by running an older build.

## Acceptance criteria

- New install: `~/.bcode/` and `~/.bcode/.bcode-migration-v1-complete` exist after first launch; no `~/.t3/` touched; `bcode:migration-v1-complete` in localStorage after first web load.
- Upgrade from v0.0.18: contents of `~/.t3/` are copied into `~/.bcode/`; `~/.t3/` is untouched; `t3code:*` localStorage entries are copied to `bcode:*`; `t3code:*` entries are not deleted; subsequent launches are silent no-ops.
- Re-running after partial migration does not overwrite existing `~/.bcode/` files.
- All three runtime `.t3` literals (`os-jank.ts:72`, `main.ts:104`, `dev-runner.ts:20`) now read `HOME_DIR_NAME` from `@bcode/shared/paths`.
- `grep -rn 't3code:' apps/web/src` returns zero hits outside the storage-migration module's `LEGACY_PREFIX` and migration-behavior tests.
- `bun run fmt && bun run lint && bun run typecheck` clean; `bun run test` shows only the pre-existing server failures; browser tests green.
