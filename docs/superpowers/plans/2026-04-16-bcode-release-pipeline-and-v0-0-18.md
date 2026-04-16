# BCode Release Pipeline + v0.0.18 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `release.yml` fork-owned (no upstream coupling), publish the server CLI as `@berkayorhan/bcode` on npm, then cut `v0.0.18` of the BCode desktop app + npm CLI from `Berkay2002/bcode`.

**Architecture:** Five sequential phases on branch `release-pipeline-fork`. Phase A is one PR that rewires the workflow and the npm package identity. Phase B is one-time operator setup outside the repo. Phases C–E are tag-driven release validation that happen on `main` after the PR merges.

**Tech Stack:** GitHub Actions, npm OIDC trusted publishing, electron-builder via `scripts/build-desktop-artifact.ts`, `apps/server/scripts/cli.ts` (Effect-based publish CLI), Bun + Turbo monorepo.

**Source spec:** [`docs/superpowers/specs/2026-04-16-bcode-release-and-deep-rebrand-design.md`](../specs/2026-04-16-bcode-release-and-deep-rebrand-design.md) (sub-project 1).

**Discovery findings (already pinned down by reading the codebase):**

- There is **no** `electron-builder.yml`. The build config is generated at runtime in `scripts/build-desktop-artifact.ts` (`createBuildConfig`, lines 512–575).
- `apps/server/scripts/cli.ts` does **not** hardcode the package name `"t3"` — it reads `serverPackageJson.name` (line 212), so renaming `apps/server/package.json` is sufficient.
- The desktop publish target (`scripts/build-desktop-artifact.ts:464–480`) already resolves `T3CODE_DESKTOP_UPDATE_REPOSITORY → GITHUB_REPOSITORY`. CI sets `GITHUB_REPOSITORY=Berkay2002/bcode` automatically, so no change is needed for auto-update routing in this sub-project.
- The Turbo filter `--filter=t3` appears in 4 root scripts in `package.json`, 1 line in `release.yml`, and 2 lines in `scripts/dev-runner.ts` — all need updating after the rename.
- The bundle ID `com.t3tools.t3code` is **intentionally untouched** in this plan (changes in sub-project 2).
- `git remote -v` confirms `origin` already points at `https://github.com/Berkay2002/bcode.git`. `upstream` points at `pingdotgg/t3code` — never push there.

---

## Phase A: Workflow + npm wiring (PR `release-pipeline-fork`)

Goal: One PR that lands all code/config changes needed for a fork-owned release. After merge, no tag has been pushed yet.

### Task A1: Create branch from `main`

**Files:** none (git only)

- [ ] **Step 1: Verify clean working tree on `main`**

```bash
git status
git rev-parse --abbrev-ref HEAD
```

Expected: working tree clean, on `main`.

- [ ] **Step 2: Pull latest from origin**

```bash
git pull origin main --ff-only
```

Expected: already up to date or fast-forward succeeds.

- [ ] **Step 3: Create and check out the branch**

```bash
git checkout -b release-pipeline-fork
```

Expected: switched to a new branch.

### Task A2: Drop nightly + schedule from `release.yml`

**Files:**

- Modify: `.github/workflows/release.yml`

The workflow currently has `schedule:` cron, a `workflow_dispatch` `channel` input that can be `nightly`, and a branch in the `Resolve release version` step that handles nightly tagging/dist-tag selection. Strip all of it. Keep tag-pushed stable releases plus a `workflow_dispatch` escape hatch (stable only).

- [ ] **Step 1: Edit triggers — remove `schedule` and the `channel` input**

Open `.github/workflows/release.yml`. Replace lines 1–22 (the `name`, `on:`, and `workflow_dispatch.inputs` blocks) with:

```yaml
name: Release

on:
  push:
    tags:
      - "v*.*.*"
  workflow_dispatch:
    inputs:
      version:
        description: "Release version (for example 1.2.3 or v1.2.3)"
        required: true
        type: string
```

Keep the `permissions:` block immediately below unchanged.

- [ ] **Step 2: Simplify the `Resolve release version` step**

In the `preflight` job, find the `id: release_meta` step (currently lines ~63–115). Replace the whole `env:` + `run:` body with a stable-only version. Replace the existing block:

