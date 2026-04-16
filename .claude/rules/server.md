---
description: Server-side development guidelines (Effect.js, providers, orchestration)
paths:
  - apps/server/**
  - packages/shared/**
---

# Server Development

## Effect.js code
- Read `@docs/effect-fn-checklist.md` before writing or refactoring Effect.fn code
- Prefer TDD for Effect services and layers — invoke `superpowers:test-driven-development` for new services
- Effect code is highly testable by design; write the test first to clarify the expected behavior

## Provider changes
- Changes to provider adapters (`apps/server/src/provider/Layers/`) affect Claude and Codex sessions — always brainstorm and plan first
- Test with both providers when modifying shared provider infrastructure

## Shared package
- `packages/shared` uses explicit subpath exports — no barrel index
- Changes here affect both server and web — plan accordingly, verify both consumers
