import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", "audit/**"] },
  js.configs.recommended,
  {
    files: ["js/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        Prism: "readonly",
        renderMathInElement: "readonly",
      },
    },
  },
  {
    files: ["scripts/**/*.js", "tests/**/*.{js,cjs}", "eslint.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["tests/browser.cjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