```yaml
- id: release_meta
  name: Resolve release version
  shell: bash
  env:
    DISPATCH_CHANNEL: ${{ github.event.inputs.channel }}
    DISPATCH_VERSION: ${{ github.event.inputs.version }}
    NIGHTLY_DATE: ${{ github.run_started_at }}
    NIGHTLY_SHA: ${{ github.sha }}
    NIGHTLY_RUN_NUMBER: ${{ github.run_number }}
  run: |
    if [[ "${GITHUB_EVENT_NAME}" == "schedule" || ( "${GITHUB_EVENT_NAME}" == "workflow_dispatch" && "${DISPATCH_CHANNEL:-stable}" == "nightly" ) ]]; then
      nightly_date="$(date -u -d "$NIGHTLY_DATE" +%Y%m%d)"

      node scripts/resolve-nightly-release.ts \
        --date "$nightly_date" \
        --run-number "$NIGHTLY_RUN_NUMBER" \
        --sha "$NIGHTLY_SHA" \
        --github-output

      echo "release_channel=nightly" >> "$GITHUB_OUTPUT"
      echo "cli_dist_tag=nightly" >> "$GITHUB_OUTPUT"
      echo "is_prerelease=true" >> "$GITHUB_OUTPUT"
      echo "make_latest=false" >> "$GITHUB_OUTPUT"
    else
      if [[ "${GITHUB_EVENT_NAME}" == "workflow_dispatch" ]]; then
        raw="${DISPATCH_VERSION}"
        if [[ -z "$raw" ]]; then
          echo "workflow_dispatch stable releases require the version input." >&2
          exit 1
        fi
      else
        raw="${GITHUB_REF_NAME}"
      fi

      version="${raw#v}"
      if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
        echo "Invalid release version: $raw" >&2
        exit 1
      fi

      echo "release_channel=stable" >> "$GITHUB_OUTPUT"
      echo "version=$version" >> "$GITHUB_OUTPUT"
      echo "tag=v$version" >> "$GITHUB_OUTPUT"
      echo "name=BCode v$version" >> "$GITHUB_OUTPUT"
      echo "cli_dist_tag=latest" >> "$GITHUB_OUTPUT"
      if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "is_prerelease=false" >> "$GITHUB_OUTPUT"
        echo "make_latest=true" >> "$GITHUB_OUTPUT"
      else
        echo "is_prerelease=true" >> "$GITHUB_OUTPUT"
        echo "make_latest=false" >> "$GITHUB_OUTPUT"
      fi
    fi
```

with this:

```yaml
- id: release_meta
  name: Resolve release version
  shell: bash
  env:
    DISPATCH_VERSION: ${{ github.event.inputs.version }}
  run: |
    if [[ "${GITHUB_EVENT_NAME}" == "workflow_dispatch" ]]; then
      raw="${DISPATCH_VERSION}"
      if [[ -z "$raw" ]]; then
        echo "workflow_dispatch requires the version input." >&2
        exit 1
      fi
    else
      raw="${GITHUB_REF_NAME}"
    fi

    version="${raw#v}"
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
      echo "Invalid release version: $raw" >&2
      exit 1
    fi

    echo "release_channel=stable" >> "$GITHUB_OUTPUT"
    echo "version=$version" >> "$GITHUB_OUTPUT"
    echo "tag=v$version" >> "$GITHUB_OUTPUT"
    echo "name=BCode v$version" >> "$GITHUB_OUTPUT"
    echo "cli_dist_tag=latest" >> "$GITHUB_OUTPUT"
    if [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      echo "is_prerelease=false" >> "$GITHUB_OUTPUT"
      echo "make_latest=true" >> "$GITHUB_OUTPUT"
    else
      echo "is_prerelease=true" >> "$GITHUB_OUTPUT"
      echo "make_latest=false" >> "$GITHUB_OUTPUT"
    fi
```

- [ ] **Step 3: Verify the rest of the workflow still references valid outputs**

The `preflight` job still exposes `release_channel`, `version`, `tag`, `release_name`, `cli_dist_tag`, `is_prerelease`, `make_latest`, and `previous_tag`. Confirm by skimming downstream jobs (`build`, `publish_cli`, `release`, `finalize`). The `finalize` job has `if: needs.preflight.outputs.release_channel == 'stable'` — this still works because we always emit `release_channel=stable` now. Don't change it; the conditional becomes effectively always-true, which is intentional.

