/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/Test/setup.ts'],
  globals: {
    TextEncoder: TextEncoder,
    TextDecoder: TextDecoder,
    ReadableStream: ReadableStream,
  },
  roots: ['<rootDir>/Test'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', target: 'ES2020', module: 'commonjs', esModuleInterop: true, allowSyntheticDefaultImports: true }, diagnostics: false }],
  },
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/(.*)$': '<rootDir>/src/renderer/$1',
    '^react-markdown$': '<rootDir>/src/renderer/__mocks__/react-markdown.tsx',
    '^remark-gfm$': '<rootDir>/src/renderer/__mocks__/remark-gfm.ts',
    '^lucide-react$': '<rootDir>/src/renderer/__mocks__/lucide-react.tsx',
    '^.+\\.(css|less|scss)$': '<rootDir>/src/renderer/__mocks__/styleMock.js',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/**/*.test.ts',
    '!src/**/*.test.tsx',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
};
