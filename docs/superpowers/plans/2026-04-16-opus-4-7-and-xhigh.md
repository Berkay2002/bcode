# Opus 4.7 + xhigh Effort Level Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Claude Opus 4.7 alongside Opus 4.6, add the new `xhigh` effort level (Opus-4.7-exclusive), and make the default Claude model/effort tier-aware: Max-subscription users get Opus 4.7 + xhigh; Pro / API-key / unknown tiers get Sonnet 4.6 + medium.

**Architecture:**

- Contracts: add `xhigh` to `CLAUDE_CODE_EFFORT_OPTIONS`, add `claude-opus-4-7` slug + aliases.
- Server Claude provider: add Opus 4.7 to `BUILT_IN_MODELS` with an effort list that includes `xhigh`; leave Opus 4.6 and Sonnet 4.6 unchanged (so `resolveEffort` silently downgrades `xhigh` to `high` on those models — no new code needed).
- Claude adapter: `xhigh` is passed through to the SDK (not prompt-injected like `ultrathink`).
- Tier-aware default selection: new pure helper `defaultClaudeSelectionForAuth(auth)` consumed where `DEFAULT_MODEL_BY_PROVIDER.claudeAgent` is used for fresh defaults. The persisted-selection path is untouched; this only affects first-load / reset.

**Tech Stack:** TypeScript, Effect Schema, React, Vitest

**SDK bump (confirmed required):** `@anthropic-ai/claude-agent-sdk` must move from `^0.2.77` to `^0.2.111`. Opus 4.7 is only supported on 0.2.111. The SDK's exported `EffortLevel` type does NOT include `xhigh` as of 0.2.111 — we type-cast at the call site. Behavior changes between 0.2.77 and 0.2.111 that need verification in Task 3: `session_state_changed` is now opt-in via `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1` (0.2.83), `sandbox.failIfUnavailable` defaults to `true` when sandbox is enabled (0.2.91), `options.env` overlays `process.env` rather than replacing it (0.2.111).

**Out of scope (follow-up plan):** The Anthropic legal / acceptable-use docs say third-party Agent-SDK apps "should use API key authentication" and OAuth is "exclusively for ordinary use of Claude Code and other native Anthropic applications." BCode today passes through the user's local `claude` CLI OAuth token, which is ambiguous under that policy. A separate plan will address: a first-class API-key auth path, an in-app informational banner when OAuth is detected, and documentation pointing users to the API-key flow. This plan does NOT gate Opus 4.7 support on resolving that question.

---

### Task 1: Contracts — add `xhigh` effort and `claude-opus-4-7` model slug + aliases

**Files:**

- Modify: `packages/contracts/src/model.ts`

- [ ] **Step 1: Add xhigh to the Claude effort list and register the Opus 4.7 slug**

At `packages/contracts/src/model.ts:7`, change:

```typescript
export const CLAUDE_CODE_EFFORT_OPTIONS = ["low", "medium", "high", "max", "ultrathink"] as const;
```

to:

```typescript
export const CLAUDE_CODE_EFFORT_OPTIONS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultrathink",
] as const;
```

At `packages/contracts/src/model.ts:76-89` (inside `MODEL_SLUG_ALIASES_BY_PROVIDER.claudeAgent`), add Opus 4.7 alias entries **above** the existing `opus` aliases:

```typescript
claudeAgent: {
  "opus-4.7": "claude-opus-4-7",
  "claude-opus-4.7": "claude-opus-4-7",
  "claude-opus-4-7-20260416": "claude-opus-4-7",
  opus: "claude-opus-4-7", // `opus` now points to 4.7 (latest Opus)
  "opus-4.6": "claude-opus-4-6",
  "claude-opus-4.6": "claude-opus-4-6",
  "claude-opus-4-6-20251117": "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  "sonnet-4.6": "claude-sonnet-4-6",
  "claude-sonnet-4.6": "claude-sonnet-4-6",
  "claude-sonnet-4-6-20251117": "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5",
  "haiku-4.5": "claude-haiku-4-5",
  "claude-haiku-4.5": "claude-haiku-4-5",
  "claude-haiku-4-5-20251001": "claude-haiku-4-5",
},
```

