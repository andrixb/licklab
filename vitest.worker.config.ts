import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

// Workerd tests: real D1 (local Miniflare), Worker runtime APIs.
// Run: npm run test:worker. Migrations apply from migrations/*.sql in setup.
export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-10-01",
        d1Databases: ["DB"],
      },
    }),
  ],
  test: {
    include: ["tests/worker/**/*.test.ts"],
  },
});
