import * as Path from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOME_DIR_NAME,
  LEGACY_T3_HOME_DIR_NAME,
  resolveBcodeHome,
  resolveLegacyT3Home,
  USER_DATA_MIGRATION_MARKER,
} from "./paths";

describe("paths constants", () => {
  it("exposes the canonical BCode home directory name", () => {
    expect(HOME_DIR_NAME).toBe(".bcode");
  });

  it("exposes the legacy T3 home directory name for migration lookup", () => {
    expect(LEGACY_T3_HOME_DIR_NAME).toBe(".t3");
  });

  it("exposes the migration marker filename", () => {
    expect(USER_DATA_MIGRATION_MARKER).toBe(".bcode-migration-v1-complete");
  });

  it("resolves ~/.bcode relative to a given home", () => {
    const home = Path.join("/", "home", "alice");
    expect(resolveBcodeHome(home)).toBe(Path.join(home, ".bcode"));
  });

  it("resolves ~/.t3 relative to a given home", () => {
    const home = Path.join("/", "home", "alice");
    expect(resolveLegacyT3Home(home)).toBe(Path.join(home, ".t3"));
  });
});
