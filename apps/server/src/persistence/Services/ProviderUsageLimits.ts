import {
  IsoDateTime,
  type ProviderKind,
  ProviderKind as ProviderKindSchema,
} from "@bcode/contracts";
import { ServerProviderUsageLimits } from "@bcode/contracts";
import { Context, Option, Schema, type Stream } from "effect";
import type { Effect } from "effect";

import type { ProviderUsageLimitsRepositoryError } from "../Errors.ts";

export const StoredProviderUsageLimits = Schema.Struct({
  provider: ProviderKindSchema,
  updatedAt: IsoDateTime,
  usageLimits: ServerProviderUsageLimits,
});
export type StoredProviderUsageLimits = typeof StoredProviderUsageLimits.Type;

export const GetProviderUsageLimitsInput = Schema.Struct({
  provider: ProviderKindSchema,
});
export type GetProviderUsageLimitsInput = typeof GetProviderUsageLimitsInput.Type;

export interface ProviderUsageLimitsRepositoryShape {
  readonly getByProvider: (
    input: GetProviderUsageLimitsInput,
  ) => Effect.Effect<Option.Option<StoredProviderUsageLimits>, ProviderUsageLimitsRepositoryError>;
  readonly upsert: (input: {
    readonly provider: ProviderKind;
    readonly usageLimits: ServerProviderUsageLimits;
  }) => Effect.Effect<void, ProviderUsageLimitsRepositoryError>;
  readonly streamChanges: Stream.Stream<StoredProviderUsageLimits>;
}

export class ProviderUsageLimitsRepository extends Context.Service<
  ProviderUsageLimitsRepository,
  ProviderUsageLimitsRepositoryShape
>()("t3/persistence/Services/ProviderUsageLimits/ProviderUsageLimitsRepository") {}
