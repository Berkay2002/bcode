const DEPRECATED_ENV_WARNED = new Set<string>();

export function __resetEnvDeprecationWarningsForTests(): void {
  DEPRECATED_ENV_WARNED.clear();
}

export function readEnv(
  suffix: string,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): string | undefined {
  const nextKey = `BCODE_${suffix}`;
  const legacyKey = `T3CODE_${suffix}`;

  const next = env[nextKey];
  if (next !== undefined) return next;

  const legacy = env[legacyKey];
  if (legacy !== undefined) {
    if (!DEPRECATED_ENV_WARNED.has(legacyKey)) {
      DEPRECATED_ENV_WARNED.add(legacyKey);
      console.warn(
        `[bcode] Environment variable ${legacyKey} is deprecated and will be removed in v0.0.20. Rename it to ${nextKey}.`,
      );
    }
    return legacy;
  }

  return undefined;
}
