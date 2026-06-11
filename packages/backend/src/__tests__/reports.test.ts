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

jest.mock('../lib/sales-ledger', () => ({
  getBuyerBalanceSummary: jest.fn(),
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
import { getBuyerBalanceSummary } from '../lib/sales-ledger';

const mockVerifyIdToken = firebaseAuth.verifyIdToken as jest.Mock;
const mockGetBuyerBalanceSummary = getBuyerBalanceSummary as jest.Mock;

// Test users
const systemAdmin = {
  id: 1,
  firebaseUid: 'admin-uid',
  email: 'admin@farmflow.com',
  fullName: 'System Admin',
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

describe('Reports & Enhanced Dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
    mockGetBuyerBalanceSummary.mockReset();
  });

  // ==================== AUTHENTICATION ====================
  describe('Authentication', () => {
    it('GET /api/reports/batch-comparison should require authentication', async () => {
      const res = await request(app).get('/api/reports/batch-comparison?batchIds=1,2');
      expect(res.status).toBe(401);
    });

    it('GET /api/reports/batch-profitability should require authentication', async () => {
      const res = await request(app).get('/api/reports/batch-profitability?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(401);
    });

    it('GET /api/reports/hr-analytics should require authentication', async () => {
      const res = await request(app).get('/api/reports/hr-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(401);
    });

    it('GET /api/reports/feed-analytics should require authentication', async () => {
      const res = await request(app).get('/api/reports/feed-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(401);
    });

    it('GET /api/dashboard/enhanced should require authentication', async () => {
      const res = await request(app).get('/api/dashboard/enhanced?period=7d');
      expect(res.status).toBe(401);
    });
  });

  // ==================== BATCH COMPARISON ====================
  describe('GET /api/reports/batch-comparison', () => {
    it('should return 400 if fewer than 2 batch IDs provided', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/reports/batch-comparison?batchIds=1');
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 400 if more than 6 batch IDs provided', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/reports/batch-comparison?batchIds=1,2,3,4,5,6,7');
      expect(res.status).toBe(400);
    });

    it('should return 400 if batchIds is missing', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/reports/batch-comparison');
      expect(res.status).toBe(400);
    });

    it('should return 200 with valid batch IDs for viewer (has reports:read)', async () => {
      setupAuth(viewer);
      // Chain 1: auth middleware - user lookup
      // Chain 2: batch data
      // Chain 3: daily records for batch curves
      setChains(
        [viewer],
        [
          { id: 1, batchCode: 'B-001', siteId: 1, siteName: 'Site A', chicksPlaced: 1000, currentBirdCount: 950, status: 'active', placementDate: '2026-01-01' },
          { id: 2, batchCode: 'B-002', siteId: 1, siteName: 'Site A', chicksPlaced: 2000, currentBirdCount: 1900, status: 'active', placementDate: '2026-01-05' },
        ],
        [],  // daily records (empty - no curves data)
      );

      const res = await authedRequest('get', '/api/reports/batch-comparison?batchIds=1,2');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for farm_worker (no reports:read)', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/reports/batch-comparison?batchIds=1,2');
      expect(res.status).toBe(403);
    });
  });

  // ==================== BATCH PROFITABILITY ====================
  describe('GET /api/reports/batch-profitability', () => {
    it('should return 403 for viewer (no reports:financial:read)', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/reports/batch-profitability?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(403);
    });

    it('should return 403 for farm_worker (no reports:financial:read)', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/reports/batch-profitability?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(403);
    });

    it('should return 200 for accountant (has reports:financial:read)', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],  // auth
        [],            // batch query (empty result)
        [],            // sales query
        [],            // daily records (feed)
        [],            // feed inventory (cost)
        [],            // payroll cost
      );

      const res = await authedRequest('get', '/api/reports/batch-profitability?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 200 for system_admin (has reports:*)', async () => {
      setupAuth(systemAdmin);
      setChains(
        [systemAdmin],
        [],
        [],
        [],
        [],
        [],
      );

      const res = await authedRequest('get', '/api/reports/batch-profitability?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/reports/financial-overview', () => {
    it('should return treasury-first cash metrics for accountant', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{ salesRevenue: 150000 }],
        [{
          treasuryInflows: 90000,
          treasuryOutflows: 35000,
          customerReceiptInflows: 90000,
          payrollOutflows: 20000,
          supplierPaymentOutflows: 12000,
          pettyCashNet: -3000,
        }],
        [{
          transactionId: 11,
          transactionCode: 'TRX-20260401-001',
          transactionType: 'customer_receipt',
          transactionDate: '2026-04-01',
          status: 'posted',
          counterpartyName: 'Fresh Mart',
          netAmount: 90000,
          accountNames: 'Main Bank',
          sourceModule: 'sales',
          sourceEntityType: 'buyer_receipt_line',
          sourceEntityId: 44,
          sourceCodeSnapshot: 'RCT-20260401-001',
        }],
      );

      const res = await authedRequest('get', '/api/reports/financial-overview?startDate=2026-04-01&endDate=2026-04-30');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.salesRevenue).toBe(150000);
      expect(res.body.data.treasuryInflows).toBe(90000);
      expect(res.body.data.treasuryOutflows).toBe(35000);
      expect(res.body.data.netCashMovement).toBe(55000);
      expect(res.body.data.recentTransactions[0].sourceCodeSnapshot).toBe('RCT-20260401-001');
    });
  });

  describe('New treasury-linked summary reports', () => {
    it('GET /api/reports/buyer-outstanding-advance-summary should return buyer ledger summary rows', async () => {
      setupAuth(accountant);
      mockGetBuyerBalanceSummary
        .mockResolvedValueOnce({
          totalSales: 1000,
          totalReceiptsCompleted: 700,
          totalAppliedToSales: 650,
          outstandingBalance: 350,
          advanceCredit: 50,
          netBalance: 300,
        })
        .mockResolvedValueOnce({
          totalSales: 400,
          totalReceiptsCompleted: 500,
          totalAppliedToSales: 400,
          outstandingBalance: 0,
          advanceCredit: 100,
          netBalance: -100,
        });
      setChains(
        [accountant],
        [
          { buyerId: 1, buyerName: 'Fresh Mart' },
          { buyerId: 2, buyerName: 'Agri Foods' },
        ],
      );

      const res = await authedRequest('get', '/api/reports/buyer-outstanding-advance-summary');
      expect(res.status).toBe(200);
      expect(res.body.data.totals.outstandingBalance).toBe(350);
      expect(res.body.data.totals.advanceCredit).toBe(150);
      expect(res.body.data.rows).toHaveLength(2);
    });

    it('GET /api/reports/payroll-disbursement-summary should return treasury payroll rows', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{
          payrollId: 4,
          employeeId: 9,
          employeeName: 'Jane Worker',
          payPeriod: '2026-04-01',
          paidDate: '2026-04-15',
          amount: '25000.00',
          financeAccountId: 3,
          financeAccountName: 'Payroll Bank',
          paymentMethod: 'cheque',
          chequeLeafId: 22,
          chequeNumber: '000122',
          treasuryTransactionId: 99,
          treasuryTransactionCode: 'TRX-20260415-001',
          treasuryStatus: 'posted',
          transactionDate: '2026-04-15',
        }],
      );

      const res = await authedRequest('get', '/api/reports/payroll-disbursement-summary?startDate=2026-04-01&endDate=2026-04-30');
      expect(res.status).toBe(200);
      expect(res.body.data.totals.totalDisbursed).toBe(25000);
      expect(res.body.data.rows[0].financeAccountName).toBe('Payroll Bank');
      expect(res.body.data.rows[0].chequeNumber).toBe('000122');
    });

    it('GET /api/reports/petty-cash-outstanding-summary should return allocation outstanding rows', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{
          allocationId: 7,
          allocationCode: 'PCA-20260401-001',
          allocationDate: '2026-04-01',
          allocatedToUserId: 2,
          allocatedToName: 'Farm Manager',
          siteId: 1,
          siteName: 'North Farm',
          sourceFinanceAccountId: 3,
          pettyCashAccountId: 8,
          allocatedAmount: '10000.00',
          status: 'allocated',
          treasuryTransactionId: 51,
          approvedExpenseAmount: 3500,
          submittedExpenseAmount: 1500,
        }],
        [
          { id: 3, accountName: 'Cash Office' },
          { id: 8, accountName: 'Farm Manager Float' },
        ],
      );

      const res = await authedRequest('get', '/api/reports/petty-cash-outstanding-summary');
      expect(res.status).toBe(200);
      expect(res.body.data.totals.totalOutstanding).toBe(6500);
      expect(res.body.data.rows[0].pettyCashAccountName).toBe('Farm Manager Float');
    });

    it('GET /api/reports/supplier-payment-summary should return treasury supplier payment rows', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],
        [{
          supplierPaymentId: 12,
          paymentCode: 'SPY-20260404-001',
          paymentDate: '2026-04-04',
          supplierId: 2,
          supplierName: 'Feed Supplier',
          purchaseOrderId: 5,
          purchaseOrderCode: 'PO-20260401-001',
          amount: '18000.00',
          paymentMethod: 'bank_transfer',
          paymentStatus: 'completed',
          financeAccountId: 6,
          financeAccountName: 'Operations Bank',
          referenceNumber: 'REF-88',
          chequeNumber: null,
          treasuryTransactionId: 71,
          treasuryReversalTransactionId: null,
          treasuryTransactionCode: 'TRX-20260404-003',
          treasuryStatus: 'posted',
          transactionDate: '2026-04-04',
        }],
      );

      const res = await authedRequest('get', '/api/reports/supplier-payment-summary?startDate=2026-04-01&endDate=2026-04-30');
      expect(res.status).toBe(200);
      expect(res.body.data.totals.totalDisbursed).toBe(18000);
      expect(res.body.data.rows[0].purchaseOrderCode).toBe('PO-20260401-001');
      expect(res.body.data.rows[0].financeAccountName).toBe('Operations Bank');
    });
  });

  // ==================== HR ANALYTICS ====================
  describe('GET /api/reports/hr-analytics', () => {
    it('should return 200 for viewer (has reports:read)', async () => {
      setupAuth(viewer);
      setChains(
        [viewer],   // auth
        [],         // attendance by month
        [],         // attendance by employee
        [],         // leave utilization
        [],         // payroll by month
        [],         // overtime by month
      );

      const res = await authedRequest('get', '/api/reports/hr-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for farm_worker (no reports:read)', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/reports/hr-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(403);
    });

    it('should return 200 for farm_manager (has reports:*)', async () => {
      setupAuth(farmManager);
      setChains(
        [farmManager],
        [],
        [],
        [],
        [],
        [],
      );

      const res = await authedRequest('get', '/api/reports/hr-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==================== FEED ANALYTICS ====================
  describe('GET /api/reports/feed-analytics', () => {
    it('should return 200 for viewer (has reports:read)', async () => {
      setupAuth(viewer);
      setChains(
        [viewer],   // auth
        [],         // FCR by batch
        [],         // feed cost per bird
        [],         // inventory turnover
        [],         // production efficiency
      );

      const res = await authedRequest('get', '/api/reports/feed-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should return 403 for farm_worker (no reports:read)', async () => {
      setupAuth(farmWorker);
      setChains([farmWorker]);

      const res = await authedRequest('get', '/api/reports/feed-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(403);
    });

    it('should return 200 for system_admin', async () => {
      setupAuth(systemAdmin);
      setChains(
        [systemAdmin],
        [],
        [],
        [],
        [],
      );

      const res = await authedRequest('get', '/api/reports/feed-analytics?startDate=2026-01-01&endDate=2026-02-01');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==================== ENHANCED DASHBOARD ====================
  describe('GET /api/dashboard/enhanced', () => {
    it('should return 200 with default period for system_admin', async () => {
      setupAuth(systemAdmin);
      // The enhanced dashboard does many queries:
      // auth, existing summary queries (batches, fcr, mortality, payments, employees, sales),
      // then additional: mortality sparkline, sales sparkline, fcr trend, feed inventory, payroll, attendance
      setChains(
        [systemAdmin],         // auth
        [{ count: 3 }],        // active batches
        [{ avgFcr: 1.85 }],   // avg FCR
        [{ total: 15 }],      // mortality
        [{ total: '5000.00' }], // outstanding payments
        [{ count: 10 }],      // employees
        [{ count: 5, totalAmount: '25000.00' }], // recent sales
        // Enhanced additions
        [                      // mortality sparkline
          { day: '2026-02-01', total: 2 },
          { day: '2026-02-02', total: 1 },
        ],
        [{ count: 3, totalAmount: '15000.00' }], // sales previous period
        [{ avgFcr: 1.90 }],   // FCR previous period
        [{ totalItems: 10, lowStockItems: 2, totalValue: '50000.00' }], // feed inventory status
        [{ count: 3, totalAmount: '8000.00' }], // pending payroll
        [{ present: 8, total: 10 }], // attendance today
      );

      const res = await authedRequest('get', '/api/dashboard/enhanced?period=7d');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should accept different period values', async () => {
      setupAuth(systemAdmin);
      setChains(
        [systemAdmin],
        [{ count: 0 }],
        [{ avgFcr: null }],
        [{ total: 0 }],
        [{ total: '0' }],
        [{ count: 0 }],
        [{ count: 0, totalAmount: '0' }],
        [],
        [{ count: 0, totalAmount: '0' }],
        [{ avgFcr: null }],
        [{ totalItems: 0, lowStockItems: 0, totalValue: '0' }],
        [{ count: 0, totalAmount: '0' }],
        [{ present: 0, total: 0 }],
      );

      const res30d = await authedRequest('get', '/api/dashboard/enhanced?period=30d');
      expect(res30d.status).toBe(200);
    });

    it('should return 200 for viewer', async () => {
      setupAuth(viewer);
      setChains(
        [viewer],
        [{ count: 0 }],
        [{ avgFcr: null }],
        [{ total: 0 }],
        [{ total: '0' }],
        [{ count: 0 }],
        [{ count: 0, totalAmount: '0' }],
        [],
        [{ count: 0, totalAmount: '0' }],
        [{ avgFcr: null }],
        [{ totalItems: 0, lowStockItems: 0, totalValue: '0' }],
        [{ count: 0, totalAmount: '0' }],
        [{ present: 0, total: 0 }],
      );

      const res = await authedRequest('get', '/api/dashboard/enhanced?period=ytd');
      expect(res.status).toBe(200);
    });
  });

  // ==================== CSV EXPORT ====================
  describe('GET /api/reports/export/csv', () => {
    it('should return 400 for invalid report type', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/reports/export/csv?type=invalid-type');
      expect(res.status).toBe(400);
    });
  });
});
