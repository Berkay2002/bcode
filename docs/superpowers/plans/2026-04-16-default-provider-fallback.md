# Default Provider Fallback — Claude-First Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app default to Claude (not Codex) on first load, and auto-switch away from unavailable providers so the user never sees a Codex error banner + GPT model when Claude is available.

**Architecture:** Fix hardcoded `"codex"` fallbacks in 3 web files and 1 server file. Enhance `resolveSelectableProvider` to consider provider health status (not just `enabled` flag), so an enabled-but-errored provider is skipped in favor of a healthy one. When no provider is healthy, keep the selected provider as-is so the error banner remains visible.

**Tech Stack:** TypeScript, React, Effect.js (server side), Vitest

---

### Task 1: Add tests for `resolveSelectableProvider`

**Files:**

- Create: `apps/web/src/providerModels.test.ts`
- Reference: `apps/web/src/providerModels.ts`
- Reference: `packages/contracts/src/server.ts` (for `ServerProvider` shape)

- [ ] **Step 1: Write failing tests for the current bug and the desired behavior**

```typescript
import { describe, expect, it } from "vitest";
import { resolveSelectableProvider } from "./providerModels";
import type { ServerProvider } from "@t3tools/contracts";

/** Minimal helper to build a ServerProvider stub for testing. */
function makeProvider(
  provider: "codex" | "claudeAgent",
  overrides: Partial<Pick<ServerProvider, "enabled" | "status">> = {},
): ServerProvider {
  return {
    provider,
    enabled: overrides.enabled ?? true,
    installed: true,
    version: "1.0.0",
    status: overrides.status ?? "ready",
    auth: { status: "authenticated" },
    checkedAt: new Date().toISOString(),
    models: [],
    slashCommands: [],
    skills: [],
  } as ServerProvider;
}

describe("resolveSelectableProvider", () => {
  it("returns claudeAgent when no provider is specified", () => {
    const providers = [makeProvider("codex"), makeProvider("claudeAgent")];
    expect(resolveSelectableProvider(providers, null)).toBe("claudeAgent");
    expect(resolveSelectableProvider(providers, undefined)).toBe("claudeAgent");
  });

  it("returns the requested provider when it is enabled and ready", () => {
    const providers = [makeProvider("codex"), makeProvider("claudeAgent")];
    expect(resolveSelectableProvider(providers, "codex")).toBe("codex");
    expect(resolveSelectableProvider(providers, "claudeAgent")).toBe("claudeAgent");
  });

  it("falls back when requested provider is disabled", () => {
    const providers = [makeProvider("codex", { enabled: false }), makeProvider("claudeAgent")];
    expect(resolveSelectableProvider(providers, "codex")).toBe("claudeAgent");
  });

  it("falls back when requested provider has error status", () => {
    const providers = [makeProvider("codex", { status: "error" }), makeProvider("claudeAgent")];
    expect(resolveSelectableProvider(providers, "codex")).toBe("claudeAgent");
  });

  it("keeps the requested provider when all providers have errors", () => {
    const providers = [
      makeProvider("codex", { status: "error" }),
      makeProvider("claudeAgent", { status: "error" }),
    ];
    // No healthy alternative — keep the requested provider so error banner is visible
    expect(resolveSelectableProvider(providers, "codex")).toBe("codex");
  });

  it("keeps the requested provider when provider list is empty", () => {
    expect(resolveSelectableProvider([], "codex")).toBe("codex");
    expect(resolveSelectableProvider([], null)).toBe("claudeAgent");
  });

  it("accepts warning status as available", () => {
    const providers = [makeProvider("codex", { status: "warning" }), makeProvider("claudeAgent")];
    // warning is not an error — provider should still be selectable
    expect(resolveSelectableProvider(providers, "codex")).toBe("codex");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- apps/web/src/providerModels.test.ts`
