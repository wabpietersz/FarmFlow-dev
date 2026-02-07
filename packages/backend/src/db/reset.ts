import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://farmflow:farmflow_dev@localhost:5432/farmflow_dev';

async function reset() {
  const client = postgres(databaseUrl, { max: 1 });

  console.log('Dropping all tables...');
  await client`DROP SCHEMA public CASCADE`;
  await client`CREATE SCHEMA public`;
  await client`GRANT ALL ON SCHEMA public TO farmflow`;
  console.log('Database reset complete!');

  await client.end();
  process.exit(0);
}

reset().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