- [ ] **Step 4: Verify nothing else references the deleted nightly script**

```bash
grep -RIn "resolve-nightly-release" .github scripts apps packages
```

Expected: zero matches in `.github/workflows/`. `scripts/resolve-nightly-release.ts` and its test file may still be referenced from nowhere — leave them on disk (deleting unused scripts is out of scope for this plan).

### Task A3: Rename the npm package to `@berkayorhan/bcode`

**Files:**

- Modify: `apps/server/package.json`

- [ ] **Step 1: Update `name`, `bin`, and add `publishConfig`**

In `apps/server/package.json`, change lines 2 and 10–12. Replace:

```json
{
  "name": "t3",
  "version": "0.0.17",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/pingdotgg/t3code",
    "directory": "apps/server"
  },
  "bin": {
    "t3": "./dist/bin.mjs"
  },
```

with:

```json
{
  "name": "@berkayorhan/bcode",
  "version": "0.0.17",
  "license": "MIT",
  "publishConfig": {
    "access": "public"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/Berkay2002/bcode",
    "directory": "apps/server"
  },
  "bin": {
    "bcode": "./dist/bin.mjs"
  },
```

Leave every other field (`scripts`, `dependencies`, `devDependencies`, `engines`, etc.) as-is.

- [ ] **Step 2: Confirm the publish CLI picks up the rename automatically**

Skim `apps/server/scripts/cli.ts` lines 210–225. Confirm `pkg.name = serverPackageJson.name` and `pkg.bin = serverPackageJson.bin` — they read from the file, so no script edit is required.

```bash
grep -n '"t3"' apps/server/scripts/cli.ts
```

Expected: zero matches.

### Task A4: Replace `--filter=t3` with `--filter=@berkayorhan/bcode` everywhere

**Files:**

- Modify: `package.json` (root, 4 lines)
- Modify: `.github/workflows/release.yml` (1 line)
- Modify: `scripts/dev-runner.ts` (2 lines)

Turbo filters resolve against the workspace package `name`. Renaming the package without updating these breaks `bun run start`, `bun run build:desktop`, `bun run dev`, `bun run dev:server`, `bun run test:perf:web`, `bun run perf:open:build`, and the `Build CLI package` step in CI.

- [ ] **Step 1: Update root `package.json` filters**

Open `package.json`. In the `scripts` section, change:

```json
    "start": "turbo run start --filter=t3",
```

to:

```json
    "start": "turbo run start --filter=@berkayorhan/bcode",
```

And:

```json
    "build:desktop": "turbo run build --filter=@t3tools/desktop --filter=t3",
```

to:

```json
    "build:desktop": "turbo run build --filter=@t3tools/desktop --filter=@berkayorhan/bcode",
```

And:

```json
    "test:perf:web": "turbo run build --filter=@t3tools/web && turbo run build --filter=t3 && cd apps/web && bun run test:perf",
```

to:

```json
    "test:perf:web": "turbo run build --filter=@t3tools/web && turbo run build --filter=@berkayorhan/bcode && cd apps/web && bun run test:perf",
```

And:

```json
    "perf:open:build": "turbo run build --filter=@t3tools/web && turbo run build --filter=t3 && node scripts/open-perf-app.ts",
```

to:

```json
    "perf:open:build": "turbo run build --filter=@t3tools/web && turbo run build --filter=@berkayorhan/bcode && node scripts/open-perf-app.ts",
```

- [ ] **Step 2: Update `release.yml` CLI build filter**

In `.github/workflows/release.yml`, find line ~311 in the `publish_cli` job:

```yaml
- name: Build CLI package
  run: bun run build --filter=@t3tools/web --filter=t3
```

Change to:

```yaml
- name: Build CLI package
  run: bun run build --filter=@t3tools/web --filter=@berkayorhan/bcode
```

- [ ] **Step 3: Update `scripts/dev-runner.ts` MODE_ARGS**

In `scripts/dev-runner.ts`, lines 23–36 contain a `MODE_ARGS` constant. Change the two `--filter=t3` occurrences:

