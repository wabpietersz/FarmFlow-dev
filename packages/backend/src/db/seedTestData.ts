/**
 * Builds the manual-testing dataset in its own database (never the one in .env).
 *
 *   npm run db:testdata                      → rebuilds farmflow_uat beside the dev database
 *   TESTDATA_DATABASE_URL=… npm run db:testdata   → rebuilds that database instead (name must contain uat, demo or test)
 *   TESTDATA_TODAY=2026-10-02 npm run db:testdata → dates everything as if built on that day
 *
 * The database is wiped and rebuilt each time. Sign-ins that exist in the dev database are copied across,
 * so whoever can sign in today can sign in to the test data. See docs/testing/README.md.
 */
import path from 'path';
import { hasFlag, rebuildDatabase, readSourceUsers, resolveTargetUrl, startApi, TODAY } from './testdata/harness';

async function main() {
  const targetUrl = resolveTargetUrl('farmflow_uat');
  const target = new URL(targetUrl);
  const log = (line: string) => console.log(`  ${line}`);
  console.log(`Building the test dataset in "${target.pathname.slice(1)}" on ${target.host}, dated ${TODAY}`);

  // --sheet-only: leave the data alone and just rewrite the data sheet from it
  const sheetOnly = hasFlag('sheet-only');
  const sourceUsers = await readSourceUsers(targetUrl);
  if (!sheetOnly) {
    await rebuildDatabase(targetUrl);
    log('Empty database with all migrations applied');
  }

  const { as, stop } = await startApi(targetUrl);
  const { db } = await import('./index');
  const { users } = await import('./schema');
  const { buildUatDataset, PERSONAS, personaEmail } = await import('./testdata/uat');
  const { writeDataSheet } = await import('./testdata/dataSheet');

  // Whoever can sign in to the dev database can sign in here, with the same role (farm ties are not copied)
  for (const user of sheetOnly ? [] : sourceUsers) {
    await db.insert(users).values({
      firebaseUid: user.firebase_uid, email: user.email, firstName: user.first_name, lastName: user.last_name,
      fullName: user.full_name, userRole: user.user_role, siteId: null, isActive: true,
    });
  }
  let adminUid = sourceUsers.find((user) => user.user_role === 'system_admin')?.firebase_uid;
  if (!adminUid && !sheetOnly) {
    adminUid = 'uat:owner';
    await db.insert(users).values({
      firebaseUid: adminUid, email: 'owner@farmflow.test', firstName: 'Test', lastName: 'Owner', fullName: 'Test Owner', userRole: 'system_admin', isActive: true,
    });
  }
  if (!sheetOnly) log(`${sourceUsers.length} sign-in(s) copied from the dev database`);

  try {
    if (!sheetOnly) await buildUatDataset({ as, adminUid: adminUid!, log });
    const sheet = path.resolve(__dirname, '../../../../docs/testing/Test-Data-Sheet.md');
    await writeDataSheet({ file: sheet, copiedUsers: sourceUsers.map((user) => user.email), personas: PERSONAS.map((p) => ({ ...p, email: personaEmail(p.key) })) });
    log(`Data sheet written to ${path.relative(process.cwd(), sheet)}`);
  } finally {
    await stop();
  }

  console.log('\nDone. To use it, start the backend with:');
  console.log(`  DATABASE_URL=${targetUrl} npm run dev:backend`);
  process.exit(0);
}

main().catch((error) => {
  console.error('\nTest data build failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
