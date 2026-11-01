// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const nodeGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  require: 'readonly',
  module: 'writable',
  process: 'readonly',
  console: 'readonly',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'coverage/*', 'android/*', 'ios/*', '.expo/*'],
  },
  {
    // Node scripts and tool configs.
    files: ['scripts/**', '*.config.js', '__mocks__/**'],
    languageOptions: { globals: nodeGlobals },
  },
  {
    // jest.mock() must come before the imports it replaces, and mock
    // factories use require() to share singletons with the test.
    files: ['__tests__/**/*.ts', '__tests__/**/*.tsx'],
    rules: {
      'import/first': 'off',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Make unused code fail loudly (prefix with _ to keep on purpose).
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