```typescript
const MODE_ARGS = {
  dev: [
    "run",
    "dev",
    "--ui=tui",
    "--filter=@t3tools/contracts",
    "--filter=@t3tools/web",
    "--filter=@berkayorhan/bcode",
    "--parallel",
  ],
  "dev:server": ["run", "dev", "--filter=@berkayorhan/bcode"],
  "dev:web": ["run", "dev", "--filter=@t3tools/web"],
  "dev:desktop": ["run", "dev", "--filter=@t3tools/desktop", "--filter=@t3tools/web", "--parallel"],
} as const satisfies Record<string, ReadonlyArray<string>>;
```

- [ ] **Step 4: Sweep for any leftover `t3` filter references**

```bash
grep -RIn '\-\-filter=t3\b\|--filter "t3"\|--filter t3\b' .github package.json scripts apps packages
```

Expected: zero matches. Anything in `docs/superpowers/plans/` or `docs/` is historical and may stay.

### Task A5: Refresh the lockfile

**Files:**

- Modify: `bun.lock`

Renaming `apps/server/package.json` `name` field invalidates the workspace identity in the lockfile.

- [ ] **Step 1: Regenerate the lockfile**

```bash
bun install
```

Expected: `bun.lock` updated to reflect the new workspace name. Working tree should show `bun.lock` modified.

- [ ] **Step 2: Confirm no production deps changed**

```bash
git diff --stat bun.lock
```

Expected: small diff (workspace identity entries only). If `node_modules` resolution changed (transitive deps shifted), pause and inspect — that would mean an unrelated dep drift snuck in.

### Task A6: Local verification

**Files:** none

- [ ] **Step 1: Format check**

```bash
bun run fmt
```

Expected: exits 0. If files were reformatted, stage them.

- [ ] **Step 2: Lint**

```bash
bun run lint
```

Expected: exits 0.

- [ ] **Step 3: Typecheck**

```bash
bun run typecheck
```

Expected: exits 0 across all workspaces.

- [ ] **Step 4: Test**

```bash
bun run test
```

Expected: all suites pass. **Never `bun test`** — this project requires the Vitest runner via `bun run test`.

- [ ] **Step 5: Verify the dev runner still resolves the renamed package**

```bash
bun run dev:server -- --help
```

Expected: dev-runner prints usage / Effect Command help without throwing about an unknown filter. (You may also briefly start it and ctrl-C — the goal is to confirm Turbo accepts `--filter=@berkayorhan/bcode`.)

- [ ] **Step 6: Dry-run the publish script locally (no actual publish)**

```bash
bun run --cwd apps/server build
node apps/server/scripts/cli.ts publish --dry-run --tag latest --app-version 0.0.17 --verbose
```

Expected: the script logs `[cli] Resolved package.json for publish` and runs `npm publish --access public --tag latest --dry-run`. The dry-run output should show `name: @berkayorhan/bcode` and `version: 0.0.17`. No actual publish happens.

If `npm` complains about missing auth, that's expected — `--dry-run` still validates manifest assembly, which is what we care about here.

### Task A7: Commit and open the PR

**Files:** none (git/gh)

- [ ] **Step 1: Stage and commit**

```bash
git add .github/workflows/release.yml apps/server/package.json package.json scripts/dev-runner.ts bun.lock
git commit -m "$(cat <<'EOF'
chore(release): rewire pipeline for fork-owned releases

- Drop schedule + nightly logic from release.yml; tag-only + workflow_dispatch
- Rename npm package t3 -> @berkayorhan/bcode (scoped, OIDC trusted publishing)
- Rename CLI binary t3 -> bcode
- Update turbo filters (--filter=t3 -> --filter=@berkayorhan/bcode) in package.json,
  release.yml, dev-runner.ts
EOF
)"
```

Expected: commit succeeds. If a pre-commit hook fails, fix the underlying issue and create a NEW commit (do not `--amend`).

- [ ] **Step 2: Push to origin**

```bash
git push -u origin release-pipeline-fork
```

