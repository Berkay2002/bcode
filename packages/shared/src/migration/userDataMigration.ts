import { Data, Effect, FileSystem } from "effect";

import { resolveBcodeHome, resolveLegacyT3Home, USER_DATA_MIGRATION_MARKER } from "../paths";

export class MigrationBlockedError extends Data.TaggedError("MigrationBlockedError")<{
  readonly step: "read-marker" | "ensure-dest" | "copy" | "write-marker" | "stat" | "read-dir";
  readonly path: string;
  readonly cause: unknown;
}> {}

export type MigrationResult =
  | { readonly status: "fresh-install" }
  | { readonly status: "already-complete" }
  | { readonly status: "migrated"; readonly filesCopied: number };

export interface MigrationInput {
  readonly homeDir: string;
}

export const runUserDataMigration = Effect.fn("runUserDataMigration")(function* (
  input: MigrationInput,
) {
  const fs = yield* FileSystem.FileSystem;

  const bcodeHome = resolveBcodeHome(input.homeDir);
  const legacyHome = resolveLegacyT3Home(input.homeDir);
  const marker = joinPosix(bcodeHome, USER_DATA_MIGRATION_MARKER);

  const markerExists = yield* fs
    .exists(marker)
    .pipe(
      Effect.mapError(
        (cause) => new MigrationBlockedError({ step: "read-marker", path: marker, cause }),
      ),
    );
  if (markerExists) {
    return { status: "already-complete" } satisfies MigrationResult;
  }

  yield* fs
    .makeDirectory(bcodeHome, { recursive: true })
    .pipe(
      Effect.mapError(
        (cause) => new MigrationBlockedError({ step: "ensure-dest", path: bcodeHome, cause }),
      ),
    );

  const legacyExists = yield* fs.exists(legacyHome).pipe(Effect.orElseSucceed(() => false));

  let filesCopied = 0;

  if (legacyExists) {
    filesCopied = yield* copyTree(fs, legacyHome, bcodeHome);
  }

  yield* fs
    .writeFileString(marker, "v1\n")
    .pipe(
      Effect.mapError(
        (cause) => new MigrationBlockedError({ step: "write-marker", path: marker, cause }),
      ),
    );

  if (!legacyExists) {
    return { status: "fresh-install" } satisfies MigrationResult;
  }
  return { status: "migrated", filesCopied } satisfies MigrationResult;
});

const copyTree = Effect.fn("userDataMigration.copyTree")(function* (
  fs: FileSystem.FileSystem,
  srcRoot: string,
  destRoot: string,
) {
  let copied = 0;
  const stack: Array<string> = [""];

  while (stack.length > 0) {
    const rel = stack.pop()!;
    const src = rel.length === 0 ? srcRoot : joinPosix(srcRoot, rel);
    const dest = rel.length === 0 ? destRoot : joinPosix(destRoot, rel);

    const stat = yield* fs
      .stat(src)
      .pipe(
        Effect.mapError((cause) => new MigrationBlockedError({ step: "stat", path: src, cause })),
      );
    if (stat.type === "Directory") {
      yield* fs
        .makeDirectory(dest, { recursive: true })
        .pipe(
          Effect.mapError(
            (cause) => new MigrationBlockedError({ step: "ensure-dest", path: dest, cause }),
          ),
        );
      const entries = yield* fs
        .readDirectory(src)
        .pipe(
          Effect.mapError(
            (cause) => new MigrationBlockedError({ step: "read-dir", path: src, cause }),
          ),
        );
      for (const entry of entries) {
        stack.push(rel.length === 0 ? entry : joinPosix(rel, entry));
      }
      continue;
    }

    const destExists = yield* fs.exists(dest).pipe(Effect.orElseSucceed(() => false));
    if (destExists) {
      continue;
    }

    const copyResult = yield* fs.copyFile(src, dest).pipe(
      Effect.map(() => true),
      Effect.catch((cause) => {
        if (isPermissionError(cause)) {
          return Effect.log(`[bcode] Skipping ${src} during migration: permission denied.`).pipe(
            Effect.map(() => false),
          );
        }
        return Effect.fail(new MigrationBlockedError({ step: "copy", path: src, cause }));
      }),
    );

    if (copyResult) {
      copied += 1;
    }
  }

  return copied;
});

function joinPosix(a: string, b: string): string {
  if (a.endsWith("/") || a.endsWith("\\")) {
    return `${a}${b}`;
  }
  return `${a}/${b}`;
}

function isPermissionError(cause: unknown): boolean {
  if (typeof cause !== "object" || cause === null) return false;
  const tag = (cause as { _tag?: unknown })._tag;
  if (tag !== "SystemError" && tag !== "PlatformError") return false;
  const reason = (cause as { reason?: unknown }).reason;
  return reason === "PermissionDenied";
}
