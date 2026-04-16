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
