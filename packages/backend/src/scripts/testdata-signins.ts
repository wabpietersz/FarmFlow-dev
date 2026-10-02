/**
 * Gives the made-up test staff (the @farmflow.test users in the test dataset) real sign-ins.
 * For each one it creates the Firebase sign-in if needed, ties it to the user in the test database,
 * and prints a link that person opens to choose a password. No password is set or printed.
 *
 *   npm run db:testdata:signins                 → all made-up staff
 *   npm run db:testdata:signins -- nimal.manager ruwan.accounts   → only these
 *
 * Run it again whenever the test data has been rebuilt (the rebuild resets the tie) or a link has expired.
 */
import { eq, like } from 'drizzle-orm';
import { resolveTargetUrl } from '../db/testdata/harness';

async function main() {
  // Point the app's database connection at the test database before anything loads it
  process.env.DATABASE_URL = resolveTargetUrl('farmflow_uat');
  const { firebaseAuth } = await import('../lib/firebase');
  const { db, closeDb } = await import('../db');
  const { users } = await import('../db/schema');
  if (!firebaseAuth) throw new Error('Firebase credentials are not set in packages/backend/.env');

  const only = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const people = (await db.select().from(users).where(like(users.email, '%@farmflow.test')))
    .filter((user) => only.length === 0 || only.some((key) => user.email.startsWith(`${key}@`)));
  if (people.length === 0) throw new Error('No matching test staff found. Build the test data first: npm run db:testdata');

  for (const person of people) {
    let uid: string;
    try {
      uid = (await firebaseAuth.getUserByEmail(person.email)).uid;
    } catch {
      uid = (await firebaseAuth.createUser({ email: person.email, displayName: person.fullName })).uid;
    }
    await firebaseAuth.setCustomUserClaims(uid, { role: person.userRole, siteId: person.siteId ?? null });
    await db.update(users).set({ firebaseUid: uid, updatedAt: new Date() }).where(eq(users.id, person.id));
    const link = await firebaseAuth.generatePasswordResetLink(person.email);
    console.log(`\n${person.fullName} (${person.userRole.replace(/_/g, ' ')})\n  ${person.email}\n  ${link}`);
  }
  console.log('\nEach link works once and for one hour. Run this again for a fresh link.');
  await closeDb();
  process.exit(0);
}

main().catch((error) => {
  console.error('Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
