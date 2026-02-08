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

// Mock data
const mockBuyer = {
  id: 1,
  buyerName: 'Fresh Mart',
  contactPerson: 'John Buyer',
  phoneNumber: '+27123456789',
  email: 'john@freshmart.com',
  address: '123 Market St',
  creditTerms: 30,
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockBatch = {
  id: 1,
  batchCode: 'BATCH-S1-C1-20260201',
  siteId: 1,
  cageId: 1,
  chicksPlaced: 1000,
  status: 'ready_for_sale',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSale = {
  id: 1,
  saleCode: 'SALE-20260201-001',
  batchId: 1,
  buyerId: 1,
  saleDate: '2026-02-01',
  totalBirds: 500,
  pricePerBird: '25.00',
  totalAmount: '12500.00',
  status: 'pending',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPayment = {
  id: 1,
  saleId: 1,
  paymentAmount: '5000.00',
  paymentDate: '2026-02-01',
  paymentMethod: 'cash',
  chequeNumber: null,
  chequeDate: null,
  bankName: null,
  paymentStatus: 'completed',
  notes: null,
  recordedBy: 4,
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

describe('Sales Module Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  // ==================== AUTHENTICATION ====================
  describe('Authentication & Authorization', () => {
    it('GET /api/buyers should require authentication', async () => {
      const res = await request(app).get('/api/buyers');
      expect(res.status).toBe(401);
    });

    it('GET /api/sales should require authentication', async () => {
      const res = await request(app).get('/api/sales');
      expect(res.status).toBe(401);
    });

    it('POST /api/buyers should return 403 for viewer (no sales:create)', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/buyers').send({
        buyerName: 'Test Buyer',
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/buyers should return 200 for viewer (has sales:read)', async () => {
      setupAuth(viewer);
      setChains([viewer], [], [{ total: 0 }]);

      const res = await authedRequest('get', '/api/buyers');
      expect(res.status).toBe(200);
    });

    it('POST /api/sales should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/sales').send({
        batchId: 1,
        buyerId: 1,
        saleDate: '2026-02-01',
        totalBirds: 500,
        pricePerBird: 25,
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/buyers should return 201 for accountant', async () => {
      setupAuth(accountant);
      setChains(
        [accountant],     // auth
        [],               // unique check (no existing)
        [mockBuyer],      // insert returning
      );

      const res = await authedRequest('post', '/api/buyers').send({
        buyerName: 'Fresh Mart',
        contactPerson: 'John Buyer',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // ==================== BUYER CRUD ====================
  describe('Buyer Routes', () => {
    describe('GET /api/buyers', () => {
      it('should return paginated buyer list', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockBuyer],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/buyers');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });
    });

    describe('GET /api/buyers/:id', () => {
      it('should return buyer detail with sales history', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockBuyer],       // buyer lookup
          [mockSale],        // sales history
        );

        const res = await authedRequest('get', '/api/buyers/1');
        expect(res.status).toBe(200);
        expect(res.body.data.buyer.buyerName).toBe('Fresh Mart');
        expect(res.body.data.salesHistory).toHaveLength(1);
      });

      it('should return 404 for non-existent buyer', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('get', '/api/buyers/999');
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/buyers', () => {
      it('should return 409 for duplicate buyer name', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockBuyer],  // existing buyer found
        );

        const res = await authedRequest('post', '/api/buyers').send({
          buyerName: 'Fresh Mart',
        });
        expect(res.status).toBe(409);
        expect(res.body.code).toBe('BUYER_NAME_EXISTS');
      });

      it('should return 400 for missing buyer name', async () => {
        setupAuth(accountant);
        setChains([accountant]);

        const res = await authedRequest('post', '/api/buyers').send({});
        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/buyers/:id', () => {
      it('should update buyer', async () => {
        setupAuth(accountant);
        const updated = { ...mockBuyer, contactPerson: 'Jane' };
        setChains(
          [accountant],
          [mockBuyer],   // existing lookup
          [updated],     // update returning
        );

        const res = await authedRequest('put', '/api/buyers/1').send({
          contactPerson: 'Jane',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent buyer', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('put', '/api/buyers/999').send({
          contactPerson: 'Jane',
        });
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/buyers/:id', () => {
      it('should deactivate buyer', async () => {
        setupAuth(accountant);
        const deactivated = { ...mockBuyer, status: 'inactive' };
        setChains(
          [accountant],
          [mockBuyer],    // existing lookup
          [],             // no pending sales
          [deactivated],  // update returning
        );

        const res = await authedRequest('delete', '/api/buyers/1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 400 when buyer has pending sales', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockBuyer],        // existing lookup
          [{ id: 1 }],       // has pending sale
        );

        const res = await authedRequest('delete', '/api/buyers/1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BUYER_HAS_PENDING_SALES');
      });

      it('should return 404 for non-existent buyer', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('delete', '/api/buyers/999');
        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== SALE CRUD ====================
  describe('Sale Routes', () => {
    describe('GET /api/sales', () => {
      it('should return paginated sales list', async () => {
        setupAuth(accountant);
        const saleWithNames = { ...mockSale, buyerName: 'Fresh Mart', batchCode: 'BATCH-001' };
        setChains(
          [accountant],
          [saleWithNames],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/sales');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });
    });

    describe('GET /api/sales/:id', () => {
      it('should return sale detail with buyer, payments, and outstanding balance', async () => {
        setupAuth(accountant);
        const saleDetail = { ...mockSale, buyerName: 'Fresh Mart', batchCode: 'BATCH-001', siteName: 'Main Farm' };
        setChains(
          [accountant],
          [saleDetail],      // sale lookup with joins
          [mockBuyer],       // buyer
          [mockPayment],     // payments list
        );

        const res = await authedRequest('get', '/api/sales/1');
        expect(res.status).toBe(200);
        expect(res.body.data.sale.saleCode).toBe('SALE-20260201-001');
        expect(res.body.data.buyer.buyerName).toBe('Fresh Mart');
        expect(res.body.data.payments).toHaveLength(1);
        expect(res.body.data.totalPaid).toBe(5000);
        expect(res.body.data.outstandingBalance).toBe(7500);
      });

      it('should return 404 for non-existent sale', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('get', '/api/sales/999');
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/sales', () => {
      const validPayload = {
        batchId: 1,
        buyerId: 1,
        saleDate: '2026-02-01',
        totalBirds: 500,
        pricePerBird: 25,
      };

      it('should create sale with auto-generated code', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],     // auth
          [mockBatch],      // batch lookup
          [mockBuyer],      // buyer lookup
          [{ count: 0 }],   // sale count for code gen
          [mockSale],       // insert returning
        );

        const res = await authedRequest('post', '/api/sales').send(validPayload);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should return 400 for non-existent batch', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [],  // batch not found
        );

        const res = await authedRequest('post', '/api/sales').send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BATCH_NOT_FOUND');
      });

      it('should return 400 if batch is not ready for sale', async () => {
        setupAuth(accountant);
        const placementBatch = { ...mockBatch, status: 'placement' };
        setChains(
          [accountant],
          [placementBatch],
        );

        const res = await authedRequest('post', '/api/sales').send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BATCH_NOT_READY');
      });

      it('should return 400 for non-existent buyer', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockBatch],   // batch exists
          [],            // buyer not found
        );

        const res = await authedRequest('post', '/api/sales').send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BUYER_NOT_FOUND');
      });

      it('should return 400 for inactive buyer', async () => {
        setupAuth(accountant);
        const inactiveBuyer = { ...mockBuyer, status: 'inactive' };
        setChains(
          [accountant],
          [mockBatch],
          [inactiveBuyer],
        );

        const res = await authedRequest('post', '/api/sales').send(validPayload);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('BUYER_INACTIVE');
      });

      it('should return 400 for missing required fields', async () => {
        setupAuth(accountant);
        setChains([accountant]);

        const res = await authedRequest('post', '/api/sales').send({
          batchId: 1,
        });
        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/sales/:id', () => {
      it('should update sale status', async () => {
        setupAuth(accountant);
        const completed = { ...mockSale, status: 'completed' };
        setChains(
          [accountant],
          [mockSale],    // existing lookup
          [completed],   // update returning
        );

        const res = await authedRequest('put', '/api/sales/1').send({
          status: 'completed',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 400 when cancelling sale with completed payments', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],        // existing lookup
          [{ id: 1 }],      // completed payment exists
        );

        const res = await authedRequest('put', '/api/sales/1').send({
          status: 'cancelled',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALE_HAS_PAYMENTS');
      });

      it('should return 404 for non-existent sale', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('put', '/api/sales/999').send({
          status: 'completed',
        });
        expect(res.status).toBe(404);
      });
    });

    describe('DELETE /api/sales/:id', () => {
      it('should soft delete sale', async () => {
        setupAuth(accountant);
        const cancelled = { ...mockSale, status: 'cancelled' };
        setChains(
          [accountant],
          [mockSale],     // existing
          [],             // no payments
          [cancelled],    // update returning
        );

        const res = await authedRequest('delete', '/api/sales/1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 400 when sale has payments', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],       // existing
          [{ id: 1 }],     // has payment
        );

        const res = await authedRequest('delete', '/api/sales/1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALE_HAS_PAYMENTS');
      });

      it('should return 404 for non-existent sale', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('delete', '/api/sales/999');
        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== PAYMENT OPERATIONS ====================
  describe('Payment Routes', () => {
    describe('POST /api/sales/:saleId/payments', () => {
      const validPayment = {
        paymentAmount: 5000,
        paymentDate: '2026-02-01',
        paymentMethod: 'cash',
      };

      it('should add payment to sale', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],         // sale lookup
          [{ total: 0 }],    // no previous payments
          [mockPayment],     // insert returning
        );

        const res = await authedRequest('post', '/api/sales/1/payments').send(validPayment);
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent sale', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [],   // sale not found
        );

        const res = await authedRequest('post', '/api/sales/999/payments').send(validPayment);
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('SALE_NOT_FOUND');
      });

      it('should return 400 when payment exceeds outstanding balance', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],            // sale: totalAmount = 12500
          [{ total: 12000 }],   // already paid 12000, outstanding = 500
        );

        const res = await authedRequest('post', '/api/sales/1/payments').send({
          ...validPayment,
          paymentAmount: 1000,  // exceeds 500 outstanding
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PAYMENT_EXCEEDS_BALANCE');
      });

      it('should return 400 for non-pending sale', async () => {
        setupAuth(accountant);
        const completedSale = { ...mockSale, status: 'completed' };
        setChains(
          [accountant],
          [completedSale],
        );

        const res = await authedRequest('post', '/api/sales/1/payments').send(validPayment);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALE_NOT_PENDING');
      });

      it('should return 400 for cheque payment without cheque number', async () => {
        setupAuth(accountant);
        setChains([accountant]);

        const res = await authedRequest('post', '/api/sales/1/payments').send({
          paymentAmount: 5000,
          paymentDate: '2026-02-01',
          paymentMethod: 'cheque',
          // missing chequeNumber and chequeDate
        });
        expect(res.status).toBe(400);
      });

      it('should return 403 for viewer trying to create payment', async () => {
        setupAuth(viewer);
        setChains([viewer]);

        const res = await authedRequest('post', '/api/sales/1/payments').send(validPayment);
        expect(res.status).toBe(403);
      });
    });

    describe('PUT /api/payments/:id', () => {
      it('should update payment status', async () => {
        setupAuth(accountant);
        const updatedPayment = { ...mockPayment, paymentStatus: 'bounced' };
        const saleForRecalc = { ...mockSale, status: 'pending' };
        setChains(
          [accountant],
          [mockPayment],       // existing payment
          [updatedPayment],    // update returning
          [saleForRecalc],     // sale for recalculation
          [{ total: 0 }],     // recalculate paid total
        );

        const res = await authedRequest('put', '/api/payments/1').send({
          paymentStatus: 'bounced',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent payment', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('put', '/api/payments/999').send({
          paymentStatus: 'completed',
        });
        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/payments', () => {
      it('should return paginated payment list', async () => {
        setupAuth(accountant);
        const paymentWithSale = { ...mockPayment, saleCode: 'SALE-20260201-001' };
        setChains(
          [accountant],
          [paymentWithSale],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/payments');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });
    });
  });
});
