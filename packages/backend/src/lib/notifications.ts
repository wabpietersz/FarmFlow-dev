import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { approvalRequests, feedInventory, inventoryAlerts, notifications, users } from '../db/schema';
import { canDecide } from './approvals';
import { listDueHealthTasks } from './batch-health';
import { toIsoDate } from './bird-days';
import logger from './logger';
import { hasPermission } from './permissions';
import { receivablesAgeing, upcomingBookings } from './sales-ops';
import { expiringLots } from './stock';
import { listPendingBuyerChequeReceipts } from './treasury';

type Executor = typeof db | any;
export type Tone = 'info' | 'warning' | 'danger';
export type NewNotification = { userId: number; type: string; title: string; message: string; link: string; tone?: Tone; dedupeKey: string; entityType?: string; entityId?: number };

/** Adds notifications; the same dedupe key for the same user is only ever stored once. */
export async function notify(items: NewNotification[], executor: Executor = db) {
  if (items.length === 0) return 0;
  const rows = await executor
    .insert(notifications)
    .values(items.map((n) => ({
      userId: n.userId, notificationType: n.type, title: n.title, message: n.message, link: n.link,
      tone: n.tone ?? 'info', dedupeKey: n.dedupeKey, entityType: n.entityType ?? null, entityId: n.entityId ?? null,
    })))
    .onConflictDoNothing({ target: [notifications.userId, notifications.dedupeKey] })
    .returning({ id: notifications.id });
  return rows.length;
}

