import { defineConfig } from "vitest/config";

// M0: plain node environment. Workerd D1 tests via @cloudflare/vitest-plugin
// (cloudflareTest) land in M4 with the real schema/auth tables — see ADR-005.
// The plugin is installed but not wired until then to keep M0 green.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/application/**/*.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85 },
    },
  },
});
