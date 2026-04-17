---
description: BCode-specific debugging playbook — teaches Claude where to look and what tools to use when diagnosing server-side issues
paths:
  - apps/server/**
  - packages/shared/**
  - packages/contracts/**
---

# Debugging in BCode

When `superpowers:systematic-debugging` is invoked, use this domain knowledge to guide the diagnosis.

## First move: check the trace file

The server writes structured NDJSON spans to a local trace file — always on during dev. This is your primary diagnostic tool.

```bash
# In monorepo dev mode:
tail -f ./dev/logs/server.trace.ndjson

# In production/CLI mode:
tail -f ~/.t3/userdata/logs/server.trace.ndjson
```

Read `@docs/observability.md` for the full set of jq queries. Key ones:

- **Failed spans**: `jq -c 'select(.exit._tag != "Success")' <trace-file>`
- **Slow spans (>1s)**: `jq -c 'select(.durationMs > 1000)' <trace-file>`
- **Orchestration commands**: filter by `attributes["orchestration.command_type"]`
- **Git operations**: filter by `attributes["git.operation"]`
- **Follow one trace**: filter by `.traceId == "<id>"`

## Effect.js error patterns

Effect errors are NOT exceptions. They propagate through typed channels:

- `Failure` — expected, typed error (check the error tag and payload)
- `Defect` — unexpected crash (check the defect cause — often a thrown exception from a non-Effect dependency)
- `Interrupt` — fiber was cancelled (often normal during session teardown — check if the interrupt is actually the bug or a symptom)

When you see an Effect error, read the full cause chain — `Effect.Cause` can nest multiple failures. Don't stop at the top-level tag.

## Common symptom → starting point

| Symptom                    | Check first                                                                              |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| "Request failed"           | Failed spans in trace file → inspect `exit` and `attributes`                             |
| "UI feels slow"            | Slow spans → check child spans for sqlite, git, provider, or terminal work               |
| "Provider not responding"  | Provider turn spans → check `t3_provider_turn_duration` metric, inspect adapter logs     |
| "Command not acknowledged" | `t3_orchestration_command_ack_duration` by command type → trace the orchestration span   |
| "WebSocket disconnect"     | Check server stdout for connection lifecycle logs → look for interrupted fibers          |
| "Schema decode error"      | Contract mismatch between server and web — check `packages/contracts` for recent changes |
| "Git hook latency"         | Filter `git.operation` spans → inspect `git.hook.started`/`git.hook.finished` events     |

## Cross-package bugs

When a bug spans multiple packages:

1. Start from the **symptom** (usually web or server) and trace backward
2. Check `packages/contracts` for recent schema changes — a decode failure often means a contract changed without updating all consumers
3. Check `packages/shared` for changes to utility functions both server and web depend on
4. Verify both `bun run typecheck` passes AND runtime behavior — schema changes can be type-safe but semantically wrong

## Provider-specific debugging

- **Claude adapter** (`ClaudeAdapter`): uses `@anthropic-ai/claude-agent-sdk` — check SDK version compatibility, API error responses in span attributes
- **Codex adapter** (`CodexAdapter`): uses JSON-RPC over stdio — check process lifecycle, stdin/stdout parsing errors, app-server health
- Always test both providers when debugging shared provider infrastructure
