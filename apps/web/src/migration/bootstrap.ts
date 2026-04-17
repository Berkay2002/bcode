import { runStorageMigration } from "./storageMigration";

// Guard against the rare browser environments where `storage.getItem` /
// `setItem` can throw (Safari private mode, quota-exhausted, sandboxed
// iframes). A throw here would short-circuit module init and prevent the app
// from booting — migration is best-effort, so swallow and warn instead.
if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
  try {
    runStorageMigration(window.localStorage);
  } catch (error) {
    console.warn(
      "[bcode] localStorage migration skipped; storage is unavailable or blocked.",
      error,
    );
  }
}
