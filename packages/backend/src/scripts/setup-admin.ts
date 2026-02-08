/**
 * One-time script to create the initial admin user.
 * Creates a Firebase user + DB user record + a default site.
 *
 * Usage: npx tsx src/scripts/setup-admin.ts
 */
import { firebaseAuth } from '../lib/firebase';
import { db } from '../db';
import { users, sites } from '../db/schema';
import { eq } from 'drizzle-orm';

const ADMIN_EMAIL = 'admin@farmflow.com';
const ADMIN_PASSWORD = 'FarmFlow2024!';
const ADMIN_NAME = 'System Admin';

async function main() {
  console.log('Setting up initial admin user...\n');

  // 1. Ensure a default site exists
  const existingSites = await db.select().from(sites).limit(1);
  let siteId: number;
  if (existingSites.length > 0) {
    siteId = existingSites[0].id;
    console.log(`Site already exists: "${existingSites[0].siteName}" (id=${siteId})`);
  } else {
    const [site] = await db.insert(sites).values({
      siteName: 'Main Farm',
      location: 'Johannesburg, South Africa',
      capacity: 50000,
    }).returning();
    siteId = site.id;
    console.log(`Created site: "Main Farm" (id=${siteId})`);
  }

  // 2. Create Firebase user (or get existing)
  let firebaseUid: string;
  try {
    const existing = await firebaseAuth.getUserByEmail(ADMIN_EMAIL);
    firebaseUid = existing.uid;
    console.log(`Firebase user already exists: ${ADMIN_EMAIL} (uid=${firebaseUid})`);
  } catch {
    const fbUser = await firebaseAuth.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
    });
    firebaseUid = fbUser.uid;
    console.log(`Created Firebase user: ${ADMIN_EMAIL} (uid=${firebaseUid})`);
  }

  // 3. Create DB user record (or skip if exists)
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.firebaseUid, firebaseUid))
    .limit(1);

  if (existingUsers.length > 0) {
    console.log(`DB user already exists: id=${existingUsers[0].id}`);
  } else {
    const [dbUser] = await db.insert(users).values({
      firebaseUid,
      email: ADMIN_EMAIL,
      fullName: ADMIN_NAME,
      userRole: 'system_admin',
      siteId: null,
      isActive: true,
    }).returning();
    console.log(`Created DB user: id=${dbUser.id}, role=system_admin`);
  }

  console.log('\n--- Setup Complete ---');
  console.log(`Email:    ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
  console.log(`Role:     system_admin`);
  console.log('\nYou can now log in at http://localhost:5173/login');

  process.exit(0);
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
