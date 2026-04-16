# BCode: Release Pipeline + Deep Rebrand

## Context

This is the natural next step after [`2026-04-16-bcode-rebrand-claude-first-design.md`](./2026-04-16-bcode-rebrand-claude-first-design.md), which completed the surface-level rebrand (display strings, Claude-first defaults) and explicitly deferred two things:

1. A fork-owned release pipeline (currently `release.yml` is wired for upstream `pingdotgg/t3code`: publishes the `t3` npm package the fork doesn't own, lacks signing secrets the fork doesn't have, and runs nightly cron the fork doesn't want).
2. The deep identifier rebrand (env vars, protocol scheme, home directory, COM/bundle ID, workspace package scope, localStorage keys).

This spec covers both. They are independent: the release pipeline can ship without the deep rebrand, and the deep rebrand can ship without changes to the release pipeline. They are bundled here because both are part of the same "diverge from upstream into a self-contained fork" arc.

**Two sub-projects, one spec, two implementation plans:**

- Sub-project 1 (Release Pipeline + first cut) → its own plan, executed first.
- Sub-project 2 (Deep Identifier Rebrand) → its own plan, executed after sub-project 1 ships.

## Goals

- Pushing `v0.0.18` to `Berkay2002/bcode` produces a working GitHub Release with installers (mac arm64+x64, linux x64, win x64) and a published `@berkayorhan/bcode` npm package, with auto-update metadata pointing at the fork.
- After the deep rebrand, all new code uses `BCODE_*` env vars, `bcode://` protocol, `~/.bcode` home, `com.berkayorhan.bcode` bundle, `@bcode/*` workspace scope, `bcode:*` localStorage. No new `T3CODE_*` references introduced.
- The existing `~/.t3` install on the developer's machine continues to work after the rebrand: launching the new build picks up sessions, conversations, and settings without manual file copying.
- `bun fmt`, `bun lint`, `bun typecheck`, `bun run test` all pass on every PR.

## Out of Scope

- Code signing (Apple notarization, Azure Trusted Signing). Workflow auto-skips when secrets are missing; can be added later by adding secrets, no code change.
- Nightly builds. Tag-only cadence.
- Public marketing site, custom icons/logos, or logo work. Existing upstream assets stay until a separate visual-identity effort.
- Any change to provider architecture, agent SDK integration, or runtime behavior.
- Removing the `T3CODE_*` env var dual-read shim. That happens in v0.0.20 (after sub-project 2 ships in v0.0.19).

---

## Sub-Project 1: Release Pipeline

### Decisions

| Question              | Decision                                                    | Rationale                                                                |
| --------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------ |
| Distribution audience | Public Claude-first alt; one user today                     | Build for one, leave room to grow                                        |
| npm package name      | `@berkayorhan/bcode` (scoped)                               | User owns `berkayorhan` namespace; scoped names are guaranteed available |
| Code signing          | Skip for now                                                | Costs $120+/yr; workflow auto-detects missing secrets and skips signing  |
| Release cadence       | Tag-only (push `v*.*.*`) + `workflow_dispatch` escape hatch | No nightly noise; user controls timing                                   |
| Auto-update target    | `Berkay2002/bcode` via `GITHUB_REPOSITORY` default          | No env var override needed; CI sets correct value automatically          |

### File Changes

**`.github/workflows/release.yml`** (edit in place — Approach A, smallest diff):

- Drop the `schedule:` trigger.
- Drop nightly logic in the `Resolve release version` step (the branch that computes `nightly-vX.Y.Z-nightly.YYYYMMDD.<run>` tags and the dist-tag selection logic for `nightly`).
- Drop nightly-specific `workflow_dispatch` inputs (`channel=nightly`).
- Keep `push: tags: ['v*.*.*']` and `workflow_dispatch:` (stable-only) triggers.
- Keep matrix builds, signing-optional logic, version-alignment script, merged-mac-manifest logic untouched.
- Net: ~50–80 lines deleted, ~10 edited.

**`apps/server/package.json`**:

- `"name": "t3"` → `"name": "@berkayorhan/bcode"`.
- Add `"publishConfig": { "access": "public" }` (required for first publish of a scoped package).
- Rename the binary entry from `t3` to `bcode` so `npx @berkayorhan/bcode` invokes a `bcode` command.

**`apps/server/scripts/cli.ts`** (publish script): if it hardcodes the package name `"t3"`, parameterize from `package.json`. Discovered during implementation; small.

**`apps/desktop/package.json` / `electron-builder.yml`** (or equivalent):

- Verify `publish.repo` resolves to `${GITHUB_REPOSITORY}` (becomes `Berkay2002/bcode` in CI). If hardcoded to `pingdotgg/t3code`, change it.
- Bundle ID stays `com.t3tools.t3code` for sub-project 1. (Sub-project 2 changes it.)

### Manual Prerequisites (One-Time)

These happen outside the codebase, in this order, before tagging:

1. **Enable Actions on the fork** — `gh api -X PATCH repos/Berkay2002/bcode --field actions=true` (or via Settings → Actions → Allow all actions). Verify with `gh api repos/Berkay2002/bcode --jq .has_actions`.
2. **Configure npm Trusted Publisher** for `@berkayorhan/bcode`:
   - Provider: GitHub Actions
   - Repository: `Berkay2002/bcode`
   - Workflow: `.github/workflows/release.yml`
3. **Fallback for first publish** if npm rejects OIDC because the package doesn't exist yet:
   - Generate Automation-type classic npm token.
   - From `apps/server`, run `npm publish --access public --tag latest` locally (publishes a placeholder version).
   - Revoke the classic token immediately.
   - Subsequent publishes use OIDC normally.

### Operational Plan: Cutting v0.0.18

**Phase A — Land workflow changes (PR)**

- Branch: `release-pipeline-fork`.
- Apply file changes above.
- Local verify: `bun fmt`, `bun lint`, `bun typecheck`, `bun run test` all green.
- Open PR, review, merge to `main`.
- No tag pushed yet.

**Phase B — Manual prerequisites** (above) are done.

**Phase C — Dry-run release**

- Push `v0.0.0-test.1` tag.
- Watch workflow. Validate: all four desktop builds succeed; GitHub Release published with installers, `latest*.yml`, `*.blockmap`; npm publish succeeds (or fails predictably per Phase B).
- On success: delete the test release and tag (`gh release delete v0.0.0-test.1 --cleanup-tag --yes --repo Berkay2002/bcode`).
- On failure: fix, retry.

**Phase D — Real release `v0.0.18`**

- Push `v0.0.18` tag.
- Same validation as Phase C.
- `npm view @berkayorhan/bcode` shows `0.0.18`.

**Phase E — Smoke test**

- Download Windows installer, install, launch, confirm app starts.
- `npx @berkayorhan/bcode --version` returns `0.0.18`.
- mac/linux smoke test deferred unless user has access.

**Rollback**: `npm unpublish @berkayorhan/bcode@0.0.18` within 72h, or publish a fixed `v0.0.19`. GitHub release: `gh release delete v0.0.18 --cleanup-tag --yes --repo Berkay2002/bcode`.

---

## Sub-Project 2: Deep Identifier Rebrand

### Decisions

| Question                                | Decision                                                             |
| --------------------------------------- | -------------------------------------------------------------------- |
| Migration strategy                      | Auto-migrate at startup (copy, don't move; idempotent; marker-gated) |
| Env var prefix                          | `T3CODE_*` → `BCODE_*` (with dual-read shim for one release)         |
| Protocol scheme                         | `t3://` → `bcode://`                                                 |
| Home directory                          | `~/.t3` → `~/.bcode`                                                 |
| COM/bundle ID                           | `com.t3tools.t3code` → `com.berkayorhan.bcode`                       |
| Workspace package scope                 | `@t3tools/*` → `@bcode/*`                                            |
| localStorage prefix                     | `t3code:*` → `bcode:*`                                               |
| Linux desktop entry                     | `t3code.desktop` → `bcode.desktop`                                   |
| `LEGACY_USER_DATA_DIR_NAME = "T3 Code"` | Leave untouched (refers to a pre-T3 rebrand path, not in scope here) |

### Three PRs in Sequence

**PR #1 — Workspace scope rename `@t3tools/*` → `@bcode/*`** (foundational, mechanical)

- Rename `name` field in every `packages/*/package.json` and any `apps/*/package.json` using `@t3tools/`.
- Find/replace every `from '@t3tools/...'` import.
- Update `tsconfig*.json` path mappings if present.
- Regenerate `bun.lock`.
- Verification: `bun install`, `bun typecheck`, `bun run test` green; `grep -r '@t3tools' .` returns nothing.
- Why first: biggest mechanical change, no behavior change. Easiest to verify.

**PR #2 — Env vars + protocol + COM ID + Linux entry** (config + small source edits)

- `T3CODE_*` → `BCODE_*` in source code, docs, `electron-builder.yml`, README.
- `t3://` → `bcode://` in protocol handler registration (`apps/desktop/src/main.ts`) and any deep-link parsing.
- `com.t3tools.t3code` → `com.berkayorhan.bcode` in `electron-builder.yml` (`appId`), Windows AppUserModelID, macOS Info.plist additions.
- `t3code.desktop` → `bcode.desktop` for Linux artifact naming.
- Add env var dual-read shim in `packages/shared/src/env.ts`: `getEnv(suffix)` reads `BCODE_${suffix}` first, falls back to `T3CODE_${suffix}` with a one-time deprecation warning. **Removed in v0.0.20.**
- Verification: app launches; deep links work; Windows installer registers as new app.

**PR #3 — Home dir + localStorage + auto-migration** (behavioral, riskiest)

- Add new constant `HOME_DIR_NAME = ".bcode"` in `packages/shared/src/paths.ts`.
- Add `LEGACY_T3_HOME_DIR_NAME = ".t3"` (used only by the migration module).
- Update all readers/writers in `apps/server` and `apps/desktop` to use `HOME_DIR_NAME`.
- Update localStorage keys in `apps/web` from `t3code:*` to `bcode:*`.
- Add migration modules (see Migration Design section).
- Verification: existing `~/.t3` install on developer's machine produces working app at `~/.bcode` with sessions intact; `~/.t3` untouched.

---

## Migration Design

Two migrations, same shape: **copy-don't-move, marker-gated, idempotent**.

### Filesystem Migration (`~/.t3` → `~/.bcode`)

**Module:** new `packages/shared/src/migration/userDataMigration.ts`. Called eagerly from server and desktop startup, before any user-data reads.

**Algorithm:**

1. If `~/.bcode/.bcode-migration-v1-complete` marker exists → skip (already migrated).
2. If `~/.t3` doesn't exist → create `~/.bcode` fresh, write marker, done (fresh install).
3. If `~/.t3` exists → recursively copy contents to `~/.bcode`, skipping any file that already exists at destination (handles partial-migration-after-crash). Never delete from `~/.t3`.
4. Write marker file last.

**Why copy not move:** fail-safe. Any corruption in the new location leaves old data untouched as a free backup. User can `rm -rf ~/.t3` once satisfied.

**Error handling:**

- Per-file permission denied: log warning, skip file, continue.
- Destination permission denied or disk full: throw `MigrationBlockedError`. Desktop surfaces as a startup dialog; server logs and exits non-zero. App does NOT start with half-migrated state.
- Marker-write failure: same handling as above.

**Idempotence:** marker check + copy-if-not-exists means double-run produces identical result. Safe to retry.

### localStorage Migration (`t3code:*` → `bcode:*`)

**Module:** new `apps/web/src/migration/storageMigration.ts`. Called synchronously at app boot, before any storage reads.

**Algorithm:**

1. If `bcode:migration-v1-complete` exists → skip.
2. For each key starting with `t3code:`, copy to `bcode:<suffix>`. Don't delete originals.
3. Set `bcode:migration-v1-complete = "true"`.

**Why both browser and desktop renderer run this:** desktop renderer has its own localStorage, separate from any browser install. Same code, two execution contexts, both safe due to idempotence.

### Env Var Dual-Read Shim (PR #2, not migration)

Helper in `packages/shared/src/env.ts`:

```ts
function getEnv(suffix: string): string | undefined {
  const next = process.env[`BCODE_${suffix}`];
  if (next !== undefined) return next;
  const legacy = process.env[`T3CODE_${suffix}`];
  if (legacy !== undefined) {
    warnDeprecatedEnvOnce(`T3CODE_${suffix}`);
  }
  return legacy;
}
```

Removed entirely in v0.0.20. Bounded compatibility window.

### Constants & Legacy References

Existing `LEGACY_USER_DATA_DIR_NAME = "T3 Code"` is for an _older_ pre-T3 rebrand and stays untouched. We add two new constants for the t3→bcode migration:

- `HOME_DIR_NAME = ".bcode"` — new canonical path.
- `LEGACY_T3_HOME_DIR_NAME = ".t3"` — used only by the migration module.

### Migration Testing

- Unit tests (Vitest with mocked `fs` via `memfs` or equivalent): empty-home case, existing-`.t3` case, partial-migration-resume case, permission-error case, marker-already-set case.
- Manual test on developer's real machine: install v0.0.19 build once, verify sessions visible, `~/.t3` intact, `~/.bcode` populated, second launch fast (marker skip works).
- No real-filesystem CI test — too fragile.

---

## Risks & Rollback

### Sub-Project 1

**R1. npm OIDC rejects first publish for unclaimed scoped name.**
Detection: workflow fails at `npm publish` with auth error.
Recovery: Phase B fallback — one-time classic-token publish from local, then re-run.
Cost: ~10 min manual work, no released state corrupted.

**R2. Desktop matrix build fails on one platform** (e.g. Windows tries to sign even though we said unsigned).
Detection: workflow shows red on one matrix cell.
Recovery: workflow already auto-skips signing when secrets missing; if not, fix the conditional and re-tag.
Cost: delete failed release + tag, push new tag.

**R3. `electron-builder` publish config still hardcoded to `pingdotgg/t3code`.**
Detection: GitHub release publishes to wrong repo, or auto-update metadata points at upstream.
Recovery: edit `electron-builder.yml` `publish.repo` to `${env.GITHUB_REPOSITORY}` (or hardcode `Berkay2002/bcode`), re-tag.
Cost: one re-release cycle.

**R4. Actions disabled on the fork at tag-push time.**
Detection: tag pushed, no workflow run appears.
Recovery: enable Actions in repo settings, delete tag, re-push (or trigger via `workflow_dispatch`).
Mitigation: in Phase B prerequisites — handled before any tag.

### Sub-Project 2

**R5. Workspace scope rename PR breaks an import we missed.**
Detection: `bun typecheck` fails locally or in CI.
Recovery: grep for any remaining `@t3tools` reference, fix, re-run. PR is purely additive/mechanical, easy `git revert`.
Cost: bounded — typecheck catches it before merge.

**R6. Migration copies a corrupted `~/.t3` and the new app misreads it.**
Detection: app starts but sessions look broken.
Recovery: `rm -rf ~/.bcode/.bcode-migration-v1-complete` to retry, or `rm -rf ~/.bcode` to start fresh. Old `~/.t3` untouched.
Cost: low — escape hatch is well-defined and old data preserved.

**R7. Migration runs partially, marker not written, app crashes.**
Detection: next launch re-runs migration, copy-if-not-exists logic resumes safely.
Recovery: automatic on retry. No manual intervention.

**R8. Env var dual-read fallback masks a config typo.**
Detection: deprecation warning in logs; user sees expected behavior despite using old name.
Recovery: log spam is the signal; fix `.env`. Removed in v0.0.20 so masking window is bounded.

**R9. COM/bundle ID change makes the new app appear as a fresh install** (lost taskbar pin, fresh OS-level permissions, fresh Finder favorites).
Detection: expected behavior — the cost of identity change.
Recovery: not recoverable; this is the price of bundle-ID rename.
Mitigation: documented in v0.0.19 release notes so user knows what to expect.

**R10. Auto-update from v0.0.18 to v0.0.19 breaks because bundle ID changed.**
Detection: `electron-updater` may refuse to install over a different bundle ID.
Recovery: manual download + install of v0.0.19 once. Subsequent updates work normally.
Mitigation: documented in release notes; consider holding bundle-ID rename for a major version bump if pain is high in practice.

### Cross-Cutting

**R11. Wrong remote pushed to.** All commits/tags go to `Berkay2002/bcode`, never `pingdotgg/t3code`.
Mitigation: `git push origin` (origin = fork). `upstream` is read-only by convention. Verify `git remote -v` before any tag.

**R12. Secrets leakage if classic npm token used.** Token must never appear in repo, workflow, commit history, or release notes.
Mitigation: use only locally during one-shot publish; revoke immediately after.

---

## Verification Summary

**Sub-project 1 (release pipeline):**

- Workflow PR merges with all local checks green.
- Phase C dry-run produces complete release artifacts (4 desktop installers + npm + auto-update metadata).
- `v0.0.18` release exists at `https://github.com/Berkay2002/bcode/releases/tag/v0.0.18` with all artifacts.
- `npm view @berkayorhan/bcode` returns `0.0.18`.
- Smoke-tested install on at least one platform.

**Sub-project 2 (deep rebrand):**

- PR #1: `bun typecheck` and `bun run test` green; zero `@t3tools` references remain in source/config (specs and historical docs may still reference the old name).
- PR #2: app launches; `bcode://` deep links route correctly; Windows installer registers under new bundle ID; deprecation warning fires when only `T3CODE_*` env is set.
- PR #3: developer's existing `~/.t3` install picks up sessions in `~/.bcode`; second launch skips migration (marker check); `~/.t3` untouched on disk.

---

## Implementation Plans

This spec produces two implementation plans:

1. `docs/superpowers/plans/2026-04-16-bcode-release-pipeline-and-v0-0-18.md`
2. `docs/superpowers/plans/2026-04-16-bcode-deep-identifier-rebrand.md`

Plan 1 is executed first. Plan 2 begins after `v0.0.18` ships and validates the pipeline.
