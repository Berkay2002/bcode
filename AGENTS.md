# AGENTS.md

## Task Completion Requirements

- All of `bun fmt`, `bun lint`, and `bun typecheck` must pass before considering tasks completed.
- NEVER run `bun test`. Always use `bun run test` (runs Vitest).

## Project Snapshot

BCode is a minimal web GUI for using coding agents. Claude is the default and primary provider; Codex remains fully supported as a secondary option.

This is a fork of T3 Code (pingdotgg/t3code). Internal identifiers (package scopes `@t3tools/*`, env vars, protocol names) are kept unchanged for upstream compatibility. Only user-facing strings use the "BCode" brand.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/server`: Node.js WebSocket server. Manages provider sessions for Claude (via agent SDK) and Codex (via JSON-RPC over stdio app-server), serves the React web app, and streams structured events to the browser through WebSocket push.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index.

## Provider Architecture

BCode is Claude-first. The default provider is `claudeAgent` (configured in `packages/contracts/src/orchestration.ts`). Codex is available via the provider picker in the UI.

- Claude sessions use the Anthropic Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`).
- Codex sessions use the Codex app-server (JSON-RPC over stdio).
- Provider adapters live in `apps/server/src/provider/Layers/` (ClaudeAdapter, CodexAdapter).
- Provider registry and service orchestration in `apps/server/src/provider/Layers/ProviderRegistry.ts` and `ProviderService.ts`.

## Key Server Paths

- Provider dispatch and thread event logging: `apps/server/src/provider/Layers/ProviderService.ts`
- WebSocket server routes: `apps/server/src/ws.ts`
- Orchestration engine: `apps/server/src/orchestration/Layers/OrchestrationEngine.ts`
- Web app consumes orchestration domain events via WebSocket push on channel `orchestration.domainEvent`.

## Internal Docs

- `docs/effect-fn-checklist.md` — Effect.fn refactor pattern. Follow this when writing or refactoring Effect.js code.
- `docs/observability.md` — Logging, tracing, and OTLP export architecture.
- `docs/perf-benchmarks.md` — Local perf regression harness (browser + server latency benchmarks).
- `docs/release.md` — Release workflow for stable and nightly desktop builds.

## Reference Repos

- Upstream T3 Code: https://github.com/pingdotgg/t3code
- Open-source Codex repo: https://github.com/openai/codex
- Codex App Server docs: https://developers.openai.com/codex/sdk/#app-server
