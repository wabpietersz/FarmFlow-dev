import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { approvalRequests, purchaseOrders, systemConfig, treasuryTransactions, users } from '../db/schema';
import { hasPermission } from './permissions';
import { assertPeriodOpen } from './period-locks';

type Executor = typeof db | any;

export class ApprovalError extends Error {
  constructor(message: string, public code = 'APPROVAL_RULE', public status = 400) {
    super(message);
  }
}

export const APPROVAL_LIMITS_KEY = 'approvals.limits';
export type ApprovalLimits = { purchaseOrder: number | null; moneyOut: number | null };
export type ApprovalKind = 'purchase_order' | 'money_out';

export const DECIDE_PERMISSION = 'approvals:decide';
export const canDecide = (role: string) => role === 'system_admin' || hasPermission(role, DECIDE_PERMISSION);

export async function getApprovalLimits(executor: Executor = db): Promise<ApprovalLimits> {
  const [row] = await executor.select().from(systemConfig).where(eq(systemConfig.configKey, APPROVAL_LIMITS_KEY)).limit(1);
  const value = (row?.configValue ?? {}) as Partial<ApprovalLimits>;
  const limit = (n: unknown) => (n == null || n === '' || !Number.isFinite(Number(n)) || Number(n) <= 0 ? null : Number(n));
  return { purchaseOrder: limit(value.purchaseOrder), moneyOut: limit(value.moneyOut) };
}

export async function setApprovalLimits(limits: ApprovalLimits, userId: number) {
  await db
    .insert(systemConfig)
    .values({ configKey: APPROVAL_LIMITS_KEY, configValue: limits, description: 'Approval limits (Rs)', updatedBy: userId })
    .onConflictDoUpdate({ target: systemConfig.configKey, set: { configValue: limits, updatedBy: userId, updatedAt: new Date() } });
}

/** Over the limit and the person can't approve it themselves? */
export async function needsApproval(kind: ApprovalKind, amount: number, role: string, executor: Executor = db) {
  if (canDecide(role)) return false;
  const limits = await getApprovalLimits(executor);
  const limit = kind === 'purchase_order' ? limits.purchaseOrder : limits.moneyOut;
  return limit != null && amount >= limit;
}

export async function requestApproval(executor: Executor, input: { entityType: ApprovalKind; entityId: number; amount: number; summary: string; requestedBy: number }) {
  const [request] = await executor
    .insert(approvalRequests)
    .values({ ...input, amount: input.amount.toFixed(2) })
    .returning();
  return request;
}

/** Approve or reject, and apply the effect to the purchase order / money movement in the same transaction. */
export async function decideApproval(input: { requestId: number; decision: 'approved' | 'rejected'; note?: string | null; userId: number; role: string }) {
  if (!canDecide(input.role)) throw new ApprovalError('You can’t approve this', 'FORBIDDEN', 403);
  if (input.decision === 'rejected' && !input.note?.trim()) throw new ApprovalError('Give a reason for rejecting');

  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(approvalRequests).where(eq(approvalRequests.id, input.requestId)).limit(1);
    if (!request) throw new ApprovalError('Approval request not found', 'NOT_FOUND', 404);
    if (request.status !== 'pending') throw new ApprovalError(`Already ${request.status}`);
    if (request.requestedBy === input.userId && input.role !== 'system_admin') {
      throw new ApprovalError('Someone else must approve your own request', 'SELF_APPROVAL');
    }

    if (request.entityType === 'purchase_order') {
      const [po] = await tx.select().from(purchaseOrders).where(eq(purchaseOrders.id, request.entityId)).limit(1);
      if (!po || po.status !== 'pending_approval') throw new ApprovalError('This purchase order is no longer waiting for approval');
      await tx.update(purchaseOrders)
        .set({ status: input.decision === 'approved' ? 'submitted' : 'draft', updatedAt: new Date() })
        .where(eq(purchaseOrders.id, po.id));
    } else if (request.entityType === 'money_out') {
      const [txn] = await tx.select().from(treasuryTransactions).where(eq(treasuryTransactions.id, request.entityId)).limit(1);
      if (!txn || txn.status !== 'pending_approval') throw new ApprovalError('This payment is no longer waiting for approval');
      if (input.decision === 'approved') await assertPeriodOpen(String(txn.transactionDate), 'financial');
      // Only posted lines count in balances and reports, so approval is what makes the money move
      await tx.update(treasuryTransactions)
        .set({ status: input.decision === 'approved' ? 'posted' : 'rejected', approvedBy: input.userId, updatedAt: new Date() })
        .where(eq(treasuryTransactions.id, txn.id));
    }

    const [updated] = await tx
      .update(approvalRequests)
      .set({ status: input.decision, decidedBy: input.userId, decidedAt: new Date(), decisionNote: input.note?.trim() || null })
      .where(eq(approvalRequests.id, request.id))
      .returning();
    return updated;
  });
}

