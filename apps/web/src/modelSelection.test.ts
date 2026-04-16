import { describe, expect, it } from "vitest";
import type { ServerProvider } from "@t3tools/contracts";
import { initialClaudeSelection } from "./modelSelection";

function makeClaude(authType: string | undefined): ServerProvider {
  return {
    provider: "claudeAgent",
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: {
      status: "authenticated",
      ...(authType ? { type: authType } : {}),
    },
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

  it("recognizes Max plan variants", () => {
    for (const type of ["max", "maxplan", "max5", "max20", "MAX_PLAN", "Max-5"]) {
      const result = initialClaudeSelection([makeClaude(type)]);
      expect(result).toEqual({ model: "claude-opus-4-7", effort: "xhigh" });
    }
  });

  it("picks Sonnet 4.6 + medium for Pro tier", () => {
    const result = initialClaudeSelection([makeClaude("pro")]);
    expect(result).toEqual({ model: "claude-sonnet-4-6", effort: "medium" });
  });

  it("picks Sonnet 4.6 + medium for apiKey tier", () => {
    const result = initialClaudeSelection([makeClaude("apiKey")]);
    expect(result).toEqual({ model: "claude-sonnet-4-6", effort: "medium" });
  });

  it("picks Sonnet 4.6 + medium when Claude provider is absent", () => {
    const result = initialClaudeSelection([]);
    expect(result).toEqual({ model: "claude-sonnet-4-6", effort: "medium" });
  });
});
