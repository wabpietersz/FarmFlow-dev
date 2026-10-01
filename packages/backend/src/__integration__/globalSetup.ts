import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { TEST_DATABASE_URL } from './testDatabaseUrl';

/** Recreate the test database from scratch and apply every migration, exactly as a fresh install would. */
export default async function globalSetup() {
  const url = new URL(TEST_DATABASE_URL);
  const databaseName = url.pathname.replace(/^\//, '');
  if (!/test/.test(databaseName)) {
    throw new Error(`Refusing to reset "${databaseName}": integration tests only run against a *test* database`);
  }

  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';
  const admin = postgres(adminUrl.toString(), { max: 1, onnotice: () => {} });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
  await admin.end();

  const client = postgres(TEST_DATABASE_URL, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  await client.end();
}