export async function listApprovalRequests(status = 'pending') {
  return db
    .select({
      id: approvalRequests.id,
      entityType: approvalRequests.entityType,
      entityId: approvalRequests.entityId,
      amount: approvalRequests.amount,
      summary: approvalRequests.summary,
      status: approvalRequests.status,
      requestedBy: approvalRequests.requestedBy,
      requestedByName: users.fullName,
      decisionNote: approvalRequests.decisionNote,
      decidedAt: approvalRequests.decidedAt,
      createdAt: approvalRequests.createdAt,
    })
    .from(approvalRequests)
    .innerJoin(users, eq(approvalRequests.requestedBy, users.id))
    .where(status === 'all' ? undefined : eq(approvalRequests.status, status))
    .orderBy(desc(approvalRequests.createdAt))
    .limit(200);
}

type InboxItem = { key: string; kind: string; title: string; detail: string; amount: number | null; count: number; href: string };

/**
 * Everything waiting for someone's decision, in one list. Over-limit requests come from
 * approval_requests; the rest are the existing review steps in each module.
 */
export async function approvalInbox(can: (permission: string) => boolean, role: string) {
  const items: InboxItem[] = [];
  const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)) as unknown as T[];
  const one = async (q: ReturnType<typeof sql>) => (await rows<{ count: number; total: string | null }>(q))[0] ?? { count: 0, total: null };
  const add = (key: string, kind: string, title: string, detail: string, r: { count: number; total: string | null }, href: string) => {
    if (Number(r.count) > 0) items.push({ key, kind, title, detail, amount: r.total != null ? Number(r.total) : null, count: Number(r.count), href });
  };

  if (canDecide(role)) {
    add('over-limit', 'approval', 'Over the approval limit', 'Purchase orders and payments waiting for you',
      await one(sql`SELECT count(*)::int AS count, SUM(amount::numeric) AS total FROM approval_requests WHERE status = 'pending'`), '/approvals');
  }
  if (can('treasury:petty_cash:review')) {
    add('petty-cash', 'money', 'Petty cash spending', 'Submitted by farm staff',
      await one(sql`SELECT count(*)::int AS count, SUM(amount::numeric) AS total FROM petty_cash_expenses WHERE status = 'submitted'`), '/treasury?tab=petty-cash');
  }
  if (can('treasury:transactions:manage')) {
    add('expenses', 'money', 'Operational expenses', 'Waiting for approval',
      await one(sql`SELECT count(*)::int AS count, SUM(amount::numeric) AS total FROM operational_expenses WHERE status = 'pending_approval'`), '/treasury?tab=transactions');
  }
  if (can('inventory:update')) {
    add('invoices', 'stock', 'Supplier invoices', 'Recorded, not yet approved',
      await one(sql`SELECT count(*)::int AS count, SUM(invoice_amount::numeric) AS total FROM supplier_invoices WHERE status = 'recorded'`), '/farm-control');
    add('work-orders', 'stock', 'Service work orders', 'Waiting for approval',
      await one(sql`SELECT count(*)::int AS count, SUM(total_amount::numeric) AS total FROM service_work_orders WHERE status = 'pending_approval'`), '/farm-control');
    add('contracts', 'stock', 'Supplier contracts', 'Drafts to review',
      await one(sql`SELECT count(*)::int AS count, NULL::numeric AS total FROM supplier_contracts WHERE status = 'draft'`), '/inventory?tab=contracts');
  }
  if (can('inventory:create')) {
    add('requisitions', 'stock', 'Stock requests', 'From farms and the mill',
      await one(sql`SELECT count(*)::int AS count, NULL::numeric AS total FROM purchase_requisitions WHERE status = 'submitted'`), '/inventory?tab=requisitions');
  }
  if (can('payroll:update')) {
    add('payroll', 'people', 'Payroll to approve', 'Reviewed, waiting for approval',
      await one(sql`SELECT count(*)::int AS count, SUM(net_salary::numeric) AS total FROM payroll WHERE status = 'reviewed'`), '/payroll');
  }
  if (can('sales:update')) {
    add('sales', 'sales', 'Draft sales', 'Check lorries and mark reviewed to take payment',
      await one(sql`SELECT count(*)::int AS count, SUM(total_amount::numeric) AS total FROM sales WHERE status = 'draft'`), '/sales');
  }

  return { items, total: items.reduce((sum, item) => sum + item.count, 0) };
}

export async function pendingApprovalCount() {
  const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(approvalRequests).where(and(eq(approvalRequests.status, 'pending')));
  return row?.count ?? 0;
}
