import { describe, expect, it } from "vitest";
import { resolveSelectableProvider } from "./providerModels";
import type { ServerProvider } from "@bcode/contracts";

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