const isoWeek = (date: string) => {
  const d = new Date(`${date}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return `${d.getUTCFullYear()}-W${String(1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)).padStart(2, '0')}`;
};
const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-US')}`;

/**
 * Looks at the farm and creates notifications for each user who should know:
 * vaccinations due, stock running low or expiring, buyer cheques to deposit,
 * approvals waiting, catches tomorrow and buyers paying late.
 */
export async function generateNotifications(asOf = toIsoDate(new Date())) {
  const people = await db
    .select({ id: users.id, role: users.userRole, siteId: users.siteId })
    .from(users)
    .where(eq(users.isActive, true));
  if (people.length === 0) return 0;

  const [dueTasks, lots, lowStock, cheques, approvals, catches, ageing] = await Promise.all([
    listDueHealthTasks({ asOf }),
    expiringLots({ withinDays: 14, asOf }),
    db.select({ id: inventoryAlerts.id, itemName: feedInventory.ingredientName, quantity: inventoryAlerts.currentQuantity, reorderLevel: inventoryAlerts.reorderLevel })
      .from(inventoryAlerts).innerJoin(feedInventory, eq(inventoryAlerts.inventoryItemId, feedInventory.id)).where(eq(inventoryAlerts.status, 'active')),
    listPendingBuyerChequeReceipts(),
    db.select({ id: approvalRequests.id, summary: approvalRequests.summary, amount: approvalRequests.amount, requestedBy: approvalRequests.requestedBy })
      .from(approvalRequests).where(eq(approvalRequests.status, 'pending')),
    upcomingBookings(1, asOf),
    receivablesAgeing(asOf),
  ]);

  const items: NewNotification[] = [];
  for (const person of people) {
    const can = (permission: string) => person.role === 'system_admin' || hasPermission(person.role, permission);
    const myFarm = person.role === 'system_admin' ? null : person.siteId;

    if (can('batches:read')) {
      for (const task of dueTasks.filter((t) => !myFarm || t.siteId === myFarm)) {
        const overdue = toIsoDate(task.dueDate) < asOf;
        items.push({ userId: person.id, type: 'health_task', title: `${task.name} ${overdue ? 'overdue' : 'due today'}`, message: `${task.batchCode}`,
          link: `/batches/${task.batchId}/today`, tone: overdue ? 'danger' : 'warning', dedupeKey: `health-task:${task.id}:${overdue ? 'late' : 'due'}`, entityType: 'batch_health_task', entityId: task.id });
      }
    }
    if (can('inventory:read') || can('feed_inventory:read')) {
      for (const lot of lots) {
        items.push({ userId: person.id, type: 'stock_expiry', title: lot.expired ? `${lot.itemName} has expired` : `${lot.itemName} expires in ${lot.daysLeft} days`,
          message: `${lot.lotCode} · ${lot.locationName}`, link: '/inventory?tab=stores', tone: lot.expired ? 'danger' : 'warning',
          dedupeKey: `lot:${lot.lotId}:${lot.expired ? 'expired' : 'soon'}`, entityType: 'inventory_lot', entityId: lot.lotId });
      }
      for (const alert of lowStock) {
        items.push({ userId: person.id, type: 'low_stock', title: `${alert.itemName} is running low`, message: `${Number(alert.quantity).toLocaleString()} left (reorder at ${Number(alert.reorderLevel).toLocaleString()})`,
          link: '/inventory', tone: 'warning', dedupeKey: `low-stock:${alert.id}`, entityType: 'inventory_alert', entityId: alert.id });
      }
    }
    if (can('treasury:read')) {
      for (const cheque of cheques) {
        if (cheque.chequeDate && cheque.chequeDate > asOf) continue;
        items.push({ userId: person.id, type: 'cheque', title: `Deposit cheque from ${cheque.buyerName}`, message: `Cheque ${cheque.chequeNumber ?? ''} · ${rs(Number(cheque.paymentAmount))}`,
          link: '/treasury?tab=cheques', tone: 'warning', dedupeKey: `cheque-in:${cheque.id}` });
      }
    }
    if (canDecide(person.role)) {
      for (const request of approvals.filter((r) => r.requestedBy !== person.id)) {
        items.push({ userId: person.id, type: 'approval', title: 'Waiting for your approval', message: `${request.summary} · ${rs(Number(request.amount))}`,
          link: '/approvals', tone: 'info', dedupeKey: `approval:${request.id}`, entityType: 'approval_request', entityId: request.id });
      }
    }
    if (can('sales:read')) {
      for (const booking of catches) {
        items.push({ userId: person.id, type: 'booking', title: `Catch for ${booking.buyerName} ${toIsoDate(booking.catchDate) <= asOf ? 'today' : 'tomorrow'}`,
          message: `${booking.expectedBirds.toLocaleString('en-US')} birds · ${booking.bookingCode}`, link: '/sales?tab=bookings', tone: 'info', dedupeKey: `booking:${booking.id}` });
      }
      for (const buyer of ageing.buyers.filter((b) => b.oldestDaysOverdue > 7)) {
        items.push({ userId: person.id, type: 'late_payer', title: `${buyer.buyerName} is paying late`, message: `${rs(buyer.totalOwed)} owed · ${buyer.oldestDaysOverdue} days overdue`,
          link: '/sales?tab=receivables', tone: buyer.oldestDaysOverdue > 30 ? 'danger' : 'warning', dedupeKey: `late:${buyer.buyerId}:${isoWeek(asOf)}` });
      }
    }
  }
  return notify(items);
}

/** Tell the requester how their approval request went. */
export async function notifyDecision(request: { id: number; requestedBy: number; summary: string; status: string; decisionNote: string | null; entityType: string }) {
  await notify([{
    userId: request.requestedBy, type: 'approval_decision',
    title: request.status === 'approved' ? 'Approved' : 'Not approved',
    message: `${request.summary}${request.decisionNote ? ` · ${request.decisionNote}` : ''}`,
    link: request.entityType === 'purchase_order' ? '/inventory?tab=purchase-orders' : '/treasury?tab=ledger',
    tone: request.status === 'approved' ? 'info' : 'warning', dedupeKey: `approval-decision:${request.id}`,
  }]);
}

export async function listNotifications(userId: number, limit = 40) {
  const [items, [unread]] = await Promise.all([
    db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt), desc(notifications.id)).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false))),
  ]);
  return { items, unread: unread?.count ?? 0 };
}

export async function markRead(userId: number, id?: number) {
  await db.update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false), id ? eq(notifications.id, id) : undefined));
}

/** Runs the generator now and then every 30 minutes (not in tests). */
export function startNotificationSchedule(intervalMs = 30 * 60 * 1000) {
  const run = () => generateNotifications().then((n) => n && logger.info('Notifications created', { count: n })).catch((error) => logger.error('Notification run failed', { error }));
  setTimeout(run, 10_000);
  return setInterval(run, intervalMs);
}
