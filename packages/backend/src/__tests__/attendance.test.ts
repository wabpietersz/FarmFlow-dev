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
let transactionFn: ((tx: unknown) => Promise<unknown>) | null = null;

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
              transactionFn = fn;
              // Create a mock tx that behaves like db
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

const farmWorker = {
  id: 6,
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

// Mock data
const mockShift = {
  id: 1,
  shiftName: 'Morning Shift',
  startTime: '06:00',
  endTime: '14:00',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockAttendance = {
  id: 1,
  employeeId: 1,
  attendanceDate: '2026-02-01',
  status: 'present',
  shiftId: 1,
  notes: null,
  recordedBy: 3,
  createdAt: new Date(),
};

const mockLeaveBalance = {
  id: 1,
  employeeId: 1,
  leaveType: 'casual',
  year: 2026,
  totalDays: 12,
  usedDays: 3,
  createdAt: new Date(),
  updatedAt: new Date(),
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

describe('Attendance Module Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
    transactionFn = null;
  });

  // ==================== SHIFTS ====================
  describe('Shift CRUD', () => {
    it('GET /api/shifts should list active shifts', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockShift]);

      const res = await authedRequest('get', '/api/shifts');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/shifts should create a shift', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [], [mockShift]);

      const res = await authedRequest('post', '/api/shifts').send({
        shiftName: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/shifts should reject duplicate shift name', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockShift]);

      const res = await authedRequest('post', '/api/shifts').send({
        shiftName: 'Morning Shift',
        startTime: '06:00',
        endTime: '14:00',
      });
      expect(res.status).toBe(409);
    });

    it('DELETE /api/shifts/:id should soft-delete', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockShift]);

      const res = await authedRequest('delete', '/api/shifts/1');
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Shift deactivated');
    });
  });

  // ==================== ATTENDANCE ====================
  describe('Attendance CRUD', () => {
    it('GET /api/attendance should list attendance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance], [{ total: 1 }]);

      const res = await authedRequest('get', '/api/attendance');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/attendance should fallback when leave_type column is missing', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance], [mockAttendance], [{ total: 1 }]);
      dbChains[1]!.select.mockImplementation(() => {
        throw { code: '42703', message: 'column attendance.leave_type does not exist' };
      });

      const res = await authedRequest('get', '/api/attendance');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/attendance should fallback when shifts relation is missing', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance], [mockAttendance], [{ total: 1 }]);
      dbChains[1]!.select.mockImplementation(() => {
        throw { code: '42P01', message: 'relation "shifts" does not exist' };
      });

      const res = await authedRequest('get', '/api/attendance');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/attendance/summary should return counts', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [{ totalPresent: 5, totalAbsent: 2, totalOnLeave: 1, totalHalfDay: 0, totalRecords: 8 }]);

      const res = await authedRequest('get', '/api/attendance/summary?startDate=2026-02-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/attendance/employees should return employee options for attendance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [{ id: 1, firstName: 'John', lastName: 'Doe', status: 'active', siteId: 1 }]);

      const res = await authedRequest('get', '/api/attendance/employees');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('POST /api/attendance should record attendance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [], [mockAttendance]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/attendance should fallback when leave_type column is missing', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [], [], [mockAttendance]);
      dbChains[2]!.insert.mockImplementation(() => {
        throw { code: '42703', message: 'column "leave_type" of relation "attendance" does not exist' };
      });

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(dbChains[3]!.returning).toHaveBeenCalledWith(expect.any(Object));
    });

    it('POST /api/attendance should fallback when shift_id column is missing', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [], [], [mockAttendance]);
      dbChains[2]!.insert.mockImplementation(() => {
        throw { code: '42703', message: 'column "shift_id" of relation "attendance" does not exist' };
      });

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(dbChains[3]!.returning).toHaveBeenCalledWith(expect.any(Object));
    });

    it('POST /api/attendance should reject duplicate', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(409);
    });

    it('POST /api/attendance should require leaveType for on_leave', async () => {
      setupAuth(supervisor);
      setChains([supervisor]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'on_leave',
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('POST /api/attendance should accept half_day with leaveType', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [], [mockAttendance]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'half_day',
        leaveType: 'casual',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/attendance/bulk should record bulk attendance', async () => {
      setupAuth(supervisor);
      // auth lookup, then for each record: duplicate check + insert
      setChains([supervisor], [], [mockAttendance]);

      const res = await authedRequest('post', '/api/attendance/bulk').send({
        attendanceDate: '2026-02-01',
        records: [{ employeeId: 1, status: 'present' }],
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/attendance/bulk should fallback when leave_type column is missing', async () => {
      setupAuth(supervisor);
      // auth, tx duplicate, tx insert (fails), fallback tx duplicate, fallback tx insert
      setChains([supervisor], [], [], [], [mockAttendance]);
      dbChains[2]!.insert.mockImplementation(() => {
        throw { code: '42703', message: 'column "leave_type" of relation "attendance" does not exist' };
      });

      const res = await authedRequest('post', '/api/attendance/bulk').send({
        attendanceDate: '2026-02-01',
        records: [{ employeeId: 1, status: 'present' }],
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(dbChains[4]!.returning).toHaveBeenCalledWith(expect.any(Object));
    });

    it('POST /api/attendance/bulk should fallback when shift_id column is missing', async () => {
      setupAuth(supervisor);
      // auth, tx duplicate, tx insert (fails), fallback tx duplicate, fallback tx insert
      setChains([supervisor], [], [], [], [mockAttendance]);
      dbChains[2]!.insert.mockImplementation(() => {
        throw { code: '42703', message: 'column "shift_id" of relation "attendance" does not exist' };
      });

      const res = await authedRequest('post', '/api/attendance/bulk').send({
        attendanceDate: '2026-02-01',
        records: [{ employeeId: 1, status: 'present' }],
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(dbChains[4]!.returning).toHaveBeenCalledWith(expect.any(Object));
    });

    it('PUT /api/attendance/:id should update attendance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance], [{ ...mockAttendance, status: 'absent' }]);

      const res = await authedRequest('put', '/api/attendance/1').send({
        status: 'absent',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('DELETE /api/attendance/:id should delete attendance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockAttendance]);

      const res = await authedRequest('delete', '/api/attendance/1');
      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Attendance record deleted');
    });

    it('DELETE /api/attendance/:id should return 404 for missing record', async () => {
      setupAuth(supervisor);
      setChains([supervisor], []);

      const res = await authedRequest('delete', '/api/attendance/999');
      expect(res.status).toBe(404);
    });
  });

  // ==================== LEAVE BALANCES ====================
  describe('Leave Balance CRUD', () => {
    it('GET /api/leave-balances should list balances', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockLeaveBalance]);

      const res = await authedRequest('get', '/api/leave-balances');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/leave-balances/:employeeId should get employee balances', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockLeaveBalance]);

      const res = await authedRequest('get', '/api/leave-balances/1');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/leave-balances should create balance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [{ id: 1 }], [], [mockLeaveBalance]);

      const res = await authedRequest('post', '/api/leave-balances').send({
        employeeId: 1,
        leaveType: 'casual',
        year: 2026,
        totalDays: 12,
      });
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('PUT /api/leave-balances/:id should update balance', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockLeaveBalance], [{ ...mockLeaveBalance, totalDays: 15 }]);

      const res = await authedRequest('put', '/api/leave-balances/1').send({
        totalDays: 15,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/leave-balances/bulk should create/update balances', async () => {
      setupAuth(supervisor);
      setChains([supervisor], [mockLeaveBalance]);

      const res = await authedRequest('post', '/api/leave-balances/bulk').send({
        year: 2026,
        balances: [
          { employeeId: 1, leaveType: 'casual', totalDays: 12.5 },
        ],
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/leave-balances/bulk should validate payload', async () => {
      setupAuth(supervisor);
      setChains([supervisor]);

      const res = await authedRequest('post', '/api/leave-balances/bulk').send({
        year: 2026,
        balances: [],
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==================== PERMISSIONS ====================
  describe('Permission Tests', () => {
    it('GET /api/attendance should require auth', async () => {
      const res = await request(app).get('/api/attendance');
      expect(res.status).toBe(401);
    });

    it('GET /api/shifts should require auth', async () => {
      const res = await request(app).get('/api/shifts');
      expect(res.status).toBe(401);
    });

    it('POST /api/attendance should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/attendance/employees should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/attendance/employees');
      expect(res.status).toBe(403);
    });

    it('GET /api/attendance should allow farm_manager (read permission)', async () => {
      setupAuth(farmManager);
      setChains([farmManager], [mockAttendance], [{ total: 1 }]);

      const res = await authedRequest('get', '/api/attendance');
      expect(res.status).toBe(200);
    });

    it('POST /api/attendance should return 403 for farm_worker (no attendance access by default)', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('post', '/api/attendance').send({
        employeeId: 1,
        attendanceDate: '2026-02-01',
        status: 'present',
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/attendance should return 403 for farm_worker by default', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/attendance');
      expect(res.status).toBe(403);
    });
  });
});
