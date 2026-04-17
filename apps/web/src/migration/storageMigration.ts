export const STORAGE_MIGRATION_MARKER = "bcode:migration-v1-complete";
const LEGACY_PREFIX = "t3code:";
const NEW_PREFIX = "bcode:";

export type StorageMigrationResult =
  | { readonly status: "already-complete" }
  | { readonly status: "fresh-install" }
  | { readonly status: "migrated"; readonly keysCopied: number };

export function runStorageMigration(storage: Storage): StorageMigrationResult {
  if (storage.getItem(STORAGE_MIGRATION_MARKER) !== null) {
    return { status: "already-complete" };
  }

  const legacyKeys: Array<string> = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(LEGACY_PREFIX)) {
      legacyKeys.push(key);
    }
  }

  if (legacyKeys.length === 0) {
    storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
    return { status: "fresh-install" };
  }

  let copied = 0;
  for (const legacyKey of legacyKeys) {
    const newKey = `${NEW_PREFIX}${legacyKey.slice(LEGACY_PREFIX.length)}`;
    if (storage.getItem(newKey) !== null) continue;
    const value = storage.getItem(legacyKey);
    if (value === null) continue;
    storage.setItem(newKey, value);
    copied += 1;
  }

  storage.setItem(STORAGE_MIGRATION_MARKER, "v1");
  return { status: "migrated", keysCopied: copied };
}
