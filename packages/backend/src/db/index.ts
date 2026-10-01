import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

const queryClient = postgres(config.databaseUrl, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });

/** Close the connection pool (used by integration tests and graceful shutdown). */
export async function closeDb() {
  await queryClient.end({ timeout: 5 });
}

export { schema };
export default db;
