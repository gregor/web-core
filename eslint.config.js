import js from "@eslint/js";
import shared from "./config/eslint.js";

export default [
  { ignores: ["dist/**", "node_modules/**", "test/fixtures/**"] },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { process: "readonly", console: "readonly" },
    },
  },
  ...shared,
];