Note: the `opus` bare alias now resolves to `claude-opus-4-7`. This matches the "latest" semantic Anthropic uses in other aliases.

- [ ] **Step 2: Run contracts tests**

Run: `bun run test --filter=@t3tools/contracts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/model.ts
git commit -m "feat(contracts): add claude-opus-4-7 slug and xhigh effort level"
```

---

### Task 2: Server provider — register Opus 4.7 with xhigh capability

**Files:**

- Modify: `apps/server/src/provider/Layers/ClaudeProvider.ts:46-100`

- [ ] **Step 1: Add Opus 4.7 as the first entry in BUILT_IN_MODELS**

At `apps/server/src/provider/Layers/ClaudeProvider.ts:46`, prepend a new entry for Opus 4.7. The result should look like:

```typescript
const BUILT_IN_MODELS: ReadonlyArray<ServerProviderModel> = [
  {
    slug: "claude-opus-4-7",
    name: "Claude Opus 4.7",
    isCustom: false,
    capabilities: {
      reasoningEffortLevels: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High", isDefault: true },
        { value: "xhigh", label: "XHigh" },
        { value: "max", label: "Max" },
        { value: "ultrathink", label: "Ultrathink" },
      ],
      supportsFastMode: true,
      supportsThinkingToggle: false,
      contextWindowOptions: [
        { value: "200k", label: "200k", isDefault: true },
        { value: "1m", label: "1M" },
      ],
      promptInjectedEffortLevels: ["ultrathink"],
    } satisfies ModelCapabilities,
  },
  {
    slug: "claude-opus-4-6",
    name: "Claude Opus 4.6",
    // ...unchanged...
  },
  // ...rest unchanged...
];
```

Leave Opus 4.6, Sonnet 4.6, and Haiku 4.5 entries untouched. Because `xhigh` is absent from their `reasoningEffortLevels`, the shared `resolveEffort` helper in `packages/shared/src/model.ts` will silently downgrade any `xhigh` input to `"high"` on those models (the model default).

- [ ] **Step 2: Run server tests**

Run: `bun run test --filter=t3`
Expected: PASS (existing tests should be unaffected since Opus 4.7 is additive)

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/provider/Layers/ClaudeProvider.ts
git commit -m "feat(server): register Claude Opus 4.7 with xhigh effort capability"
```

---

### Task 3: Bump Claude Agent SDK to 0.2.111 and cast `xhigh` past the typed API

**Files:**

- Modify: `apps/server/package.json`
- Modify: `scripts/package.json`
- Modify: `bun.lock` (regenerated via `bun install`)
- Modify: `apps/server/src/provider/Layers/ClaudeAdapter.ts:224-231` (cast only)

**Rationale:** Research confirmed Opus 4.7 requires `@anthropic-ai/claude-agent-sdk@0.2.111` specifically — no earlier version supports it. The SDK's exported `EffortLevel` type is still `'low' | 'medium' | 'high' | 'max'` as of 0.2.111, so `xhigh` works at runtime but needs a type cast. Additionally, 0.2.83+ made `session_state_changed` opt-in via env var, 0.2.91+ changed `sandbox.failIfUnavailable` default, and 0.2.111 overlays rather than replaces `process.env` when `options.env` is set — verify none of these affect our usage.

- [ ] **Step 1: Bump the dependency in both workspaces**

Edit `apps/server/package.json` and `scripts/package.json`. Change:

```json
"@anthropic-ai/claude-agent-sdk": "^0.2.77"
```

to:

```json
"@anthropic-ai/claude-agent-sdk": "^0.2.111"
```

Then regenerate the lockfile:

```bash
bun install
```

- [ ] **Step 2: Grep for SDK-behavior-change regression risks**

Run each of these and inspect the hits — if any exist, confirm the new SDK behavior is what we want (or adjust):

```bash
grep -rn "session_state_changed" apps/ packages/
grep -rn "failIfUnavailable\|sandbox" apps/server/src/ | grep -v test
grep -rn "options.env\|options: {.*env:" apps/server/src/provider/Layers/ClaudeAdapter.ts apps/server/src/provider/Layers/ClaudeProvider.ts
```

Expected: no hits, OR hits that are already compatible with the new behavior. If a hit needs code changes, address it in this task before moving on.

- [ ] **Step 3: Add the `xhigh` type cast in `getEffectiveClaudeCodeEffort`**

The SDK's `EffortLevel` type (as of 0.2.111) does not include `'xhigh'`, but the runtime accepts it for Opus 4.7. Update `apps/server/src/provider/Layers/ClaudeAdapter.ts:224-231`:

```typescript
function getEffectiveClaudeCodeEffort(
  effort: ClaudeCodeEffort | null | undefined,
): Exclude<ClaudeCodeEffort, "ultrathink"> | null {
  if (!effort) return null;
  return effort === "ultrathink" ? null : effort;
}
```

If typecheck fails at the SDK call sites (lines 2954 and 3052) because the return type now includes `"xhigh"` but the SDK option expects its narrower `EffortLevel`, add a localized cast at the call site:

```typescript
...(effectiveEffort ? { effort: effectiveEffort as "low" | "medium" | "high" | "max" } : {}),
```

Leave a one-line comment above each cast: `// xhigh is accepted at runtime on Opus 4.7 but absent from the SDK's EffortLevel union`.

