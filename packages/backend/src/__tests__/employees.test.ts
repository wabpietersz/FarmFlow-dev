import request from 'supertest';
import app from '../app';

// Mock Firebase Admin SDK
jest.mock('../lib/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: jest.fn(),
  },
}));

// Mock audit logging (fire-and-forget)
jest.mock('../lib/audit', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

// Build a flexible chainable DB mock
function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'leftJoin', 'insert', 'values', 'returning', 'update',
    'set', 'delete',
  ];
  for (const m of methods) {
    chain[m] = jest.fn();
  }
  // Every method returns the chain, except terminal ones resolve
  for (const m of methods) {
    chain[m].mockImplementation(() => {
      // Make the chain thenable (for await)
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

// Test users
const adminUser = {
  id: 1,
  firebaseUid: 'admin-uid',
  email: 'admin@farmflow.com',
  fullName: 'Admin User',
  userRole: 'system_admin',
  siteId: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const farmManager = {
  id: 2,
  firebaseUid: 'manager-uid',
  email: 'manager@farmflow.com',
  fullName: 'Farm Manager',
  userRole: 'farm_manager',
  siteId: 1,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const farmWorker = {
  id: 3,
  firebaseUid: 'worker-uid',
  email: 'worker@farmflow.com',
  fullName: 'Farm Worker',
  userRole: 'farm_worker',
  siteId: 1,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockEmployee = {
  id: 10,
  userId: null,
  firstName: 'John',
  lastName: 'Doe',
  designation: 'Supervisor',
  siteId: 1,
  employmentType: 'permanent',
  joinDate: '2024-01-15',
  status: 'active',
  phone: '+27123456789',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helpers
function setupAuth(user: { firebaseUid: string; [key: string]: unknown }) {
  mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
  // The authenticate middleware does: db.select().from().where().limit()
  // This is the first DB chain call in each request
}

function setChains(...resolvedValues: unknown[]) {
  chainIndex = 0;
  dbChains = resolvedValues.map((v) => createChainMock(v));
}

function authedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  return request(app)[method](url).set('Authorization', 'Bearer valid-token');
}

describe('Employee Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  // ------------------------------------------------------------------
  // Authentication & Authorization
  // ------------------------------------------------------------------
  describe('Authentication & Authorization', () => {
    it('GET /api/employees should require authentication', async () => {
      const res = await request(app).get('/api/employees');
      expect(res.status).toBe(401);
    });

    it('POST /api/employees should require authentication', async () => {
      const res = await request(app).post('/api/employees').send({
        firstName: 'Test',
        lastName: 'User',
        designation: 'Worker',
        siteId: 1,
        employmentType: 'permanent',
        joinDate: '2024-01-01',
      });
      expect(res.status).toBe(401);
    });

    it('GET /api/employees should return 403 for farm_worker (no employees:read)', async () => {
      setupAuth(farmWorker);
      // chain 1: authenticate middleware select user
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/employees');
      expect(res.status).toBe(403);
    });

    it('GET /api/employees should return 200 for system_admin', async () => {
      setupAuth(adminUser);
      // chain 1: authenticate -> user lookup
      // chain 2: count query
      // chain 3: rows query
      setChains([adminUser], [{ count: 0 }], []);

      const res = await authedRequest('get', '/api/employees');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/employees — paginated list
  // ------------------------------------------------------------------
  describe('GET /api/employees', () => {
    it('should return paginated employee list', async () => {
      setupAuth(adminUser);
      setChains(
        [adminUser],           // auth middleware
        [{ count: 1 }],        // count query
        [{ ...mockEmployee, siteName: 'Main Farm' }], // rows
      );

      const res = await authedRequest('get', '/api/employees');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
      expect(res.body.totalPages).toBe(1);
    });

    it('should return empty list with totalPages=0 when no employees', async () => {
      setupAuth(adminUser);
      setChains([adminUser], [{ count: 0 }], []);

      const res = await authedRequest('get', '/api/employees');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.total).toBe(0);
      expect(res.body.totalPages).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // GET /api/employees/:id — detail
  // ------------------------------------------------------------------
  describe('GET /api/employees/:id', () => {
    it('should return employee detail with contacts and bank info', async () => {
      setupAuth(adminUser);
      const contacts = [{ id: 1, employeeId: 10, contactName: 'Jane', relationship: 'Spouse', phoneNumber: '+27111' }];
      const bank = { id: 1, employeeId: 10, accountHolderName: 'John', bankName: 'FNB', accountNumber: '123', branchCode: '250655', ifscCode: null };

      setChains(
        [adminUser],       // auth
        [mockEmployee],    // employee lookup
        contacts,          // emergency contacts
        [bank],            // bank details
      );

      const res = await authedRequest('get', '/api/employees/10');
      expect(res.status).toBe(200);
      expect(res.body.data.employee.firstName).toBe('John');
      expect(res.body.data.emergencyContacts).toHaveLength(1);
      expect(res.body.data.bankDetails).toBeDefined();
    });

    it('should return 404 for non-existent employee', async () => {
      setupAuth(adminUser);
      setChains([adminUser], []);

      const res = await authedRequest('get', '/api/employees/999');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('EMPLOYEE_NOT_FOUND');
    });

    it('should return 400 for invalid id', async () => {
      setupAuth(adminUser);
      setChains([adminUser]);

      const res = await authedRequest('get', '/api/employees/abc');
      expect(res.status).toBe(400);
    });

    it('should return 403 if farm manager accesses employee from different site', async () => {
      setupAuth(farmManager);
      const otherSiteEmployee = { ...mockEmployee, siteId: 99 };

      setChains(
        [farmManager],         // auth
        [otherSiteEmployee],   // employee from different site
      );

      const res = await authedRequest('get', '/api/employees/10');
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });
  });

  // ------------------------------------------------------------------
  // POST /api/employees — create
  // ------------------------------------------------------------------
  describe('POST /api/employees', () => {
    const validPayload = {
      firstName: 'Jane',
      lastName: 'Smith',
      designation: 'Farm Worker',
      siteId: 1,
      employmentType: 'permanent',
      joinDate: '2024-06-01',
    };

    it('should create employee and return 201', async () => {
      setupAuth(adminUser);
      const newEmployee = { ...mockEmployee, id: 11, firstName: 'Jane', lastName: 'Smith' };

      setChains(
        [adminUser],        // auth
        [{ id: 1 }],        // site verification
        [newEmployee],       // insert returning
      );

      const res = await authedRequest('post', '/api/employees').send(validPayload);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Jane');
    });

    it('should return 400 for missing required fields', async () => {
      setupAuth(adminUser);
      setChains([adminUser]);

      const res = await authedRequest('post', '/api/employees').send({
        firstName: 'Test',
      });
      expect(res.status).toBe(400);
    });

    it('should return 400 for invalid site ID', async () => {
      setupAuth(adminUser);
      setChains([adminUser], []);  // site verification returns empty

      const res = await authedRequest('post', '/api/employees').send(validPayload);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('INVALID_SITE');
    });

    it('should return 403 for farm_worker trying to create', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('post', '/api/employees').send(validPayload);
      expect(res.status).toBe(403);
    });
  });

  // ------------------------------------------------------------------
  // PUT /api/employees/:id — update
  // ------------------------------------------------------------------
  describe('PUT /api/employees/:id', () => {
    it('should update employee and return 200', async () => {
      setupAuth(adminUser);
      const updated = { ...mockEmployee, firstName: 'Updated' };

      setChains(
        [adminUser],       // auth
        [mockEmployee],    // existing employee lookup
        [updated],         // update returning
      );

      const res = await authedRequest('put', '/api/employees/10').send({
        firstName: 'Updated',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent employee', async () => {
      setupAuth(adminUser);
      setChains([adminUser], []);

      const res = await authedRequest('put', '/api/employees/999').send({
        firstName: 'Updated',
      });
      expect(res.status).toBe(404);
    });
  });

  // ------------------------------------------------------------------
  // DELETE /api/employees/:id — soft delete
  // ------------------------------------------------------------------
  describe('DELETE /api/employees/:id', () => {
    it('should soft-delete (terminate) employee', async () => {
      setupAuth(adminUser);
      const terminated = { ...mockEmployee, status: 'terminated' };

      setChains(
        [adminUser],       // auth
        [mockEmployee],    // existing employee lookup
        [terminated],      // update returning
      );

      const res = await authedRequest('delete', '/api/employees/10');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 for non-existent employee', async () => {
      setupAuth(adminUser);
      setChains([adminUser], []);

      const res = await authedRequest('delete', '/api/employees/999');
      expect(res.status).toBe(404);
    });
  });
});
