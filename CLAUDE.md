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

## Development Workflow

This project uses Superpowers skills for structured development. See `.claude/rules/workflow.md` for the full flow: brainstorm → plan → implement → verify → review. Path-scoped rules in `.claude/rules/` add context for server (`apps/server/`, `packages/shared/`) and UI (`apps/web/`, `apps/desktop/`) work.

## Naming Convention (Rebrand Rules)

- **User-facing** (UI labels, dialogs, error messages): use **"BCode"**
- **Internal identifiers** (env vars `T3CODE_*`, protocol `t3://`, home `~/.t3`, packages `@t3tools/*`, npm `t3`/`npx t3`, COM `com.t3tools.t3code`, localStorage `t3code:*`): keep as-is for upstream compatibility

## Architecture & Detailed Guidelines

@AGENTS.md

## Internal Docs

- `@docs/effect-fn-checklist.md` — Effect.fn refactor patterns
- `@docs/observability.md` — Logging, tracing, OTLP export
- `@docs/perf-benchmarks.md` — Perf regression harness
- `@docs/release.md` — Release workflow for desktop builds
