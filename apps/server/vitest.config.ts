import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import baseConfig from "../../vitest.config";

// Perf benchmarks are wall-clock sensitive and unreliable on shared CI hardware.
// `bun run test:perf` opts back in by setting VITEST_PERF=1.
const includePerf = process.env.VITEST_PERF === "1";

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      // The server suite exercises sqlite, git, temp worktrees, and orchestration
      // runtimes heavily. Running files in parallel introduces load-sensitive flakes.
      fileParallelism: false,
      // Server integration tests exercise sqlite, git, and orchestration together.
      // Under package-wide parallel runs they regularly exceed the default 15s budget.
      testTimeout: 60_000,
      hookTimeout: 60_000,
      exclude: includePerf
        ? [...configDefaults.exclude]
        : [...configDefaults.exclude, "integration/perf/**"],
    },
  }),
);
