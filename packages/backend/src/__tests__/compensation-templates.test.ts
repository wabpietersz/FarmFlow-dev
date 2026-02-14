import request from 'supertest';
import app from '../app';

jest.mock('../lib/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock('../lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'leftJoin', 'insert', 'values', 'returning', 'update',
    'set', 'delete',
  ];
  for (const method of methods) {
    chain[method] = jest.fn();
  }
  for (const method of methods) {
    chain[method].mockImplementation(() => {
      const proxy = { ...chain, then: (resolve: (value: unknown) => void) => resolve(resolvedValue) };
      return proxy;
    });
  }
  return chain;
}

let dbChains: ReturnType<typeof createChainMock>[] = [];
let chainIndex = 0;

jest.mock('../db', () => {
  return {
    get db() {
      const handler: ProxyHandler<object> = {
        get(_target, prop: string) {
          if (['select', 'insert', 'update', 'delete'].includes(prop)) {
            const chain = dbChains[chainIndex] ?? dbChains[dbChains.length - 1];
            if (chainIndex < dbChains.length - 1) chainIndex += 1;
            return chain[prop];
          }
          return undefined;
        },
      };
      return new Proxy({}, handler);
    },
  };
});

import { firebaseAuth } from '../lib/firebase';

const mockVerifyIdToken = firebaseAuth.verifyIdToken as jest.Mock;

const accountant = {
  id: 4,
  firebaseUid: 'accountant-uid',
  email: 'accountant@farmflow.com',
  fullName: 'Accountant User',
  userRole: 'accountant',
  siteId: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const template = {
  id: 1,
  name: 'Transport',
  category: 'allowance',
  defaultAmount: '1500.00',
  description: 'Monthly transport allowance',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupAuth() {
  mockVerifyIdToken.mockResolvedValue({ uid: accountant.firebaseUid });
}

function setChains(...resolvedValues: unknown[]) {
  chainIndex = 0;
  dbChains = resolvedValues.map((value) => createChainMock(value));
}

function authedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  return request(app)[method](url).set('Authorization', 'Bearer valid-token');
}

describe('Compensation Template Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  it('GET /api/compensation-templates should list templates', async () => {
    setupAuth();
    setChains([accountant], [template]);

    const res = await authedRequest('get', '/api/compensation-templates');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/compensation-templates should create template', async () => {
    setupAuth();
    setChains([accountant], [template]);

    const res = await authedRequest('post', '/api/compensation-templates').send({
      name: 'Transport',
      category: 'allowance',
      defaultAmount: 1500,
    });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('PUT /api/compensation-templates/:id should update template', async () => {
    setupAuth();
    setChains([accountant], [{ id: 1 }], [{ ...template, name: 'Transport Updated' }]);

    const res = await authedRequest('put', '/api/compensation-templates/1').send({
      name: 'Transport Updated',
    });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('DELETE /api/compensation-templates/:id should soft delete template', async () => {
    setupAuth();
    setChains([accountant], [{ id: 1 }], [{ ...template, isActive: false }]);

    const res = await authedRequest('delete', '/api/compensation-templates/1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/compensation-templates should validate request body', async () => {
    setupAuth();
    setChains([accountant]);

    const res = await authedRequest('post', '/api/compensation-templates').send({
      category: 'allowance',
    });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
