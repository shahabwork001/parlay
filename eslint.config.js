import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import globals from "globals";
import tseslint from "typescript-eslint";

const layer = (files, forbidden, message) => ({
  files,
  rules: {
    "no-restricted-imports": ["error", { patterns: [{ group: forbidden, message }] }],
  },
});

const DRIVERS = ["mongodb", "ioredis", "amqplib", "express", "socket.io", "pino*", "@opentelemetry/*"];

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", ignoreRestSiblings: true }],
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-extraneous-class": "off",
      "no-console": "error",
    },
  },
  layer(
    ["src/domain/**"],
    ["**/application/**", "**/infrastructure/**", "**/api/**", "**/workers/**", "zod", ...DRIVERS],
    "The domain layer must not depend on outer layers or frameworks.",
  ),
  layer(
    ["src/application/**"],
    ["**/infrastructure/**", "**/api/**", "**/workers/**", ...DRIVERS],
    "The application layer depends only on the domain; use ports for infrastructure.",
  ),
  layer(
    ["src/infrastructure/**"],
    ["**/api/**", "**/workers/**"],
    "Infrastructure must not depend on hosts (api, workers).",
  ),
  layer(["src/api/**"], ["**/workers/**"], "The API host must not import the workers host."),
  layer(["src/workers/**"], ["**/api/**"], "The workers host must not import the API host."),
  {
    files: ["tests/**", "vitest.config.ts", "eslint.config.js"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
      // Supertest response bodies are untyped JSON; assertions validate their shape.
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
