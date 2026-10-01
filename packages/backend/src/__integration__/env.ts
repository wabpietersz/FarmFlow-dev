import { TEST_DATABASE_URL } from './testDatabaseUrl';

// Must run before any app module loads config, so the app's db client points at the test database.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
