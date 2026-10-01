import { db } from '../db';
import { batchHealthTasks } from '../db/schema';
import { requestApproval } from '../lib/approvals';
import { generateNotifications, listNotifications, markRead } from '../lib/notifications';
import { createSiteWithBatch, createUser, resetDatabase } from './fixtures';

beforeEach(async () => {
  await resetDatabase();
});

describe('notifications', () => {
  it('tells the right people once, and only about their own farm', async () => {
    const owner = await createUser({ userRole: 'system_admin' });
    const main = await createSiteWithBatch('Main Farm');
    const other = await createSiteWithBatch('Expansion 1');
    const manager = await createUser({ userRole: 'farm_manager', siteId: main.site.id });

    await db.insert(batchHealthTasks).values([
      { batchId: main.batch.id, dueDate: '2026-10-01', dayOfAge: 14, taskType: 'vaccine', name: 'Gumboro' },
      { batchId: other.batch.id, dueDate: '2026-09-28', dayOfAge: 10, taskType: 'vaccine', name: 'Newcastle' },
    ]);
    await requestApproval(db, { entityType: 'money_out', entityId: 1, amount: 75000, summary: 'Generator repair', requestedBy: manager.id });

    const created = await generateNotifications('2026-10-01');
    expect(created).toBeGreaterThan(0);
    // Running again adds nothing new
    expect(await generateNotifications('2026-10-01')).toBe(0);

    const mine = await listNotifications(manager.id);
    expect(mine.items.map((n) => n.title)).toEqual(['Gumboro due today']);

    const theirs = await listNotifications(owner.id);
    expect(theirs.items.map((n) => n.title).sort()).toEqual(['Gumboro due today', 'Newcastle overdue', 'Waiting for your approval'].sort());
    expect(theirs.items.find((n) => n.title === 'Newcastle overdue')?.tone).toBe('danger');
    expect(theirs.unread).toBe(3);

    await markRead(owner.id, theirs.items[0].id);
    expect((await listNotifications(owner.id)).unread).toBe(2);
    await markRead(owner.id);
    expect((await listNotifications(owner.id)).unread).toBe(0);
  });
});
