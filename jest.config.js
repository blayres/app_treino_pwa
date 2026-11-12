/** @type {import('jest').Config} */
const tsJest = (jsx) => ['ts-jest', { tsconfig: { jsx, esModuleInterop: true } }];

module.exports = {
  projects: [
    {
      // Pure logic and services (Supabase replaced by __tests__/helpers/supabaseMock).
      displayName: 'unit',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/*.test.ts', '<rootDir>/__tests__/*.test.tsx'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: { '^.+\\.(ts|tsx)$': tsJest('react') },
      moduleNameMapper: {
        // Native/expo modules are not needed by pure logic.
        '^react-native$': '<rootDir>/__mocks__/react-native.js',
        '^expo-.*': '<rootDir>/__mocks__/expo.js',
      },
    },
    {
      // UI components rendered like the PWA: react-native-web in a DOM (jsdom).
      displayName: 'components',
      testEnvironment: 'jsdom',
      // Not the project root: its __mocks__/react-native.js would shadow react-native-web.
      roots: ['<rootDir>/src', '<rootDir>/__tests__'],
      testMatch: ['<rootDir>/__tests__/components/**/*.test.tsx'],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: { '^.+\\.(ts|tsx)$': tsJest('react-jsx') },
      moduleNameMapper: {
        '^react-native$': require.resolve('react-native-web'),
        '^react-native-safe-area-context$': '<rootDir>/__mocks__/safeAreaContext.js',
        '^expo-.*': '<rootDir>/__mocks__/expo.js',
        '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/file.js',
      },
      setupFiles: ['<rootDir>/__tests__/components/setup.ts'],
    },
  ],
};