Expected: branch pushed to `Berkay2002/bcode`. **Verify push went to origin, not upstream.** `git push -u` without `origin` would still pick origin since that's the only tracked remote, but be explicit.

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "chore(release): rewire pipeline for fork-owned releases" --body "$(cat <<'EOF'
## Summary
- Drop `schedule:` cron + nightly branch from `release.yml`. Tag-only + `workflow_dispatch` (stable) escape hatch.
- Rename apps/server npm package from `t3` to `@berkayorhan/bcode` (scoped name, owned by the fork). Add `publishConfig.access: public`.
- Rename CLI binary from `t3` to `bcode` so `npx @berkayorhan/bcode` invokes `bcode`.
- Update Turbo filters (`--filter=t3` -> `--filter=@berkayorhan/bcode`) in root `package.json`, `release.yml`, and `scripts/dev-runner.ts`.

Discovery notes:
- No `electron-builder.yml` exists; build config is generated in `scripts/build-desktop-artifact.ts`. Bundle ID stays `com.t3tools.t3code` for this PR (changes in sub-project 2).
- Desktop publish target already resolves `GITHUB_REPOSITORY` (= `Berkay2002/bcode` in CI). No change needed.
- `apps/server/scripts/cli.ts` reads name from `package.json` — no hardcoded `"t3"`.

Source spec: docs/superpowers/specs/2026-04-16-bcode-release-and-deep-rebrand-design.md (sub-project 1).

## Test plan
- [x] `bun run fmt`
- [x] `bun run lint`
- [x] `bun run typecheck`
- [x] `bun run test`
- [x] `node apps/server/scripts/cli.ts publish --dry-run --verbose` — dry-run shows `name: @berkayorhan/bcode`
- [ ] CI green (preflight + 4 desktop builds + npm publish job)
- [ ] After merge: Phase B manual prerequisites, then Phase C dry-run release
EOF
)"
```

Expected: PR opened. Capture the URL.

- [ ] **Step 4: Wait for CI + Copilot review**

```bash
gh pr checks --watch
```

Expected: preflight passes; the desktop matrix builds and `publish_cli` job will run as part of the workflow only on tag push, NOT on PR — so the only PR checks are local-equivalent gates (fmt/lint/typecheck/test) plus any other PR-level workflow. Confirm green before merge.

GitHub Copilot review will run automatically on PR creation. Wait for its comments. If feedback is reasonable, address it (invoke `superpowers:receiving-code-review`).

- [ ] **Step 5: Merge to `main`**

When checks are green and review feedback is addressed, merge. Use `gh pr merge --squash --delete-branch` (or the GitHub UI). Squash-merge is consistent with the project's git conventions.

```bash
gh pr merge --squash --delete-branch
```

Expected: PR merged. Local `release-pipeline-fork` branch deleted on remote. Locally:

```bash
git checkout main
git pull origin main --ff-only
git branch -d release-pipeline-fork
```

---

## Phase B: Manual prerequisites (one-time, operator action)

These happen outside the codebase. None require a code change. Plan executor: do these between Phase A merge and Phase C dry-run. They can be done in any order, but all must be complete before any tag is pushed.

### Task B1: Enable GitHub Actions on the fork

Forks usually have Actions disabled until explicitly enabled. Without this, no workflow run will appear when you push a tag.

- [ ] **Step 1: Enable Actions via API or UI**

Either (preferred):

```bash
gh api -X PATCH repos/Berkay2002/bcode --field has_actions=true
```

Or in the UI: `https://github.com/Berkay2002/bcode/settings/actions` → "Allow all actions and reusable workflows".

- [ ] **Step 2: Verify**

```bash
gh api repos/Berkay2002/bcode --jq .has_actions
```

Expected: `true`.

### Task B2: Configure npm OIDC Trusted Publisher

OIDC means CI publishes to npm without storing a long-lived token in repo secrets. Set up the trust relationship npm-side first.

- [ ] **Step 1: On npmjs.com, create the trusted publisher entry**

Sign in to npmjs.com as the account that owns `@berkayorhan`. Navigate to Account → Packages → "Trusted Publishers" (if no package exists yet, this is at `https://www.npmjs.com/settings/<username>/trusted-publishers`). Add a new trusted publisher with:

- Provider: **GitHub Actions**
- Organization or user: **Berkay2002**
- Repository: **bcode**
- Workflow filename: **release.yml**
- Environment name: leave blank

Save.

- [ ] **Step 2: Confirm `publish_cli` workflow already requests `id-token: write`**

