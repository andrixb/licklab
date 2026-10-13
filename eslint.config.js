import js from "@eslint/js";
import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";

const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  URL: "readonly",
  module: "readonly",
  require: "readonly",
  __dirname: "readonly",
};

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "test-results/**", "playwright-report/**", "scripts/**", "*.js", "*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ["*.config.*", ".dependency-cruiser.*"],
    languageOptions: { globals: nodeGlobals },
  },
  {
    // Composition root: the single place where ui/ wires concrete adapters
    // to use cases. Components import composition.ts, never adapters.
    files: ["src/ui/composition.ts"],
    rules: { "boundaries/element-types": "off" },
  },
  {
    // Tests assert invariants they establish themselves (e.g. "segment 0 is
    // the ii-V-I"); non-null reads keep expectations readable under
    // noUncheckedIndexedAccess. Source files must still guard or cast.
    files: ["**/*.test.ts", "tests/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off" },
  },
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "domain", pattern: "src/domain/**" },
        { type: "application", pattern: "src/application/**" },
        { type: "adapters", pattern: "src/adapters/**" },
        { type: "worker", pattern: "src/worker/**" },
        { type: "ui", pattern: "src/ui/**" },
      ],
    },
    rules: {
      // Clean/hexagonal: dependencies point inward only.
      // domain <- application <- adapters, worker, ui
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "domain", allow: [] },
            { from: "application", allow: ["domain"] },
            { from: "adapters", allow: ["domain", "application"] },
            { from: "worker", allow: ["domain", "application"] },
            { from: "ui", allow: ["domain", "application"] },
          ],
        },
      ],
      "boundaries/no-private": "off",
    },
  },
);