Prefer the cast at the call site (two places) over widening the helper's return type — it keeps the narrowing for `ultrathink` explicit.

- [ ] **Step 4: Typecheck and run the adapter tests**

Run:

```bash
bun run typecheck
bun run test --filter=t3 -- ClaudeAdapter
```

Expected:

- typecheck: no NEW errors (pre-existing errors in `composerDraftStore.test.ts`, `SettingsPanels.browser.tsx`, `MessagesTimeline.test.tsx` remain)
- ClaudeAdapter tests: PASS

- [ ] **Step 5: Runtime smoke test with Opus 4.7 + xhigh**

Start the dev server, open the web UI, select Opus 4.7, set effort to xhigh, and send a short prompt. Expected: the request succeeds and reasoning tokens are used. If the SDK rejects `xhigh` at runtime (unexpected based on research), open an issue and fall back to prompt-injecting xhigh like ultrathink.

- [ ] **Step 6: Commit**

```bash
git add apps/server/package.json scripts/package.json bun.lock apps/server/src/provider/Layers/ClaudeAdapter.ts
git commit -m "chore(deps): bump claude-agent-sdk to 0.2.111 for Opus 4.7 + xhigh support"
```

---

### Task 4: Add a tier-aware default Claude selection helper

**Files:**

- Create: `packages/shared/src/claudeTierDefaults.ts`
- Create: `packages/shared/src/claudeTierDefaults.test.ts`
- Modify: `packages/shared/package.json` (add subpath export)
- Reference: `packages/contracts/src/server.ts` (`ServerProviderAuth` shape)

- [ ] **Step 1: Write the helper tests first**

Create `packages/shared/src/claudeTierDefaults.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { defaultClaudeSelectionForAuth } from "./claudeTierDefaults";

describe("defaultClaudeSelectionForAuth", () => {
  it("returns Opus 4.7 + xhigh for Max subscription", () => {
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "max" })).toEqual({
      model: "claude-opus-4-7",
      effort: "xhigh",
    });
  });

  it("recognizes all Max variants", () => {
    for (const type of ["max", "maxplan", "max5", "max20"]) {
      expect(defaultClaudeSelectionForAuth({ status: "authenticated", type })).toEqual({
        model: "claude-opus-4-7",
        effort: "xhigh",
      });
    }
  });

  it("returns Sonnet 4.6 + medium for Pro subscription", () => {
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "pro" })).toEqual({
      model: "claude-sonnet-4-6",
      effort: "medium",
    });
  });

  it("returns Sonnet 4.6 + medium for apiKey auth", () => {
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "apiKey" })).toEqual({
      model: "claude-sonnet-4-6",
      effort: "medium",
    });
  });

  it("returns Sonnet 4.6 + medium for unknown/missing tier", () => {
    expect(defaultClaudeSelectionForAuth({ status: "authenticated" })).toEqual({
      model: "claude-sonnet-4-6",
      effort: "medium",
    });
    expect(defaultClaudeSelectionForAuth({ status: "unauthenticated" })).toEqual({
      model: "claude-sonnet-4-6",
      effort: "medium",
    });
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "enterprise" })).toEqual({
      model: "claude-sonnet-4-6",
      effort: "medium",
    });
  });

  it("tolerates mixed-case and punctuation in tier strings", () => {
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "MAX_PLAN" })).toEqual({
      model: "claude-opus-4-7",
      effort: "xhigh",
    });
    expect(defaultClaudeSelectionForAuth({ status: "authenticated", type: "Max-5" })).toEqual({
      model: "claude-opus-4-7",
      effort: "xhigh",
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `bun run test --filter=@t3tools/shared -- claudeTierDefaults`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the helper**

Create `packages/shared/src/claudeTierDefaults.ts`:

```typescript
import type { ClaudeCodeEffort } from "@t3tools/contracts";

