import path from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const typeScriptFiles = ["src/**/*.ts", "tests/**/*.ts"];
const parserOptions = {
  projectService: true,
  tsconfigRootDir: rootDir,
};

const typeCheckedConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: typeScriptFiles,
}));

export default defineConfig(
  {
    ignores: [
      "dist/**",
      ".wrangler/**",
      "node_modules/**",
      "worker-configuration.d.ts",
      "*.config.js",
      "bun.lock",
    ],
  },
  {
    files: typeScriptFiles,
    ...js.configs.recommended,
  },
  ...typeCheckedConfigs,
  {
    files: typeScriptFiles,
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        ...globals.worker,
      },
      parserOptions,
      sourceType: "module",
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      eqeqeq: ["error", "always"],
      "max-depth": ["warn", 5],
      "max-lines-per-function": ["warn", { max: 100, skipBlankLines: true, skipComments: true }],
      "no-console": ["warn", { allow: ["error", "log"] }],
      "no-unused-vars": "off",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "import/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      "import/no-unresolved": ["error", { ignore: ["^bun:test$"] }],
      "import/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", ["parent", "sibling", "index"], "type"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
    settings: {
      ...importPlugin.flatConfigs.typescript.settings,
      "import/resolver": {
        typescript: { alwaysTryTypes: true, project: path.join(rootDir, "tsconfig.json") },
        node: { extensions: [".js", ".mjs", ".ts", ".d.ts"] },
      },
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/require-await": "off",
    },
  },
);
