import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import dotenv from 'dotenv';
import path from 'path';
import { systemConfig } from './schema/system';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const databaseUrl =
  process.env.DATABASE_URL || 'postgresql://farmflow:farmflow_dev@localhost:5432/farmflow_dev';

async function seed() {
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client);

  console.log('Seeding system_config...');

  const seedData = [
    {
      configKey: 'designations',
      configValue: JSON.stringify([
        'Farm Manager',
        'Supervisor',
        'Worker',
        'Accountant',
        'Feed Mill Operator',
        'Driver',
        'Security',
        'Cleaner',
      ]),
      description: 'Employee designation options',
    },
    {
      configKey: 'feed_types',
      configValue: JSON.stringify(['Starter', 'Grower', 'Finisher']),
      description: 'Feed type categories',
    },
    {
      configKey: 'mortality_causes',
      configValue: JSON.stringify([
        'Disease',
        'Weakness',
        'Accident',
        'Suffocation',
        'Predator',
        'Unknown',
      ]),
      description: 'Mortality cause options',
    },
    {
      configKey: 'leave_types',
      configValue: JSON.stringify(['Casual', 'Earned', 'Medical', 'Maternity', 'Unpaid']),
      description: 'Leave type categories',
    },
    {
      configKey: 'mortality_alert_threshold',
      configValue: JSON.stringify(2.0),
      description: 'Mortality rate threshold (%) that triggers an alert',
    },
    {
      configKey: 'fcr_alert_threshold',
      configValue: JSON.stringify(1.8),
      description: 'FCR threshold that triggers an alert',
    },
    {
      configKey: 'payment_methods',
      configValue: JSON.stringify(['Cash', 'Cheque', 'Bank Transfer']),
      description: 'Available payment methods',
    },
    {
      configKey: 'employment_types',
      configValue: JSON.stringify(['Permanent', 'Contract', 'Seasonal']),
      description: 'Employment type options',
    },
  ];

  for (const data of seedData) {
    await db
      .insert(systemConfig)
      .values(data)
      // Only fills lists that are missing: lists edited in Settings are never overwritten
      .onConflictDoNothing({ target: systemConfig.configKey });
    console.log(`  Seeded: ${data.configKey}`);
  }

  console.log('Seed complete!');
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