export type ClaudeTierDefault = {
  readonly model: string;
  readonly effort: ClaudeCodeEffort;
};

const MAX_TIER_DEFAULT: ClaudeTierDefault = {
  model: "claude-opus-4-7",
  effort: "xhigh",
};

const FALLBACK_DEFAULT: ClaudeTierDefault = {
  model: "claude-sonnet-4-6",
  effort: "medium",
};

function normalizeTier(value: string | undefined): string | undefined {
  return value?.toLowerCase().replace(/[\s_-]+/g, "");
}

const MAX_TIER_NORMALIZED = new Set(["max", "maxplan", "max5", "max20"]);

export function defaultClaudeSelectionForAuth(auth: {
  readonly status: "unknown" | "authenticated" | "unauthenticated";
  readonly type?: string | undefined;
}): ClaudeTierDefault {
  if (auth.status !== "authenticated") return FALLBACK_DEFAULT;
  const normalized = normalizeTier(auth.type);
  if (normalized && MAX_TIER_NORMALIZED.has(normalized)) return MAX_TIER_DEFAULT;
  return FALLBACK_DEFAULT;
}
```

- [ ] **Step 4: Add the subpath export to the shared package**

In `packages/shared/package.json`, add to the `"exports"` block:

```json
"./claudeTierDefaults": {
  "types": "./src/claudeTierDefaults.ts",
  "default": "./src/claudeTierDefaults.ts"
}
```

(Match the format of existing subpath exports like `./git` or `./model`.)

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `bun run test --filter=@t3tools/shared -- claudeTierDefaults`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/claudeTierDefaults.ts packages/shared/src/claudeTierDefaults.test.ts packages/shared/package.json
git commit -m "feat(shared): add tier-aware default Claude selection helper"
```

---

### Task 5: Wire the tier-aware default into first-load selection

**Files:**

- Modify: `apps/web/src/modelSelection.ts` (or whichever file computes the initial `ModelSelection`)
- Reference: `apps/web/src/providerModels.ts`
- Reference: `packages/contracts/src/server.ts` (for `ServerProviderAuth` shape)

This task threads the new helper into the place where a fresh Claude default is materialized. Persisted selections MUST NOT be overridden — we only change first-run / reset behavior.

- [ ] **Step 1: Locate the first-load default path**

Run:

```bash
grep -n "claudeAgent" apps/web/src/modelSelection.ts
```

Identify the call site(s) where `DEFAULT_MODEL_BY_PROVIDER.claudeAgent` is read as the initial model for a new thread (with no persisted selection). There's typically one in `resolveAppModelSelection` or similar.

- [ ] **Step 2: Write a failing test for the tier-aware initial selection**

