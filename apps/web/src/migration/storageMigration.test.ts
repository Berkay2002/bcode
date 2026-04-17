import { beforeEach, describe, expect, it } from "vitest";

import { runStorageMigration, STORAGE_MIGRATION_MARKER } from "./storageMigration";

class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe("runStorageMigration", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it("no-ops when marker is already set", () => {
    storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
    storage.setItem("t3code:theme", "dark");
    const result = runStorageMigration(storage);
    expect(result).toEqual({ status: "already-complete" });
    expect(storage.getItem("bcode:theme")).toBeNull();
  });

  it("copies t3code:* to bcode:* and sets marker", () => {
    storage.setItem("t3code:theme", "dark");
    storage.setItem("t3code:ui-state:v1", "{}");
    storage.setItem("unrelated-key", "x");

    const result = runStorageMigration(storage);

    expect(result.status).toBe("migrated");
    if (result.status === "migrated") {
      expect(result.keysCopied).toBe(2);
    }
    expect(storage.getItem("bcode:theme")).toBe("dark");
    expect(storage.getItem("bcode:ui-state:v1")).toBe("{}");
    expect(storage.getItem("unrelated-key")).toBe("x");
    expect(storage.getItem("t3code:theme")).toBe("dark");
    expect(storage.getItem(STORAGE_MIGRATION_MARKER)).toBe("v1");
  });

  it("does not overwrite existing bcode:* keys", () => {
    storage.setItem("t3code:theme", "dark");
    storage.setItem("bcode:theme", "light");
    const result = runStorageMigration(storage);
    expect(result.status).toBe("migrated");
    expect(storage.getItem("bcode:theme")).toBe("light");
  });

  it("returns fresh-install when no t3code:* keys exist", () => {
    const result = runStorageMigration(storage);
    expect(result).toEqual({ status: "fresh-install" });
    expect(storage.getItem(STORAGE_MIGRATION_MARKER)).toBe("v1");
  });
});
