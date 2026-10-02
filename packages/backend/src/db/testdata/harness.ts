/**
 * Plumbing for the manual-testing dataset: a separate database, and the real API running in-process
 * so every record is created the way the app creates it (stock lots, ledger lines and costs all agree).
 */
import path from 'path';
import { spawnSync } from 'child_process';
import type { AddressInfo } from 'net';
import dotenv from 'dotenv';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const BACKEND_ROOT = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(BACKEND_ROOT, '.env') });

export const SOURCE_DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://farmflow:farmflow_dev@localhost:5432/farmflow_dev';

export function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
export const hasFlag = (name: string) => process.argv.includes(`--${name}`);

function databaseName(url: string) {
  return new URL(url).pathname.replace(/^\//, '');
}

function withDatabase(url: string, name: string) {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

/** TESTDATA_DATABASE_URL, or a database beside the dev one on the same server. */
export function resolveTargetUrl(defaultName: string) {
  const target = process.env.TESTDATA_DATABASE_URL || withDatabase(SOURCE_DATABASE_URL, defaultName);
  const name = databaseName(target);
  if (!/(uat|demo|test)/i.test(name)) {
    throw new Error(`Refusing to rebuild "${name}": the test dataset only goes into a database whose name contains uat, demo or test`);
  }
  if (name === databaseName(SOURCE_DATABASE_URL) && target === SOURCE_DATABASE_URL && !hasFlag('same-database')) {
    throw new Error(`"${name}" is the database in .env. Pass --same-database if you really mean to wipe it`);
  }
  return target;
}

/** Empty the target database (creating it if needed) and apply every migration plus the base lists. */
export async function rebuildDatabase(targetUrl: string) {
  const name = databaseName(targetUrl);
  const admin = postgres(withDatabase(targetUrl, 'postgres'), { max: 1, onnotice: () => {} });
  try {
    const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
    if (existing.length === 0) await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }

  const client = postgres(targetUrl, { max: 1, onnotice: () => {} });
  try {
    await client.unsafe('DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;');
    await migrate(drizzle(client), { migrationsFolder: path.join(BACKEND_ROOT, 'drizzle') });
  } finally {
    await client.end();
  }

  // Dropdown lists (designations, mortality causes…) exactly as a new installation gets them
  const seeded = spawnSync('npx', ['tsx', path.join(BACKEND_ROOT, 'src/db/seed.ts')], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, DATABASE_URL: targetUrl },
    encoding: 'utf8',
  });
  if (seeded.status !== 0) throw new Error(`Base seed failed: ${seeded.stderr || seeded.stdout}`);
}

export type SourceUser = { firebase_uid: string; email: string; first_name: string; last_name: string; full_name: string; user_role: string };

/** Real sign-ins from the dev database, so the people who can sign in today can sign in to the test data too. */
export async function readSourceUsers(targetUrl: string): Promise<SourceUser[]> {
  if (hasFlag('no-copy-users') || SOURCE_DATABASE_URL === targetUrl) return [];
  const source = postgres(SOURCE_DATABASE_URL, { max: 1, onnotice: () => {}, connect_timeout: 5 });
  try {
    return await source<SourceUser[]>`
      SELECT firebase_uid, email, first_name, last_name, full_name, user_role
      FROM users WHERE is_active = true ORDER BY id`;
  } catch {
    return [];
  } finally {
    await source.end();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers name the shape they expect
export type Api = <T = any>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, body?: unknown) => Promise<T>;

/**
 * Start the API against the target database. Returns a function that makes a client signed in as any
 * user in that database (by firebase uid): no passwords, nothing leaves this machine.
 */
export async function startApi(targetUrl: string) {
  process.env.DATABASE_URL = targetUrl;

  // lib/firebase reuses an app that already exists, so the seed never needs real credentials
  const { initializeApp, getApps } = await import('firebase-admin/app');
  if (getApps().length === 0) initializeApp({ projectId: 'farmflow-testdata' });
  const { firebaseAuth } = await import('../../lib/firebase');
  (firebaseAuth as unknown as { verifyIdToken: (token: string) => Promise<{ uid: string }> }).verifyIdToken =
    async (token: string) => ({ uid: token });

  const { loadAccessMatrix } = await import('../../lib/permissions');
  await loadAccessMatrix();

  const express = (await import('express')).default;
  const routes = (await import('../../routes')).default;
  const { errorHandler } = await import('../../middleware/errorHandler');
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api', routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;

  const as = (firebaseUid: string): Api => async (method, url, body) => {
    const response = await fetch(`http://127.0.0.1:${port}/api${url}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${firebaseUid}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await response.json().catch(() => null) as { data?: unknown; error?: string; details?: unknown } | null;
    if (!response.ok) {
      const details = json?.details ? ` ${JSON.stringify(json.details)}` : '';
      throw new Error(`${method} ${url} → ${response.status}: ${json?.error ?? 'no body'}${details}`);
    }
    return json?.data as never;
  };

  const stop = async () => {
    // Audit lines are written without waiting; give them a moment before the pool closes
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const { closeDb } = await import('../index');
    await closeDb();
  };

  return { as, stop };
}

// ─── Dates ────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

/** The run date. TESTDATA_TODAY=YYYY-MM-DD pins it (useful to rebuild the same picture later). */
export const TODAY = process.env.TESTDATA_TODAY || (() => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
})();

/** Today plus (or minus) a number of days. */
export function day(offset: number, from = TODAY) {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return iso(d);
}

/** Months back from the current one: 0 = this month, 1 = last month… */
export function month(back: number) {
  const base = new Date(`${TODAY}T00:00:00Z`);
  const first = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - back, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const key = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}`;
  const label = first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return {
    key,
    label,
    start: iso(first),
    end: iso(last),
    /** A day of that month, clamped to its length. */
    on: (dayOfMonth: number) => iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), Math.min(dayOfMonth, last.getUTCDate())))),
    days: (() => {
      const all: string[] = [];
      for (let d = 1; d <= last.getUTCDate(); d += 1) all.push(iso(new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), d))));
      return all;
    })(),
  };
}

export const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

/** Repeatable "random" numbers, so two builds on the same day give the same data. */
export function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export const money = (value: number | string | null | undefined) =>
  Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
