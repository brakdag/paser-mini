import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("airbnb-base"),
  prettierConfig,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-plusplus": "error",
      "no-await-in-loop": "error",
      "max-len": ["warn", { code: 200, ignoreComments: true }],
      "max-classes-per-file": "error",
      "no-promise-executor-return": "error",
      "no-empty-function": "error",
      "no-shadow": "warn",
      "prefer-destructuring": "error",
      "import/no-unresolved": "off",
      "no-restricted-syntax": ["error", "ForInStatement", "ForOfStatement"],
      "import/extensions": "off",
      "import/prefer-default-export": "error",
      "no-underscore-dangle": "error",
      "class-methods-use-this": "error",
      "no-console": "error",
      "no-param-reassign": "error",
      "no-cond-assign": "error",
      "import/no-extraneous-dependencies": "error",
    },
  },
];
