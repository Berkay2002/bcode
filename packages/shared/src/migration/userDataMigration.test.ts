import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { USER_DATA_MIGRATION_MARKER } from "../paths";
import { runUserDataMigration } from "./userDataMigration";

function makeTempHome(): string {
  return mkdtempSync(join(tmpdir(), "bcode-migration-test-"));
}

function cleanup(home: string): void {
  rmSync(home, { recursive: true, force: true });
}

describe("userDataMigration", () => {
  it.effect("fresh install: creates .bcode and writes marker", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        const result = yield* runUserDataMigration({ homeDir: home });
        expect(result.status).toBe("fresh-install");
        expect(existsSync(join(home, ".bcode"))).toBe(true);
        expect(existsSync(join(home, ".bcode", USER_DATA_MIGRATION_MARKER))).toBe(true);
        expect(existsSync(join(home, ".t3"))).toBe(false);
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("migrate: copies files from .t3 to .bcode", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3", "userdata"), { recursive: true });
        writeFileSync(join(home, ".t3", "userdata", "settings.json"), '{"foo":1}');
        writeFileSync(join(home, ".t3", "keybindings.json"), "{}");

        const result = yield* runUserDataMigration({ homeDir: home });

        expect(result.status).toBe("migrated");
        if (result.status === "migrated") {
          expect(result.filesCopied).toBeGreaterThanOrEqual(2);
        }
        expect(readFileSync(join(home, ".bcode", "userdata", "settings.json"), "utf8")).toBe(
          '{"foo":1}',
        );
        expect(existsSync(join(home, ".bcode", "keybindings.json"))).toBe(true);
        expect(existsSync(join(home, ".t3", "userdata", "settings.json"))).toBe(true);
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("idempotent: second run is a no-op", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3"), { recursive: true });
        writeFileSync(join(home, ".t3", "a.txt"), "A");

        const first = yield* runUserDataMigration({ homeDir: home });
        expect(first.status).toBe("migrated");

        const second = yield* runUserDataMigration({ homeDir: home });
        expect(second.status).toBe("already-complete");
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );

  it.effect("resume after partial migration: does not overwrite existing destination files", () =>
    Effect.gen(function* () {
      const home = makeTempHome();
      try {
        mkdirSync(join(home, ".t3"), { recursive: true });
        writeFileSync(join(home, ".t3", "a.txt"), "A-new");
        mkdirSync(join(home, ".bcode"), { recursive: true });
        writeFileSync(join(home, ".bcode", "a.txt"), "A-old");

        const result = yield* runUserDataMigration({ homeDir: home });
        expect(result.status).toBe("migrated");
        expect(readFileSync(join(home, ".bcode", "a.txt"), "utf8")).toBe("A-old");
      } finally {
        cleanup(home);
      }
    }).pipe(Effect.provide(NodeServices.layer)),
  );
});
