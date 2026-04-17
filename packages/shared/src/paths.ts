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
