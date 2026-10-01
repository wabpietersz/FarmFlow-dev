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
    'set', 'delete', '$dynamic', 'innerJoin',
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
          if (prop === 'transaction') {
            return async (fn: (tx: unknown) => Promise<unknown>) => {
              const txProxy = new Proxy({}, {
                get(_t, txProp: string) {
                  if (['select', 'insert', 'update', 'delete'].includes(txProp)) {
                    const chain = dbChains[chainIndex] ?? dbChains[dbChains.length - 1];
                    if (chainIndex < dbChains.length - 1) chainIndex++;
                    return chain[txProp];
                  }
                  return undefined;
                },
              });
              return fn(txProxy);
            };
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

const supervisor = {
  id: 3,
  firebaseUid: 'supervisor-uid',
  email: 'supervisor@farmflow.com',
  fullName: 'Supervisor User',
  userRole: 'supervisor',
  siteId: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const viewer = {
  id: 5,
  firebaseUid: 'viewer-uid',
  email: 'viewer@farmflow.com',
  fullName: 'Viewer User',
  userRole: 'viewer',
  siteId: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock data
const mockPayroll = {
  id: 1,
  employeeId: 1,
  payPeriod: '2026-02-01',
  baseSalary: '15000.00',
  workingDays: 22,
  attendedDays: 20,
  overtimeHours: '5.00',
  overtimeRate: '100.00',
  grossSalary: '14136.36',
  netSalary: '14136.36',
  status: 'draft',
  approvedBy: null,
  paidDate: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDeduction = {
  id: 1,
  payrollId: 1,
  deductionType: 'Tax',
  amount: '1500.00',
  remarks: null,
};

const mockAllowance = {
  id: 1,
  payrollId: 1,
  allowanceType: 'HRA',
  amount: '2000.00',
  remarks: null,
};

const mockEmployee = {
  id: 1,
  firstName: 'Test',
  lastName: 'Employee',
  status: 'active',
  siteId: 1,
};

// Helpers
function setupAuth(user: { firebaseUid: string; [key: string]: unknown }) {
  mockVerifyIdToken.mockResolvedValue({ uid: user.firebaseUid });
}

function setChains(...resolvedValues: unknown[]) {
  chainIndex = 0;
  dbChains = resolvedValues.map((v) => createChainMock(v));
}

function authedRequest(method: 'get' | 'post' | 'put' | 'delete', url: string) {
  return request(app)[method](url).set('Authorization', 'Bearer valid-token');
}

describe('Payroll Module Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  // ==================== PAYROLL CRUD ====================
  describe('Payroll CRUD', () => {
    it('GET /api/payroll should list payroll records', async () => {
      setupAuth(accountant);
      setChains([accountant], [mockPayroll], [{ total: 1 }]);

      const res = await authedRequest('get', '/api/payroll');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/payroll/:id should return payroll detail', async () => {
      setupAuth(accountant);
      setChains([accountant], [mockPayroll], [mockDeduction], [mockAllowance]);

      const res = await authedRequest('get', '/api/payroll/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deductions).toBeDefined();
      expect(res.body.data.allowances).toBeDefined();
    });

    it('GET /api/payroll/:id should return 404 for missing', async () => {
      setupAuth(accountant);
      setChains([accountant], []);

      const res = await authedRequest('get', '/api/payroll/999');
      expect(res.status).toBe(404);
    });

    it('POST /api/payroll should create draft payroll', async () => {
      setupAuth(accountant);
      // auth, employee check, existing payroll check, attendance count, insert
      setChains([accountant], [mockEmployee], [], [{ present: 20, halfDays: 2 }], [mockPayroll]);

      const res = await authedRequest('post', '/api/payroll').send({
        employeeId: 1,
        payPeriod: '2026-02-01',
        baseSalary: 15000,
        workingDays: 22,
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/payroll should store decimal attendedDays for half-day precision', async () => {
      setupAuth(accountant);
      setChains([accountant], [mockEmployee], [], [{ present: 20, halfDays: 1 }], [mockPayroll]);

      const res = await authedRequest('post', '/api/payroll').send({
        employeeId: 1,
        payPeriod: '2026-02-01',
        baseSalary: 15000,
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      const insertChain = dbChains.find((chain) => chain.values.mock.calls.length > 0);
      const insertedValues = insertChain?.values.mock.calls[0]?.[0] as { attendedDays: string };
      expect(insertedValues.attendedDays).toBe('19.5');
    });

    it('POST /api/payroll should return 409 when payroll already exists in same month', async () => {
      setupAuth(accountant);
      setChains([accountant], [mockEmployee], [{ id: 9 }]);

      const res = await authedRequest('post', '/api/payroll').send({
        employeeId: 1,
        payPeriod: '2026-02-15',
        baseSalary: 15000,
        workingDays: 22,
      });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('PAYROLL_ALREADY_EXISTS');
    });

    it('POST /api/payroll should return 404 for missing employee', async () => {
      setupAuth(accountant);
      setChains([accountant], []);

      const res = await authedRequest('post', '/api/payroll').send({
        employeeId: 999,
        payPeriod: '2026-02-01',
        baseSalary: 15000,
        workingDays: 22,
      });
      expect(res.status).toBe(404);
    });

    it('POST /api/payroll/generate should generate payroll for active employees', async () => {
      setupAuth(accountant);
      // auth, active employees, existing payroll check, revisions, components, attendance, insert
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [{
          id: 10,
          employeeId: 1,
          payType: 'monthly',
          baseRate: '15000.00',
          overtimeRate: '100.00',
          standardHoursPerDay: '8.00',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          isActive: true,
        }],
        [],
        [{ present: 20, halfDays: 2 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/payroll/generate should calculate monthly baseSalary from compensation', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [{
          id: 20,
          employeeId: 1,
          payType: 'monthly',
          baseRate: '25000.00',
          overtimeRate: '120.00',
          standardHoursPerDay: '8.00',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          isActive: true,
        }],
        [],
        [{ present: 20, halfDays: 2 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      const insertedValues = dbChains[6]!.values.mock.calls[0]?.[0] as { baseSalary: string };
      expect(insertedValues.baseSalary).toBe('25000.00');
    });

    it('POST /api/payroll/generate should calculate daily baseSalary from compensation', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [{
          id: 21,
          employeeId: 1,
          payType: 'daily',
          baseRate: '1000.00',
          overtimeRate: '75.00',
          standardHoursPerDay: '8.00',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          isActive: true,
        }],
        [],
        [{ present: 22, halfDays: 0 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      const insertedValues = dbChains[6]!.values.mock.calls[0]?.[0] as { baseSalary: string };
      expect(insertedValues.baseSalary).toBe('22000.00');
    });

    it('POST /api/payroll/generate should calculate hourly baseSalary from compensation', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [{
          id: 22,
          employeeId: 1,
          payType: 'hourly',
          baseRate: '100.00',
          overtimeRate: '60.00',
          standardHoursPerDay: '8.00',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          isActive: true,
        }],
        [],
        [{ present: 22, halfDays: 0 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      const insertedValues = dbChains[6]!.values.mock.calls[0]?.[0] as { baseSalary: string };
      expect(insertedValues.baseSalary).toBe('17600.00');
    });

    it('POST /api/payroll/generate should allow manual-style generation without compensation and return warnings', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [],
        [{ present: 20, halfDays: 0 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      expect(res.body.total).toBe(1);
      expect(res.body.meta.employeesWithoutCompensation).toBe(1);
      expect(res.body.meta.skipped).toBe(0);
      expect(res.body.meta.warningCount).toBeGreaterThan(0);
    });

    it('POST /api/payroll/generate should populate overtimeRate from compensation', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [{
          id: 23,
          employeeId: 1,
          payType: 'monthly',
          baseRate: '25000.00',
          overtimeRate: '135.50',
          standardHoursPerDay: '8.00',
          effectiveFrom: '2026-01-01',
          effectiveTo: null,
          isActive: true,
        }],
        [],
        [{ present: 20, halfDays: 0 }],
        [mockPayroll],
      );

      const res = await authedRequest('post', '/api/payroll/generate').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(201);
      const insertedValues = dbChains[6]!.values.mock.calls[0]?.[0] as { overtimeRate: string | null };
      expect(insertedValues.overtimeRate).toBe('135.50');
    });

    it('POST /api/payroll/generate/precheck should return structured warnings', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ id: 1, firstName: 'Test', lastName: 'Employee' }],
        [],
        [],
      );

      const res = await authedRequest('post', '/api/payroll/generate/precheck').send({
        payPeriod: '2026-02-01',
        workingDays: 22,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.totalEmployees).toBe(1);
      expect(res.body.data.summary.warningEmployees).toBe(1);
      expect(res.body.data.checks[0].warnings[0].code).toBe('MISSING_COMPENSATION');
    });

    it('PUT /api/payroll/:id should update draft payroll', async () => {
      setupAuth(accountant);
      setChains([accountant], [mockPayroll], [{ ...mockPayroll, notes: 'Updated' }], [{ ...mockPayroll, notes: 'Updated' }]);

      const res = await authedRequest('put', '/api/payroll/1').send({
        notes: 'Updated',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('PUT /api/payroll/:id should reject update on approved payroll', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'approved' }]);

      const res = await authedRequest('put', '/api/payroll/1').send({
        notes: 'Updated',
      });
      expect(res.status).toBe(400);
    });

    it('DELETE /api/payroll/:id should delete draft payroll', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ id: 1, employeeId: 1, status: 'draft' }], []);

      const res = await authedRequest('delete', '/api/payroll/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/payroll/:id should reject delete on non-draft payroll', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ id: 1, employeeId: 1, status: 'approved' }]);

      const res = await authedRequest('delete', '/api/payroll/1');
      expect(res.status).toBe(400);
    });

    it('DELETE /api/payroll/:id should return 404 when payroll is missing', async () => {
      setupAuth(accountant);
      setChains([accountant], []);

      const res = await authedRequest('delete', '/api/payroll/999');
      expect(res.status).toBe(404);
    });
  });

  // ==================== STATUS WORKFLOW ====================
  describe('Payroll Status Workflow', () => {
    it('should transition draft → reviewed', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'draft' }], [{ ...mockPayroll, status: 'reviewed' }]);

      const res = await authedRequest('put', '/api/payroll/1/status').send({ status: 'reviewed' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should transition reviewed → approved', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'reviewed' }], [{ ...mockPayroll, status: 'approved' }]);

      const res = await authedRequest('put', '/api/payroll/1/status').send({ status: 'approved' });
      expect(res.status).toBe(200);
    });

    it('should transition approved → paid', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ ...mockPayroll, status: 'approved' }],
        [{
          id: 1,
          payPeriod: '2026-02-01',
          netSalary: '14136.36',
          status: 'approved',
          treasuryTransactionId: null,
          employeeId: 1,
          employeeName: 'Test Employee',
          employeeCostCentreId: 2,
          employeeSiteId: 1,
        }],
        [],
        [{ id: 1, accountType: 'bank', status: 'active' }],
        [{ count: 0 }],
        [{ id: 99 }],
        [{ id: 17, code: 'wages_salaries', name: 'Wages & Salaries', categoryType: 'expense', status: 'active' }],
        [{ id: 2, status: 'active', name: 'Main Farm' }],
        [],
        [],
        [],
        [{ ...mockPayroll, status: 'paid', financeAccountId: 1, treasuryTransactionId: 99 }],
      );

      const res = await authedRequest('put', '/api/payroll/1/status').send({ status: 'paid', financeAccountId: 1 });
      expect(res.status).toBe(200);
    });

    it('should reject backward transition (reviewed → draft)', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'reviewed' }]);

      const res = await authedRequest('put', '/api/payroll/1/status').send({ status: 'draft' });
      expect(res.status).toBe(400);
    });

    it('should reject skipping steps (draft → approved)', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'draft' }]);

      const res = await authedRequest('put', '/api/payroll/1/status').send({ status: 'approved' });
      expect(res.status).toBe(400);
    });
  });

  // ==================== DEDUCTIONS & ALLOWANCES ====================
  describe('Deductions & Allowances', () => {
    it('POST /api/payroll/:id/deductions should add deduction', async () => {
      setupAuth(accountant);
      // auth, payroll check, insert, recalc (select payroll, sum allowances, sum deductions, update)
      setChains(
        [accountant], [mockPayroll], [mockDeduction],
        [mockPayroll], [{ total: '2000.00' }], [{ total: '1500.00' }],
      );

      const res = await authedRequest('post', '/api/payroll/1/deductions').send({
        deductionType: 'Tax',
        amount: 1500,
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/payroll/:id/deductions should reject on approved payroll', async () => {
      setupAuth(accountant);
      setChains([accountant], [{ ...mockPayroll, status: 'approved' }]);

      const res = await authedRequest('post', '/api/payroll/1/deductions').send({
        deductionType: 'Tax',
        amount: 1500,
      });
      expect(res.status).toBe(400);
    });

    it('DELETE /api/payroll/:id/deductions/:deductionId should remove deduction', async () => {
      setupAuth(accountant);
      setChains(
        [accountant], [mockPayroll],
        [mockPayroll], [{ total: '2000.00' }], [{ total: '0' }],
      );

      const res = await authedRequest('delete', '/api/payroll/1/deductions/1');
      expect(res.status).toBe(200);
    });

    it('POST /api/payroll/:id/allowances should add allowance', async () => {
      setupAuth(accountant);
      setChains(
        [accountant], [mockPayroll], [mockAllowance],
        [mockPayroll], [{ total: '2000.00' }], [{ total: '1500.00' }],
      );

      const res = await authedRequest('post', '/api/payroll/1/allowances').send({
        allowanceType: 'HRA',
        amount: 2000,
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/payroll/:id/allowances/:allowanceId should remove allowance', async () => {
      setupAuth(accountant);
      setChains(
        [accountant], [mockPayroll],
        [mockPayroll], [{ total: '0' }], [{ total: '1500.00' }],
      );

      const res = await authedRequest('delete', '/api/payroll/1/allowances/1');
      expect(res.status).toBe(200);
    });
  });

  // ==================== PERMISSIONS ====================
  describe('Permission Tests', () => {
    it('GET /api/payroll should require auth', async () => {
      const res = await request(app).get('/api/payroll');
      expect(res.status).toBe(401);
    });

    it('POST /api/payroll should return 403 for supervisor (no payroll:create)', async () => {
      setupAuth(supervisor);
      setChains([supervisor]);

      const res = await authedRequest('post', '/api/payroll').send({
        employeeId: 1,
        payPeriod: '2026-02-01',
        baseSalary: 15000,
        workingDays: 22,
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/payroll should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/payroll');
      expect(res.status).toBe(403);
    });

    it('DELETE /api/payroll/:id should return 403 for supervisor (no payroll:delete)', async () => {
      setupAuth(supervisor);
      setChains([supervisor]);

      const res = await authedRequest('delete', '/api/payroll/1');
      expect(res.status).toBe(403);
    });
  });
});
