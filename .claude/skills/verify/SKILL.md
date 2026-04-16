---
name: verify
description: Run the full CI quality gate (format, lint, typecheck, test) to verify changes before claiming work is complete.
---

Run the following commands in sequence. Stop and fix any failures before proceeding to the next step.

1. `bun run fmt` — Format all files with oxfmt
2. `bun run lint` — Lint with oxlint
3. `bun run typecheck` — TypeScript type checking
4. `bun run test` — Run Vitest test suite (NEVER use `bun test`)

Report results: which steps passed, which failed, and what needs fixing.
