import request from 'supertest';
import type { Express } from 'express';
import { db } from '../db';
import {
  batches, buyerReceiptAllocations, buyerReceiptLines, buyerReceipts, buyers, payroll, sales,
  treasuryTransactionEntries, treasuryTransactions,
} from '../db/schema';
import { buildCostingModel } from '../lib/costing';
import { cashFlow, managementPnl, payablesAgeing } from '../lib/finance-reports';
import { buildHomeDashboard } from '../lib/home-dashboard';
import { receivablesAgeing } from '../lib/sales-ops';
import { categoryId, createAccount, createEmployee, createSiteWithBatch, createUser, resetDatabase } from './fixtures';

const mockVerifyIdToken = jest.fn();
jest.mock('../lib/firebase', () => ({ firebaseAuth: { verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: Express = require('../app').default;

/** Roughly a year on a two-farm business; every heavy screen should still answer quickly. */
const LIMIT_MS = 2500;
const day = (n: number) => new Date(Date.UTC(2025, 9, 1) + n * 86_400_000).toISOString().slice(0, 10);

async function timed<T>(label: string, fn: () => Promise<T>) {
  const start = Date.now();
  const result = await fn();
  const ms = Date.now() - start;
  // eslint-disable-next-line no-console
  console.log(`${label}: ${ms} ms`);
  expect(ms).toBeLessThan(LIMIT_MS);
  return result;
}

beforeAll(async () => {
  await resetDatabase();
  const admin = await createUser({ firebaseUid: 'volume-admin', userRole: 'system_admin' });
  mockVerifyIdToken.mockResolvedValue({ uid: admin.firebaseUid });
  const account = await createAccount('bank', 5_000_000);
  const farmA = await createSiteWithBatch('Main Farm');
  const farmB = await createSiteWithBatch('Expansion 1');

  // 12 batches across the year
  const batchRows = await db.insert(batches).values(Array.from({ length: 12 }, (_, i) => ({
    batchCode: `VOL-${i}`, siteId: i % 2 ? farmB.site.id : farmA.site.id, cageId: i % 2 ? farmB.cage.id : farmA.cage.id,
    chicksPlaced: 5000, placementDate: day(i * 30), status: i < 10 ? 'sold' : 'growing',
  }))).returning();

  // 2,000 ledger movements: costs across categories and farms
  const costCats = await Promise.all(['feed_raw_materials', 'medicine_vaccines', 'electricity', 'fuel_gas', 'repairs_maintenance'].map(categoryId));
  for (let chunk = 0; chunk < 4; chunk += 1) {
    const txs = await db.insert(treasuryTransactions).values(Array.from({ length: 500 }, (_, i) => ({
      transactionCode: `VOL-T-${chunk}-${i}`, transactionType: 'manual_outflow', transactionDate: day((chunk * 500 + i) % 360),
      status: 'posted', narrative: 'Volume test', createdBy: admin.id,
    }))).returning({ id: treasuryTransactions.id });
    await db.insert(treasuryTransactionEntries).values(txs.map((tx, i) => ({
      treasuryTransactionId: tx.id, financeAccountId: account.id, entryDirection: 'outflow', amount: (1000 + i).toFixed(2),
      categoryId: costCats[i % costCats.length], costCentreId: i % 2 ? farmB.centre.id : farmA.centre.id, valueDate: day(i % 360),
    })));
  }

  // 400 sales with receipts (most fully paid)
  const buyerRows = await db.insert(buyers).values(Array.from({ length: 8 }, (_, i) => ({ buyerName: `Buyer ${i}`, creditTerms: 7 }))).returning();
  const saleRows = await db.insert(sales).values(Array.from({ length: 400 }, (_, i) => {
    const batch = batchRows[i % 10];
    return {
      saleCode: `VOL-S-${i}`, saleType: 'live_birds', batchId: batch.id, siteId: batch.siteId, buyerId: buyerRows[i % 8].id,
      saleDate: day(i % 360), dueDate: day((i % 360) + 7), totalBirds: 100, totalWeight: '220', pricePerKg: '600', totalAmount: '132000', status: 'reviewed',
    };
  })).returning();
  const receiptRows = await db.insert(buyerReceipts).values(saleRows.map((sale, i) => ({
    receiptCode: `VOL-R-${i}`, buyerId: sale.buyerId, receiptDate: day((i % 360) + 3), recordedBy: admin.id,
  }))).returning();
  const lineRows = await db.insert(buyerReceiptLines).values(receiptRows.map((receipt, i) => ({
    receiptId: receipt.id, lineSequence: 1, paymentAmount: i % 5 ? '132000' : '50000', paymentMethod: 'bank_transfer', paymentStatus: 'completed', financeAccountId: account.id,
  }))).returning();
  await db.insert(buyerReceiptAllocations).values(lineRows.map((line, i) => ({ receiptLineId: line.id, saleId: saleRows[i].id, allocatedAmount: line.paymentAmount })));

  // 120 payrolls (10 staff × 12 months)
  const staff = await Promise.all(Array.from({ length: 10 }, (_, i) => createEmployee(i % 2 ? farmB.site.id : farmA.site.id, i % 2 ? farmB.centre.id : farmA.centre.id)));
  await db.insert(payroll).values(staff.flatMap((employee) => Array.from({ length: 12 }, (_, m) => ({
    employeeId: employee.id, payPeriod: `${m < 3 ? 2025 : 2026}-${String(((m + 9) % 12) + 1).padStart(2, '0')}-01`, baseSalary: '60000', workingDays: 26, attendedDays: '26',
    grossSalary: '60000', epfBase: '60000', epfEmployee: '4800', epfEmployer: '7200', etfEmployer: '1800', netSalary: '55200', status: 'paid',
  }))));
}, 120_000);

describe('a year of data', () => {
  it('builds the heavy reports quickly', async () => {
    const pnl = await timed('P&L (12 months)', () => managementPnl({ from: '2025-10-01', to: '2026-09-30' }));
    expect(pnl.totalExpenses.total).toBeGreaterThan(0);
    await timed('Cash flow (12 months)', () => cashFlow({ from: '2025-10-01', to: '2026-09-30' }));
    const ageing = await timed('Receivables ageing', () => receivablesAgeing('2026-10-01'));
    expect(ageing.buyers.length).toBe(8);
    await timed('Payables ageing', () => payablesAgeing('2026-10-01'));
    await timed('Batch costing model', () => buildCostingModel());
    await timed('Home dashboard', () => buildHomeDashboard({ can: () => true, siteScope: null }));
  });

  it('serves the busiest lists quickly over HTTP', async () => {
    for (const path of ['/api/sales?page=1&limit=20', '/api/treasury/transactions', '/api/batches', '/api/payroll?page=1&limit=20', '/api/finance/pnl/by-cost-centre']) {
      const res = await timed(`GET ${path}`, () => request(app).get(path).set('Authorization', 'Bearer t'));
      expect(res.status).toBe(200);
    }
  });
});
