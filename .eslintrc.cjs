module.exports = {
  root: true,
  env: {
    es2021: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: ['./tsconfig.json'],
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['dist/**', 'node_modules/**', '*.d.ts', 'scripts/**', 'skills/**/scripts/**'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'off',
  },
};