Expected: Several tests FAIL (the ones testing error-status fallback and the null-default)

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/web/src/providerModels.test.ts
git commit -m "test: add tests for resolveSelectableProvider default and status fallback"
```

---

### Task 2: Fix `resolveSelectableProvider` to use Claude default and respect status

**Files:**

- Modify: `apps/web/src/providerModels.ts:39-48`

- [ ] **Step 1: Update `resolveSelectableProvider` to use `DEFAULT_PROVIDER_KIND` and check status**

Replace the current function (lines 39-48) with:

```typescript
import {
  DEFAULT_MODEL_BY_PROVIDER,
  DEFAULT_PROVIDER_KIND,
  type ModelCapabilities,
  type ProviderKind,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
```

And update the function body:

```typescript
export function resolveSelectableProvider(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind | null | undefined,
): ProviderKind {
  const requested = provider ?? DEFAULT_PROVIDER_KIND;
  if (isProviderAvailable(providers, requested)) {
    return requested;
  }
  return (
    providers.find((candidate) => isProviderAvailable(providers, candidate.provider))?.provider ??
    requested
  );
}
```

Also add a helper (private to this module) that checks both `enabled` and `status`:

```typescript
function isProviderAvailable(
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
): boolean {
  const snapshot = getProviderSnapshot(providers, provider);
  if (!snapshot) return true; // Unknown provider — assume available (no data yet)
  if (!snapshot.enabled) return false;
  return snapshot.status !== "error" && snapshot.status !== "disabled";
}
```

- [ ] **Step 2: Run the tests to verify they pass**

Run: `bun run test -- apps/web/src/providerModels.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/providerModels.ts
git commit -m "fix: resolveSelectableProvider defaults to Claude and skips errored providers"
```

---

### Task 3: Fix hardcoded `"codex"` fallbacks in ChatView and ChatComposer

**Files:**

- Modify: `apps/web/src/components/ChatView.tsx:1032`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx:558`

- [ ] **Step 1: Update ChatView.tsx**

At line 1032, change:

```typescript
selectedProviderByThreadId ?? threadProvider ?? "codex",
```

to:

```typescript
selectedProviderByThreadId ?? threadProvider ?? DEFAULT_PROVIDER_KIND,
```

Add `DEFAULT_PROVIDER_KIND` to the existing import from `@t3tools/contracts` at line 1-21.

- [ ] **Step 2: Update ChatComposer.tsx**

At line 558, change:

```typescript
selectedProviderByThreadId ?? threadProvider ?? "codex",
```

to:

```typescript
selectedProviderByThreadId ?? threadProvider ?? DEFAULT_PROVIDER_KIND,
```

Add `DEFAULT_PROVIDER_KIND` to the imports from `@t3tools/contracts` in ChatComposer.tsx.

- [ ] **Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS — no type errors

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/ChatView.tsx apps/web/src/components/chat/ChatComposer.tsx
git commit -m "fix: replace hardcoded codex fallback with DEFAULT_PROVIDER_KIND in UI components"
```

---

### Task 4: Fix server-side `PROVIDER_ORDER` to be Claude-first

**Files:**

- Modify: `apps/server/src/serverSettings.ts:94`

- [ ] **Step 1: Flip the provider order**

At line 94, change:

```typescript
const PROVIDER_ORDER: readonly ProviderKind[] = ["codex", "claudeAgent"];
```

to:

```typescript
const PROVIDER_ORDER: readonly ProviderKind[] = ["claudeAgent", "codex"];
```

This ensures that when the server-side `resolveTextGenerationProvider` needs to fall back (because the persisted provider is disabled), it picks Claude first.

- [ ] **Step 2: Run typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add apps/server/src/serverSettings.ts
git commit -m "fix: server PROVIDER_ORDER prefers Claude over Codex for fallback"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full verification**

Run: `bun run fmt && bun run lint && bun run typecheck && bun run test`
Expected: All PASS

- [ ] **Step 2: Manual test**

1. Start the dev server: `bun run dev`
2. Open the web UI in a browser
3. Verify:
   - No Codex error banner appears on load
   - The model picker shows `claude-sonnet-4-6` (or user's Claude model), not `GPT-5.4`
   - Opening the provider picker shows Claude as selected
   - If Claude becomes unavailable (e.g. revoke API key), the error banner shows for Claude (not silently hidden)
   - If both providers are errored, the banner shows the current provider's error

- [ ] **Step 3: Final commit if any formatting changes**

```bash
bun run fmt
git add -A
git commit -m "chore: format"
```
