/**
 * Creates the first system admin on a new installation (safe to run again).
 * No password is ever set or printed: it creates the sign-in and prints a link
 * the admin opens to choose their own password. Farms are then added in the app.
 *
 * Usage (dev):   FARMFLOW_ADMIN_EMAIL=you@example.com FARMFLOW_ADMIN_FIRST_NAME=Nimal FARMFLOW_ADMIN_LAST_NAME=Perera npx tsx src/scripts/setup-admin.ts
 * Usage (prod):  same variables, `node dist/scripts/setup-admin.js`
 */
import { eq } from 'drizzle-orm';
import { firebaseAuth } from '../lib/firebase';
import { db } from '../db';
import { users } from '../db/schema';

async function main() {
  const email = process.env.FARMFLOW_ADMIN_EMAIL?.trim().toLowerCase();
  const firstName = process.env.FARMFLOW_ADMIN_FIRST_NAME?.trim() || 'Owner';
  const lastName = process.env.FARMFLOW_ADMIN_LAST_NAME?.trim() || '';
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error('Set FARMFLOW_ADMIN_EMAIL to the first admin’s email address');
  }
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  // Firebase sign-in (no password: they set it from the link)
  let firebaseUid: string;
  try {
    firebaseUid = (await firebaseAuth.getUserByEmail(email)).uid;
    console.log(`Firebase sign-in already exists for ${email}`);
  } catch {
    firebaseUid = (await firebaseAuth.createUser({ email, displayName: fullName })).uid;
    console.log(`Created Firebase sign-in for ${email}`);
  }
  await firebaseAuth.setCustomUserClaims(firebaseUid, { role: 'system_admin', siteId: null });

  const [existing] = await db.select().from(users).where(eq(users.firebaseUid, firebaseUid)).limit(1);
  if (existing) {
    console.log(`FarmFlow user already exists (id=${existing.id}, role=${existing.userRole})`);
  } else {
    const [created] = await db.insert(users).values({
      firebaseUid, email, firstName, lastName, fullName, userRole: 'system_admin', siteId: null, isActive: true,
    }).returning();
    console.log(`Created FarmFlow system admin (id=${created.id})`);
  }

  const link = await firebaseAuth.generatePasswordResetLink(email);
  console.log('\nOpen this link to choose a password (valid for 1 hour):');
  console.log(link);
  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
