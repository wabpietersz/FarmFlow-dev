/**
 * Integration tests run against a real, freshly migrated Postgres database (never the dev DB).
 * TEST_DATABASE_URL defaults to a local `farmflow_test` database on the docker-compose Postgres.
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__integration__/**/*.int.test.ts'],
  moduleNameMapper: {
    '@farmflow/shared': '<rootDir>/../shared/src',
  },
  globalSetup: '<rootDir>/src/__integration__/globalSetup.ts',
  setupFiles: ['<rootDir>/src/__integration__/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__integration__/closeDb.ts'],
  maxWorkers: 1,
  testTimeout: 30000,
};
