import request from 'supertest';
import type { Express } from 'express';
import { createEmployee, createSale, createSiteWithBatch, createUser, resetDatabase } from './fixtures';

const mockVerifyIdToken = jest.fn();
jest.mock('../lib/firebase', () => ({ firebaseAuth: { verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args) } }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const app: Express = require('../app').default;

const get = (path: string) => request(app).get(path).set('Authorization', 'Bearer t');

describe('farm-scoped users', () => {
  let mine: Awaited<ReturnType<typeof createSiteWithBatch>>;
  let other: Awaited<ReturnType<typeof createSiteWithBatch>>;

  beforeAll(async () => {
    await resetDatabase();
    mine = await createSiteWithBatch('Main Farm');
    other = await createSiteWithBatch('Expansion 1');
    const manager = await createUser({ firebaseUid: 'manager-main', userRole: 'farm_manager', siteId: mine.site.id });
    mockVerifyIdToken.mockResolvedValue({ uid: manager.firebaseUid });
  });

  it('only see their own farm in lists', async () => {
    const sites = await get('/api/sites/list');
    expect(sites.status).toBe(200);
    expect(sites.body.data.map((s: { id: number }) => s.id)).toEqual([mine.site.id]);

    const batchList = await get('/api/batches');
    expect(batchList.body.data.map((b: { id: number }) => b.id)).toEqual([mine.batch.id]);
  });

  it('cannot open or change another farm’s records by id', async () => {
    expect((await get(`/api/batches/${mine.batch.id}`)).status).toBe(200);
    expect((await get(`/api/batches/${other.batch.id}`)).status).toBe(403);
    expect((await get(`/api/farm/batches/${other.batch.id}/today`)).status).toBe(403);
    expect((await get(`/api/sites/${other.site.id}/cages`)).status).toBe(403);

    const otherWorker = await createEmployee(other.site.id, other.centre.id);
    expect((await get(`/api/employees/${otherWorker.id}`)).status).toBe(403);

    const { sale } = await createSale(other.batch.id, 1000);
    expect((await get(`/api/sales/${sale.id}`)).status).toBe(403);

    const create = await request(app).post('/api/batches').set('Authorization', 'Bearer t')
      .send({ batchCode: 'X-1', siteId: other.site.id, cageId: other.cage.id, placementDate: '2026-10-01', chicksPlaced: 100 });
    expect(create.status).toBe(403);
  });
});
