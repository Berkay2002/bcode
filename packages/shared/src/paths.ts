import * as Path from "node:path";

export const HOME_DIR_NAME = ".bcode";
export const LEGACY_T3_HOME_DIR_NAME = ".t3";
export const USER_DATA_MIGRATION_MARKER = ".bcode-migration-v1-complete";

export function resolveBcodeHome(home: string): string {
  return Path.join(home, HOME_DIR_NAME);
}

export function resolveLegacyT3Home(home: string): string {
  return Path.join(home, LEGACY_T3_HOME_DIR_NAME);
}

/**
 * True when `baseDir` resolves to `~/.bcode` (the default home). Used to skip
 * auto-migration when the user has explicitly redirected the base dir to
 * somewhere else — otherwise we would create `~/.bcode` + marker on disk
 * despite the app never reading from it.
 */
export function isDefaultBcodeHome(baseDir: string, home: string): boolean {
  return Path.resolve(baseDir) === Path.resolve(resolveBcodeHome(home));
}
