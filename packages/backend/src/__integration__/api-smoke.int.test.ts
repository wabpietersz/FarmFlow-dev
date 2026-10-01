import fs from 'fs';
import path from 'path';
import request from 'supertest';
import type { Express } from 'express';
import { db } from '../db';
import { buyerReceiptLines, payroll, saleBookings } from '../db/schema';
import { recordBuyerReceipt } from '../lib/sales-ledger';
import { issueStaffLoan } from '../lib/staff-payroll';
import { createAccount, createEmployee, createSale, createSiteWithBatch, createUser, resetDatabase } from './fixtures';

// Sign in as a real system admin from the test database
const mockVerifyIdToken = jest.fn();
jest.mock('../lib/firebase', () => ({ firebaseAuth: { verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: Express = require('../app').default;

/**
 * Every GET path without a ":param", read from the route sources: `router.use('/x', xRoutes)` in
 * routes/index.ts plus `router.get('/path'` (or a named sub-router's `.get`) in each route file.
 */
function listGetPaths(): string[] {
  const dir = path.join(__dirname, '../routes');
  const index = fs.readFileSync(path.join(dir, 'index.ts'), 'utf8');
  const fileOf = new Map<string, string>();
  for (const m of index.matchAll(/import (\w+)(?:, \{ (\w+) \})? from '\.\/([\w-]+)'/g)) {
    fileOf.set(m[1], `${m[3]}#default`);
    if (m[2]) fileOf.set(m[2], `${m[3]}#${m[2]}`);
  }
  const paths: string[] = [];
  for (const m of index.matchAll(/router\.use\('([^']+)',\s*(\w+)\)/g)) {
    const target = fileOf.get(m[2]);
    if (!target) continue;
    const [file, routerName] = target.split('#');
    const source = fs.readFileSync(path.join(dir, `${file}.ts`), 'utf8');
    const name = routerName === 'default' ? 'router' : routerName;
    for (const g of source.matchAll(new RegExp(`\\b${name}\\.get\\('([^']+)'`, 'g'))) {
      paths.push(`/api${m[1]}${g[1] === '/' ? '' : g[1]}`);
    }
  }
  return [...new Set(paths)].filter((p) => !p.includes(':') && !p.includes('*'));
}

// Endpoints that need query input or call outside services
const SKIP = new Set(['/api/auth/me', '/api/metrics', '/api/health/live', '/api/health/ready']);
const QUERY: Record<string, string> = {
  '/api/payroll/register': 'period=2026-09',
  '/api/payroll/statutory': 'period=2026-09',
};

beforeAll(async () => {
  await resetDatabase();
  const user = await createUser({ firebaseUid: 'smoke-admin', userRole: 'system_admin' });
  mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid });

  // Some data in every module so the list queries actually join and aggregate rows
  const account = await createAccount();
  const { site, centre, batch } = await createSiteWithBatch();
  const { buyer, sale } = await createSale(batch.id, 100000);
  await db.insert(saleBookings).values({ bookingCode: 'BKG-SMOKE', buyerId: buyer.id, batchId: batch.id, catchDate: '2026-10-05', expectedBirds: 100, pricePerKg: '600' });
  await recordBuyerReceipt({ buyerId: buyer.id, saleId: sale.id, receiptDate: '2026-09-21', lines: [{ paymentAmount: 40000, paymentMethod: 'cash', financeAccountId: account.id }], recordedBy: user.id });
  const employee = await createEmployee(site.id, centre.id);
  await db.insert(payroll).values({ employeeId: employee.id, payPeriod: '2026-09-01', baseSalary: '50000', workingDays: 26, attendedDays: '26', grossSalary: '50000', epfBase: '50000', epfEmployee: '4000', epfEmployer: '6000', etfEmployer: '1500', netSalary: '46000', status: 'approved' });
  await issueStaffLoan({ employeeId: employee.id, loanType: 'advance', principal: 5000, issuedDate: '2026-09-10', firstRecoveryPeriod: '2026-09', financeAccountId: account.id, paymentMethod: 'cash', userId: user.id });
  expect(await db.select().from(buyerReceiptLines)).toHaveLength(1);
});

describe('every list endpoint answers against a real database', () => {
  const paths = listGetPaths().filter((path) => !SKIP.has(path));

  it('finds the routes', () => {
    expect(paths.length).toBeGreaterThan(60);
  });

  it.each(paths)('GET %s refuses anyone not signed in', async (path) => {
    const res = await request(app).get(path);
    expect(res.status).toBe(401);
  });

  it.each(paths)('GET %s', async (path) => {
    const res = await request(app).get(QUERY[path] ? `${path}?${QUERY[path]}` : path).set('Authorization', 'Bearer smoke');
    // 4xx for missing required query input is acceptable; a 500 never is
    if (res.status >= 500) {
      throw new Error(`${path} → ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
    }
    expect(res.status).toBeLessThan(500);
  });
});
