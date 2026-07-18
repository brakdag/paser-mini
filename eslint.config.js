import { configs as airbnbConfigs } from "eslint-config-airbnb-extended";
import importX from "eslint-plugin-import-x";
import stylistic from "@stylistic/eslint-plugin";
import prettierConfig from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

export default [
  {
    plugins: {
      "import-x": importX,
      "@stylistic": stylistic,
    },
  },
  ...airbnbConfigs.base.recommended,
  jsdoc.configs["flat/recommended"],
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-plusplus": "error",
      "no-await-in-loop": "off",
      "max-len": ["warn", { code: 200, ignoreComments: true }],
      "max-classes-per-file": "error",
      "no-promise-executor-return": "error",
      "no-empty-function": "error",
      "no-shadow": "warn",
      "prefer-destructuring": "error",
      "import-x/no-unresolved": "off",
      "no-restricted-syntax": ["error", "ForInStatement", "ForOfStatement"],
      "import-x/extensions": "off",
      "import-x/prefer-default-export": "error",
      "no-underscore-dangle": "off",
      "class-methods-use-this": "off",
      "no-console": "off",
      "no-param-reassign": "error",
      "no-cond-assign": "error",
      "import-x/no-extraneous-dependencies": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/require-jsdoc": ["error", {
        "require": {
          "MethodDefinition": true,
          "ClassDeclaration": true,
          "FunctionDeclaration": true,
          "ArrowFunctionExpression": true
        }
      }],
    },
  },
];