Skim `.github/workflows/release.yml` lines 24–26. Should contain:

```yaml
permissions:
  contents: write
  id-token: write
```

Both are at job level for the workflow. The `id-token: write` permission is required for OIDC to work. If absent, add it under the `publish_cli:` job. (Current workflow has it at workflow level, which propagates — no change needed.)

### Task B3: Stage classic-token fallback for first publish

npm OIDC only authorizes publishes for packages that **already exist**. The first publish of a new scoped package may need a classic Automation token. Have it ready, but do not use it unless Phase C fails on auth.

- [ ] **Step 1: Generate an Automation-type classic token**

On npmjs.com → Account → Access Tokens → Generate New Token → **Automation**. Copy the token. **Do not paste it anywhere persistent** — keep it only in your local shell history during the brief window you might need it.

- [ ] **Step 2: Document the recovery procedure (no action yet)**

If Phase C's `publish_cli` job fails with `403 Forbidden – PUT https://registry.npmjs.org/@berkayorhan%2fbcode` or similar OIDC auth error:

```bash
# Run from apps/server, locally:
cd apps/server
NPM_TOKEN=<paste-classic-token> npm publish --access public --tag latest
# Immediately revoke the classic token in npmjs.com UI.
```

Then re-run the failed workflow (`gh run rerun <run-id>`) — subsequent publishes will succeed via OIDC because the package now exists.

**Do not execute this step preemptively.** Only run it if Phase C fails on the publish step.

---

## Phase C: Dry-run release with throwaway tag

Goal: prove the entire pipeline works end-to-end before burning the real version number.

### Task C1: Push test tag and validate

**Files:** none (git only)

- [ ] **Step 1: Make sure local `main` matches remote**

```bash
git checkout main
git pull origin main --ff-only
git status
```

Expected: clean, up to date with `origin/main`.

- [ ] **Step 2: Verify remotes one more time**

```bash
git remote -v
```

Expected:

```
origin  https://github.com/Berkay2002/bcode.git (fetch)
origin  https://github.com/Berkay2002/bcode.git (push)
upstream  https://github.com/pingdotgg/t3code.git (fetch)
upstream  https://github.com/pingdotgg/t3code.git (push)
```

If `origin` is anything other than `Berkay2002/bcode`, **stop** and fix before tagging.

- [ ] **Step 3: Create and push the test tag**

The version `0.0.0-test.1` is a valid semver pre-release that the workflow will accept (the regex in `release_meta` allows `[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?`). It will be flagged `is_prerelease=true` automatically because it doesn't match the bare `X.Y.Z` form, so `make_latest=false` and the GitHub Release will be marked as pre-release. The npm dist-tag will still be `latest`, which is undesirable for a test — see Step 5 cleanup.

```bash
git tag v0.0.0-test.1
git push origin v0.0.0-test.1
```

Expected: tag pushed.

- [ ] **Step 4: Watch the workflow**

```bash
gh run watch
```

Or visit `https://github.com/Berkay2002/bcode/actions`. Validate:

- `preflight` passes (`bun run lint`, `typecheck`, `test`).
- `build` matrix runs four times: macOS arm64 (dmg+zip), macOS x64 (dmg+zip), Linux x64 (AppImage), Windows x64 (nsis). All four green.
- `publish_cli` succeeds (npm shows the published version).
- `release` job creates a pre-release at `https://github.com/Berkay2002/bcode/releases/tag/v0.0.0-test.1` with all installers + `latest*.yml` + `*.blockmap` files.

If `publish_cli` fails on auth, execute Task B3 Step 2 recovery, then `gh run rerun <run-id>`.

- [ ] **Step 5: Clean up the test release and revert npm dist-tag**

The test publish set `latest` on npm, which now points at `0.0.0-test.1`. We need to undo that before users can `npm install @berkayorhan/bcode` and get a test build.

```bash
# Unpublish the test version (npm allows unpublish within 72h of publish)
npm unpublish @berkayorhan/bcode@0.0.0-test.1

# Delete the GitHub release + tag
gh release delete v0.0.0-test.1 --cleanup-tag --yes --repo Berkay2002/bcode
```

