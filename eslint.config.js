import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('airbnb-base'),
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
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-plusplus': 'off',
      'no-await-in-loop': 'off',
      'max-len': ['warn', { code: 200, ignoreComments: true }],
      'max-classes-per-file': 'off',
      'no-promise-executor-return': 'off',
      'no-empty-function': 'off',
      'no-shadow': 'warn',
      'prefer-destructuring': 'off',
      'import/no-unresolved': 'warn',
      'no-restricted-syntax': 'off',
      'import/extensions': 'off',
      'import/prefer-default-export': 'off',
      'no-underscore-dangle': 'off',
      'class-methods-use-this': 'off',
      'no-console': 'off',
      'no-param-reassign': 'off',
      'no-cond-assign': 'off',
    },
  },
];