Add a test to `apps/web/src/modelSelection.test.ts` (create the file if it doesn't exist). The test should:

1. Build a `providers` array containing a Claude provider with `auth: { status: "authenticated", type: "max" }`.
2. Call the initial-selection code path with NO persisted selection.
3. Assert the result is `{ provider: "claudeAgent", model: "claude-opus-4-7", options: { effort: "xhigh" } }`.

Mirror the pattern with `type: "pro"` and assert `{ model: "claude-sonnet-4-6", options: { effort: "medium" } }`.

Example skeleton — adjust the imported function name to whatever Step 1 identified:

```typescript
import { describe, expect, it } from "vitest";
import { initialClaudeSelection } from "./modelSelection";
import type { ServerProvider } from "@t3tools/contracts";

function makeClaude(authType: string | undefined): ServerProvider {
  return {
    provider: "claudeAgent",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated", ...(authType ? { type: authType } : {}) },
    checkedAt: new Date().toISOString(),
    models: [],
    slashCommands: [],
    skills: [],
  } as ServerProvider;
}

describe("initialClaudeSelection", () => {
  it("picks Opus 4.7 + xhigh for Max tier", () => {
    const result = initialClaudeSelection([makeClaude("max")]);
    expect(result).toEqual({ model: "claude-opus-4-7", effort: "xhigh" });
  });

  it("picks Sonnet 4.6 + medium for Pro tier", () => {
    const result = initialClaudeSelection([makeClaude("pro")]);
    expect(result).toEqual({ model: "claude-sonnet-4-6", effort: "medium" });
  });

  it("picks Sonnet 4.6 + medium for apiKey tier", () => {
    const result = initialClaudeSelection([makeClaude("apiKey")]);
    expect(result).toEqual({ model: "claude-sonnet-4-6", effort: "medium" });
  });
});
```

- [ ] **Step 3: Implement `initialClaudeSelection` in `apps/web/src/modelSelection.ts`**

Add at the bottom of the file:

```typescript
import { defaultClaudeSelectionForAuth } from "@t3tools/shared/claudeTierDefaults";

export function initialClaudeSelection(providers: ReadonlyArray<ServerProvider>): {
  readonly model: string;
  readonly effort: ClaudeCodeEffort;
} {
  const claude = providers.find((p) => p.provider === "claudeAgent");
  const { model, effort } = defaultClaudeSelectionForAuth(claude?.auth ?? { status: "unknown" });
  return { model, effort };
}
```

Import `ClaudeCodeEffort` and `ServerProvider` from `@t3tools/contracts` at the top of the file if they aren't already imported.

- [ ] **Step 4: Call `initialClaudeSelection` from the existing default-selection code path**

Inside `resolveAppModelSelection` (or wherever Step 1 identified), when the provider resolves to `"claudeAgent"` AND no persisted `selectedModel` exists, replace:

```typescript
getDefaultServerModel(providers, provider);
```

with:

```typescript
initialClaudeSelection(providers).model;
```

And wire the effort into the `options` object returned alongside the model. If there's no existing plumbing for the effort in this path, add it — the effort still lands in `ClaudeModelOptions.effort`.

- [ ] **Step 5: Run the new tests**

Run: `bun run test --filter=@t3tools/web -- modelSelection`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modelSelection.ts apps/web/src/modelSelection.test.ts
git commit -m "feat(web): use tier-aware default Claude selection on first load"
```

---

### Task 6: Full verification and manual test

- [ ] **Step 1: Run full verification**

Run: `bun run fmt && bun run lint && bun run typecheck && bun run test`
Expected:

- fmt: formats any newly added files
- lint: no new errors (pre-existing warnings tolerated)
- typecheck: no new errors
- test: all pass, including new tests from Tasks 1, 4, 5

- [ ] **Step 2: Manual verification**

Start dev server: `bun run dev`

Test matrix in the browser:

1. Fresh install (clear localStorage), logged in with a **Max** subscription → verify picker shows Opus 4.7 + xhigh on load.
2. Fresh install, logged in with **Pro** → verify Sonnet 4.6 + medium.
3. Fresh install, authed via **API key** → verify Sonnet 4.6 + medium.
4. With Opus 4.7 + xhigh selected, switch to Sonnet 4.6 → effort should display as **high** (silent downgrade via `resolveEffort`).
5. Persisted selection of Opus 4.6 still loads as Opus 4.6 (not auto-upgraded to 4.7). Only the bare `opus` alias points to 4.7.

- [ ] **Step 3: Final formatting commit if needed**

```bash
bun run fmt
git add -A
git commit -m "chore: format" || echo "nothing to commit"
```