Expected: `npm view @berkayorhan/bcode versions` no longer lists `0.0.0-test.1`. GitHub release is gone. Local tag may still exist:

```bash
git tag -d v0.0.0-test.1
```

If `npm unpublish` fails (>72h passed, etc.), publish a placeholder bumping the version forward, e.g. `0.0.0-test.2`, then proceed. Test publishes are cheap.

- [ ] **Step 6: Decide: pass or retry**

If everything in Step 4 was green, proceed to Phase D. If anything failed:

- Diagnose by reading the run logs (`gh run view <run-id> --log-failed`).
- Fix in a follow-up PR to `main` (do not modify the tag).
- Repeat Phase C with `v0.0.0-test.2`.

---

## Phase D: Real release `v0.0.18`

Goal: publish the real BCode v0.0.18.

### Task D1: Cut v0.0.18

**Files:** none (git only)

- [ ] **Step 1: Confirm `apps/server/package.json` `version` is `0.0.17`**

```bash
grep '"version"' apps/server/package.json
```

Expected: `"version": "0.0.17",`. The workflow's `update-release-package-versions.ts` will bump it to match the tag during the `finalize` job, then commit the bump back to `main` via the `RELEASE_APP` GitHub App. We do not bump version manually here.

- [ ] **Step 2: Confirm the `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` secrets exist on the fork**

```bash
gh secret list --repo Berkay2002/bcode
```

Expected: both `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` listed. **If they are missing**, the `finalize` job (which commits the version bump back to `main`) will fail. Two recovery options:

(a) Skip finalize for now: edit `release.yml` in a follow-up PR to gate `finalize` on secret presence, OR
(b) Bump the version manually before tagging:

```bash
node scripts/update-release-package-versions.ts 0.0.18
git add apps/server/package.json apps/desktop/package.json apps/web/package.json packages/contracts/package.json bun.lock
git commit -m "chore(release): prepare v0.0.18"
git push origin main
```

Then the `finalize` job's "no diff" early-exit kicks in and the missing secrets cause a different failure path (mint-token step). If that's also broken, simply omit/disable the finalize job. **Decide before tagging.**

- [ ] **Step 3: Create and push the real tag**

```bash
git checkout main
git pull origin main --ff-only
git tag v0.0.18
git push origin v0.0.18
```

Expected: tag pushed to `Berkay2002/bcode`.

- [ ] **Step 4: Watch the workflow**

```bash
gh run watch
```

Same expectations as Phase C Step 4. All matrix builds green; npm publish succeeds; GitHub release published as `BCode v0.0.18` (not pre-release this time, because `0.0.18` matches the bare `X.Y.Z` regex).

- [ ] **Step 5: Verify outputs**

```bash
# npm
npm view @berkayorhan/bcode version
# Expected: 0.0.18

npm view @berkayorhan/bcode dist-tags
# Expected: { latest: '0.0.18' }

# GitHub release
gh release view v0.0.18 --repo Berkay2002/bcode
# Expected: tag, name "BCode v0.0.18", artifacts list with 4 installers, blockmaps, latest*.yml

# Auto-update metadata point at the right repo
gh release download v0.0.18 --repo Berkay2002/bcode --pattern 'latest*.yml' --dir /tmp/bcode-release
cat /tmp/bcode-release/latest*.yml
# Expected: no references to pingdotgg/t3code anywhere
```

If the `finalize` job ran and committed `chore(release): prepare v0.0.18` to `main`, your local `main` is now behind:

```bash
git pull origin main --ff-only
```

---

## Phase E: Smoke test

Goal: confirm a real user (you) can install BCode and that it starts.

### Task E1: Smoke test the npm CLI

**Files:** none

- [ ] **Step 1: Install and run `--version`**

```bash
npx @berkayorhan/bcode@0.0.18 --version
```

Expected: prints `0.0.18` (or similar — the binary may print the Effect CLI banner with version 0.0.0 since `apps/server/scripts/cli.ts` sets `Command.run(cli, { version: "0.0.0" })`. The actual server `bcode` binary at `dist/bin.mjs` reads its own version from `serverPackageJson.version` baked into the bundle. If `--version` prints something other than `0.0.18`, this is a known quirk, not a release blocker — log it.)

- [ ] **Step 2: Smoke-launch the CLI (optional)**

