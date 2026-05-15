import { FlatCompat } from "@eslint/eslintrc";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("airbnb-base"),
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
      },
    },
    rules: {
      // Downgrade noisy stylistic rules to warnings to allow incremental adoption
      'indent': 'warn',
      'quotes': 'warn',
      'semi': 'warn',
      'comma-dangle': 'warn',
      'object-curly-spacing': 'warn',
      'no-unused-vars': 'warn',
      'import/prefer-default-export': 'off',
      'no-underscore-dangle': 'off',
      'no-param-reassign': 'off',
      'class-methods-use-this': 'off',
      'no-console': 'off',
      'import/extensions': 'off',
      'prefer-template': 'warn',
      'operator-linebreak': 'warn',
      'arrow-parens': 'warn',
      'brace-style': 'warn',
      'eol-last': 'warn',
      'no-trailing-spaces': 'warn',
      'no-multiple-empty-lines': 'warn',
    },
  },
];