/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '@farmflow/shared': '<rootDir>/../shared/src',
    // shared uses Node ESM imports ('./x.js') that point at .ts sources
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  clearMocks: true,
};
