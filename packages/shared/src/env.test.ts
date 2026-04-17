import { describe, expect, it, vi } from "vitest";

import { __resetEnvDeprecationWarningsForTests, readEnv } from "./env";

describe("readEnv", () => {
  it("prefers BCODE_<suffix> over T3CODE_<suffix>", () => {
    __resetEnvDeprecationWarningsForTests();
    const env = { BCODE_HOME: "/new", T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("/new");
  });

  it("falls back to T3CODE_<suffix> and warns once per legacy key", () => {
    __resetEnvDeprecationWarningsForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("/old");
    expect(readEnv("HOME", env)).toBe("/old");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/T3CODE_HOME.*deprecated/i);
    warn.mockRestore();
  });

  it("returns undefined when neither is set", () => {
    __resetEnvDeprecationWarningsForTests();
    expect(readEnv("HOME", {})).toBeUndefined();
  });

  it("treats empty string as a set value (not fallback)", () => {
    __resetEnvDeprecationWarningsForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { BCODE_HOME: "", T3CODE_HOME: "/old" };
    expect(readEnv("HOME", env)).toBe("");
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("warns separately for different legacy keys", () => {
    __resetEnvDeprecationWarningsForTests();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { T3CODE_HOME: "/h", T3CODE_LOG_LEVEL: "Debug" };
    readEnv("HOME", env);
    readEnv("LOG_LEVEL", env);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});
