# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
bun install              # Install dependencies
bun run dev              # Run all dev services (server + web + desktop)
bun run dev:server       # Server only
bun run dev:web          # Web only
bun run fmt              # Format (oxfmt)
bun run lint             # Lint (oxlint)
bun run typecheck        # TypeCheck
bun run test             # Run tests (Vitest) — NEVER use `bun test`
```

## Before Completing Any Task

All three must pass: `bun run fmt`, `bun run lint`, `bun run typecheck`.

## CI Pipeline

CI runs on all PRs and pushes to main. The full pipeline (beyond local checks):

1. Format check (`bun run fmt:check`)
2. Lint (`bun run lint`)
3. Typecheck (`bun run typecheck`)
4. Unit tests (`bun run test`)
5. Browser tests (`bun run --cwd apps/web test:browser`) — Playwright/Chromium
6. Desktop build + preload bundle validation

Local `/verify` covers steps 1–4. If your change touches UI, run the browser tests locally too before claiming CI will pass.

To trigger CI manually without pushing: `gh workflow run ci.yml --ref <branch>` then `gh run watch` to stream results.

PRs are auto-labeled by size (XS through XXL based on changed lines, excluding test-only files). Keep PRs in the XS–M range when possible.

## Development Workflow

This project uses Superpowers skills for structured development. See `.claude/rules/workflow.md` for the full flow: brainstorm → plan → implement → verify → review. Path-scoped rules in `.claude/rules/` add context for server (`apps/server/`, `packages/shared/`) and UI (`apps/web/`, `apps/desktop/`) work.

## Git Conventions

Commit messages use conventional commits, lowercase after prefix:

- Format: `type: description` (e.g., `fix: resolve session leak on reconnect`)
- Types: `feat`, `fix`, `chore`, `perf`, `test`, `docs`, `refactor`
- PR squash-merges get the PR number appended automatically: `fix: resolve session leak (#42)`

For PRs, follow the template in `@.github/pull_request_template.md` — keep PRs small and focused, explain what changed and why, include before/after screenshots for UI changes.

## Naming Convention (Rebrand Rules)

- **User-facing** (UI labels, dialogs, error messages): use **"BCode"**
- **Internal identifiers** (`BCODE_*` env vars, `bcode://` internal scheme, `~/.bcode` home, `@bcode/*` packages, `npx @berkayorhan/bcode` CLI, `com.berkayorhan.bcode` COM, `bcode:*` localStorage): post-rebrand state. `T3CODE_*` env is still accepted with a deprecation warning through v0.0.19; `~/.t3` and `t3code:*` localStorage are auto-migrated on first launch of v0.0.19.

## Architecture & Detailed Guidelines

@AGENTS.md

## Internal Docs

- `@docs/effect-fn-checklist.md` — Effect.fn refactor patterns
- `@docs/observability.md` — Logging, tracing, OTLP export
- `@docs/perf-benchmarks.md` — Perf regression harness
- `@docs/release.md` — Release workflow for desktop builds
