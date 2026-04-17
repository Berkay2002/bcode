import type { ClaudeAgentEffort } from "@bcode/contracts";

export type ClaudeTierDefault = {
  readonly model: string;
  readonly effort: ClaudeAgentEffort;
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
