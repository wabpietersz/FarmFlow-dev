import { eq } from 'drizzle-orm';
import { db } from '../db';
import { approvalRequests, purchaseOrders, treasuryTransactions } from '../db/schema';
import { approvalInbox, decideApproval, needsApproval, requestApproval, setApprovalLimits } from '../lib/approvals';
import { managementPnl } from '../lib/finance-reports';
import { createManualTreasuryTransaction, getFinanceAccountBalance } from '../lib/treasury';
import { categoryId, costCentreId, createAccount, createPurchaseOrder, createUser, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('approvals', () => {
  it('holds over-limit money out until a manager approves it', async () => {
    const admin = await createUser({ userRole: 'system_admin' });
    const clerk = await createUser({ userRole: 'farm_manager' });
    const account = await createAccount('bank', 500000);
    await setApprovalLimits({ purchaseOrder: 100000, moneyOut: 50000 }, admin.id);

    expect(await needsApproval('money_out', 49999, 'farm_manager')).toBe(false);
    expect(await needsApproval('money_out', 50000, 'farm_manager')).toBe(true);
    expect(await needsApproval('money_out', 900000, 'system_admin')).toBe(false); // approvers never wait

    const pending = await createManualTreasuryTransaction({
      transactionDate: '2026-09-15', transactionType: 'manual_outflow', financeAccountId: account.id, amount: 80000,
      narrative: 'Generator repair', postedBy: clerk.id, categoryId: await categoryId('repairs_maintenance'), costCentreId: await costCentreId('ADMIN'),
      approval: { requestedBy: clerk.id, summary: 'Generator repair' },
    });
    expect(pending.status).toBe('pending_approval');
    // Not in the balance or the P&L until approved
    expect(await getFinanceAccountBalance(account.id)).toBe(500000);
    expect((await managementPnl({ from: '2026-09-01', to: '2026-09-30' })).totalExpenses.total).toBe(0);

    const [request] = await db.select().from(approvalRequests);
    const inbox = await approvalInbox(() => true, 'system_admin');
    expect(inbox.items.find((i) => i.key === 'over-limit')).toEqual(expect.objectContaining({ count: 1, amount: 80000 }));

    await expect(decideApproval({ requestId: request.id, decision: 'approved', userId: clerk.id, role: 'farm_manager' })).rejects.toThrow(/can’t approve/);
    await expect(decideApproval({ requestId: request.id, decision: 'rejected', userId: admin.id, role: 'system_admin' })).rejects.toThrow(/reason/);
    await decideApproval({ requestId: request.id, decision: 'approved', userId: admin.id, role: 'system_admin' });

    const [posted] = await db.select().from(treasuryTransactions).where(eq(treasuryTransactions.id, pending.id));
    expect(posted.status).toBe('posted');
    expect(await getFinanceAccountBalance(account.id)).toBe(420000);
    await expect(decideApproval({ requestId: request.id, decision: 'approved', userId: admin.id, role: 'system_admin' })).rejects.toThrow(/Already approved/);
  });

  it('sends a rejected purchase order back to draft', async () => {
    const admin = await createUser({ userRole: 'system_admin' });
    const buyer = await createUser({ userRole: 'farm_manager' });
    const { po } = await createPurchaseOrder([{ typeCategory: 'feed', isFeed: true, quantity: 1000, unitPrice: 200 }]);
    await db.update(purchaseOrders).set({ status: 'pending_approval' }).where(eq(purchaseOrders.id, po.id));
    const request = await requestApproval(db, { entityType: 'purchase_order', entityId: po.id, amount: 200000, summary: po.orderCode, requestedBy: buyer.id });

    await decideApproval({ requestId: request.id, decision: 'rejected', note: 'Too much, order half', userId: admin.id, role: 'system_admin' });
    const [back] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id));
    expect(back.status).toBe('draft');
  });
});
