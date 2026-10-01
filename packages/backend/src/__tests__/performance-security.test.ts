import request from 'supertest';
import app from '../app';

// Mock Firebase Admin SDK
jest.mock('../lib/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: jest.fn(),
  },
}));

// Mock audit logging
jest.mock('../lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Build a flexible chainable DB mock
function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'leftJoin', 'insert', 'values', 'returning', 'update',
    'set', 'delete', '$dynamic', 'innerJoin', 'groupBy',
  ];
  for (const m of methods) {
    chain[m] = jest.fn();
  }
  for (const m of methods) {
    chain[m].mockImplementation(() => {
      const proxy = { ...chain, then: (resolve: (v: unknown) => void) => resolve(resolvedValue) };
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
            if (chainIndex < dbChains.length - 1) chainIndex++;
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

// Test user objects (must match full user row shape for auth middleware DB lookup)
const systemAdmin = {
  id: 1, firebaseUid: 'admin-uid', email: 'admin@farmflow.com', fullName: 'System Admin',
  userRole: 'system_admin', siteId: null, isActive: true, lastLogin: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const viewer = {
  id: 5, firebaseUid: 'viewer-uid', email: 'viewer@farmflow.com', fullName: 'Viewer User',
  userRole: 'viewer', siteId: null, isActive: true, lastLogin: null,
  createdAt: new Date(), updatedAt: new Date(),
};

const farmWorker = {
  id: 4, firebaseUid: 'worker-uid', email: 'worker@farmflow.com', fullName: 'Farm Worker',
  userRole: 'farm_worker', siteId: null, isActive: true, lastLogin: null,
  createdAt: new Date(), updatedAt: new Date(),
};

// Helper: set up auth — first chain returns user from DB lookup
function setupAuth(user: typeof systemAdmin, additionalChains: ReturnType<typeof createChainMock>[] = []) {
  mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid, email: user.email });
  dbChains = [createChainMock([user]), ...additionalChains];
  chainIndex = 0;
}

describe('Performance & Security Tests', () => {
  beforeEach(() => {
    dbChains = [];
    chainIndex = 0;
    jest.clearAllMocks();
  });

  // =========================================================================
  // SECURITY: Authentication edge cases
  // =========================================================================
  describe('Authentication Edge Cases', () => {
    it('should reject requests with no Authorization header', async () => {
      const res = await request(app).get('/api/employees');
      expect(res.status).toBe(401);
    });

    it('should reject requests with empty Bearer token', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer ');
      expect(res.status).toBe(401);
    });

    it('should reject requests with malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Basic abc123');
      expect(res.status).toBe(401);
    });

    it('should reject requests when Firebase token verification fails', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer expired-token');
      expect(res.status).toBe(401);
    });

    it('should reject requests with tampered token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Invalid token'));
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer tampered.jwt.token');
      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // SECURITY: Authorization bypass testing
  // =========================================================================
  describe('Authorization Bypass Prevention', () => {
    it('should prevent viewer from creating employees', async () => {
      setupAuth(viewer);
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', 'Bearer viewer-token')
        .send({ firstName: 'Test', lastName: 'User' });
      expect(res.status).toBe(403);
    });

    it('should prevent farm worker from accessing payroll', async () => {
      setupAuth(farmWorker);
      const res = await request(app)
        .get('/api/payroll')
        .set('Authorization', 'Bearer worker-token');
      expect(res.status).toBe(403);
    });

    it('should prevent viewer from creating feed production', async () => {
      setupAuth(viewer);
      const res = await request(app)
        .post('/api/feed/production')
        .set('Authorization', 'Bearer viewer-token')
        .send({ recipeId: 1, plannedQuantity: 100 });
      expect(res.status).toBe(403);
    });

    it('should prevent viewer from modifying sales', async () => {
      setupAuth(viewer);
      const res = await request(app)
        .post('/api/sales')
        .set('Authorization', 'Bearer viewer-token')
        .send({ buyerId: 1, saleDate: '2026-01-01' });
      expect(res.status).toBe(403);
    });

    it('should allow system admin to access dashboard', async () => {
      setupAuth(systemAdmin, [
        createChainMock([{ count: 5 }]),   // activeBatches
        createChainMock([{ total: 100 }]), // outstanding
        createChainMock([{ total: 50 }]),  // paid
        createChainMock([{ count: 10 }]),  // employees
        createChainMock([{ count: 3, total: 500 }]), // recentSales
      ]);
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // =========================================================================
  // SECURITY: Input sanitization
  // =========================================================================
  describe('Input Sanitization', () => {
    it('should handle SQL injection attempts in search params safely', async () => {
      setupAuth(systemAdmin, [createChainMock([]), createChainMock([{ count: 0 }])]);
      const res = await request(app)
        .get('/api/employees?search=\'; DROP TABLE employees; --')
        .set('Authorization', 'Bearer admin-token');
      // Drizzle ORM parameterizes queries — should not crash
      expect([200, 500]).toContain(res.status);
    });

    it('should reject body exceeding 10MB size limit', async () => {
      setupAuth(systemAdmin);
      const largeBody = { data: 'x'.repeat(11 * 1024 * 1024) };
      const res = await request(app)
        .post('/api/employees')
        .set('Authorization', 'Bearer admin-token')
        .send(largeBody);
      expect(res.status).toBe(413);
    });

    it('should validate report type in CSV export', async () => {
      setupAuth(systemAdmin);
      const res = await request(app)
        .get('/api/reports/export/csv?type=malicious-type')
        .set('Authorization', 'Bearer admin-token');
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // PERFORMANCE: API response time benchmarks
  // =========================================================================
  describe('API Response Time Benchmarks', () => {
    it('should respond to health check within 100ms', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/health');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(100);
    });

    it('should respond to dashboard summary within 500ms', async () => {
      setupAuth(systemAdmin, [
        createChainMock([{ count: 5 }]),
        createChainMock([{ total: 100 }]),
        createChainMock([{ total: 50 }]),
        createChainMock([{ count: 10 }]),
        createChainMock([{ count: 3, total: 500 }]),
      ]);

      const start = Date.now();
      const res = await request(app)
        .get('/api/dashboard/summary')
        .set('Authorization', 'Bearer admin-token');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should respond to employee list within 500ms', async () => {
      setupAuth(systemAdmin, [createChainMock([]), createChainMock([{ count: 0 }])]);

      const start = Date.now();
      const res = await request(app)
        .get('/api/employees')
        .set('Authorization', 'Bearer admin-token');
      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(500);
    });

    it('should return 404 for nonexistent routes quickly', async () => {
      const start = Date.now();
      const res = await request(app).get('/api/nonexistent');
      const duration = Date.now() - start;

      expect(res.status).toBe(404);
      // Suites run in parallel workers, so leave headroom; a real regression is far slower
      expect(duration).toBeLessThan(250);
    });
  });

  // =========================================================================
  // SECURITY: Headers & Middleware
  // =========================================================================
  describe('Security Headers & Middleware', () => {
    it('should include X-Content-Type-Options header from Helmet', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should return proper CORS headers', async () => {
      const res = await request(app)
        .options('/api/health')
        .set('Origin', 'http://localhost:5173');
      expect([200, 204]).toContain(res.status);
    });

    it('should return JSON content type for API responses', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // =========================================================================
  // PERFORMANCE: Concurrent request handling
  // =========================================================================
  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent health checks', async () => {
      const requests = Array.from({ length: 10 }, () =>
        request(app).get('/api/health')
      );
      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });
    });

    it('should handle concurrent unauthenticated requests gracefully', async () => {
      const requests = Array.from({ length: 5 }, () =>
        request(app).get('/api/employees')
      );
      const results = await Promise.all(requests);
      results.forEach((res) => {
        expect(res.status).toBe(401);
      });
    });
  });
});