```bash
npx @berkayorhan/bcode@0.0.18
```

Expected: server starts, prints listening URL, opens browser. Ctrl-C to stop.

### Task E2: Smoke test the Windows desktop installer

**Files:** none

- [ ] **Step 1: Download the Windows installer**

```bash
gh release download v0.0.18 --repo Berkay2002/bcode --pattern '*.exe' --dir /tmp/bcode-windows
ls /tmp/bcode-windows/
```

Expected: one `.exe` file (NSIS installer), name like `T3-Code-0.0.18-x64.exe` (artifact name still uses `T3-Code-` because that's hardcoded in `scripts/build-desktop-artifact.ts:523` — changes in sub-project 2). **Confirm filename matches expectation; if it doesn't, the build config diverged unexpectedly — investigate before user smoke-test.**

- [ ] **Step 2: Run the installer**

Double-click the `.exe` and step through the installer. Launch the app from the start menu.

Verify:

- App launches without an error dialog.
- Window title shows "BCode (Alpha)" (productName from `apps/desktop/package.json`).
- The app loads its UI (any thread/setting visible).
- File menu / About dialog mentions BCode.

- [ ] **Step 3: Decide ship/no-ship**

If the installer launches and the UI loads, sub-project 1 is **done**. If it crashes or shows obviously broken behavior, document the failure as a Phase D rollback candidate (see "Rollback" below).

- [ ] **Step 4: macOS / Linux smoke (deferred)**

Skip unless you have access to those machines. If a user reports a problem on those platforms, they can be smoke-tested then.

---

## Rollback

Bad release? Two quick options.

- [ ] **Option 1: Unpublish + recut**

Within 72h of publish:

```bash
npm unpublish @berkayorhan/bcode@0.0.18
gh release delete v0.0.18 --cleanup-tag --yes --repo Berkay2002/bcode
git tag -d v0.0.18
# Fix the issue on main, then retag with the same number (npm doesn't accept republish of unpublished version for 24h, so consider 0.0.19 instead)
```

- [ ] **Option 2: Roll forward to v0.0.19**

```bash
# Fix on main, push tag
git tag v0.0.19
git push origin v0.0.19
# Auto-update will deliver 0.0.19 to anyone who already installed 0.0.18.
```

Generally prefer Option 2 — clean forward motion, no unpublish-window pressure.

---

## Definition of Done

- `apps/server/package.json` `name` is `@berkayorhan/bcode`, `bin` is `bcode`.
- All `--filter=t3` references replaced with `--filter=@berkayorhan/bcode`.
- `release.yml` no longer has `schedule:` or nightly logic.
- PR `release-pipeline-fork` merged to `main` with green CI.
- GitHub Actions enabled on `Berkay2002/bcode`.
- npm trusted publisher configured for `@berkayorhan/bcode`.
- Phase C dry-run produced complete release artifacts (4 desktop installers + npm + auto-update metadata) at a throwaway tag, then cleaned up.
- `v0.0.18` tag pushed; `npm view @berkayorhan/bcode` returns `0.0.18`; GitHub release at `https://github.com/Berkay2002/bcode/releases/tag/v0.0.18` exists with all artifacts.
- Windows installer launches and shows the BCode UI.
- Sub-project 2 (deep identifier rebrand) is unblocked. The plan for it will be written after this one ships.

## Out of Scope (handled by sub-project 2)

- Bundle ID rename `com.t3tools.t3code` → `com.berkayorhan.bcode`.
- Workspace package scope rename `@t3tools/*` → `@bcode/*`.
- Env var rename `T3CODE_*` → `BCODE_*` and dual-read shim.
- Protocol scheme `t3` → `bcode`.
- Home dir `~/.t3` → `~/.bcode` and auto-migration.
- localStorage prefix `t3code:*` → `bcode:*`.
- Linux entry rename, artifact name rename to `BCode-*`, `productName: "BCode"` (currently "BCode (Alpha)").
- Code signing (Apple notarization, Azure Trusted Signing).

These are all in [`docs/superpowers/specs/2026-04-16-bcode-release-and-deep-rebrand-design.md`](../specs/2026-04-16-bcode-release-and-deep-rebrand-design.md) sub-project 2 and ship in v0.0.19.
