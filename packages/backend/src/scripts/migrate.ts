/**
 * Applies database migrations in production (drizzle-kit is a dev tool and isn't in the image).
 * Run before the server starts: `node dist/scripts/migrate.js`.
 * Safe to run every start: already-applied migrations are skipped.
 */
import path from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { config } from '../config';
import logger from '../lib/logger';

async function main() {
  const client = postgres(config.databaseUrl, { max: 1 });
  try {
    const migrationsFolder = process.env.MIGRATIONS_DIR ?? path.resolve(__dirname, '../../drizzle');
    await migrate(drizzle(client), { migrationsFolder });
    logger.info('Database migrations are up to date', { migrationsFolder });
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  logger.error('Database migration failed', { error });
  process.exit(1);
});
