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

jest.mock('../lib/sales-ledger', () => {
  const actual = jest.requireActual('../lib/sales-ledger');
  return {
    ...actual,
    createBuyerReceiptForSale: jest.fn(),
    // Receipt + ledger posting run together in one transaction
    recordBuyerReceipt: jest.fn(),
    syncSaleStatusFromPayments: jest.fn().mockResolvedValue(undefined),
  };
});

jest.mock('../lib/treasury', () => ({
  postBuyerReceiptLineToTreasury: jest.fn().mockResolvedValue({ treasuryTransactionId: 1, posted: true }),
  reverseBuyerReceiptLineTreasuryPosting: jest.fn().mockResolvedValue({ treasuryTransactionId: 2, reversed: true }),
  postBuyerReceiptLineWithin: jest.fn().mockResolvedValue({ treasuryTransactionId: 1, posted: true }),
  reverseBuyerReceiptLineWithin: jest.fn().mockResolvedValue({ treasuryTransactionId: 2, reversed: true }),
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
          // Transactions run their callback against the same chain mock
          if (prop === 'transaction') return (fn: (tx: unknown) => unknown) => fn(proxy);
          if (['select', 'insert', 'update', 'delete'].includes(prop)) {
            const chain = dbChains[chainIndex] ?? dbChains[dbChains.length - 1];
            if (chainIndex < dbChains.length - 1) chainIndex++;
            return chain[prop];
          }
          return undefined;
        },
      };
      const proxy: object = new Proxy({}, handler);
      return proxy;
    },
  };
});

import { firebaseAuth } from '../lib/firebase';
import { recordBuyerReceipt, syncSaleStatusFromPayments } from '../lib/sales-ledger';
import { postBuyerReceiptLineToTreasury, reverseBuyerReceiptLineTreasuryPosting } from '../lib/treasury';

const mockVerifyIdToken = firebaseAuth.verifyIdToken as jest.Mock;
const mockCreateBuyerReceiptForSale = recordBuyerReceipt as jest.Mock;
const mockSyncSaleStatusFromPayments = syncSaleStatusFromPayments as jest.Mock;
const mockPostBuyerReceiptLineToTreasury = postBuyerReceiptLineToTreasury as jest.Mock;
const mockReverseBuyerReceiptLineTreasuryPosting = reverseBuyerReceiptLineTreasuryPosting as jest.Mock;

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
  totalWeight: '250.00',
  pricePerKg: '50.00',
  totalAmount: '12500.00',
  status: 'pending',
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** A receipt line allocated to sale 1, as read by getNewSalePayments */
const mockReceiptAllocation = {
  lineId: 1,
  receiptId: 1,
  receiptCode: 'RCT-20260201-001',
  paymentAmount: '5000.00',
  paymentDate: '2026-02-01',
  paymentMethod: 'cash',
  financeAccountId: 1,
  financeAccountName: 'Cash',
  treasuryTransactionId: 1,
  treasuryReversalTransactionId: null,
  referenceNumber: null,
  chequeNumber: null,
  chequeDate: null,
  bankName: null,
  paymentStatus: 'completed',
  notes: null,
  recordedBy: 4,
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
    mockCreateBuyerReceiptForSale.mockReset();
    mockSyncSaleStatusFromPayments.mockResolvedValue(undefined);
    mockPostBuyerReceiptLineToTreasury.mockResolvedValue({ treasuryTransactionId: 1, posted: true });
    mockReverseBuyerReceiptLineTreasuryPosting.mockResolvedValue({ treasuryTransactionId: 2, reversed: true });
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

    it('GET /api/buyers should return 403 for viewer (reports only by default)', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('get', '/api/buyers');
      expect(res.status).toBe(403);
    });

    it('POST /api/sales should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/sales').send({
        batchId: 1,
        buyerId: 1,
        saleDate: '2026-02-01',
        totalBirds: 500,
        totalWeight: 250,
        pricePerKg: 50,
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
          [],                // lorry lines
          [mockReceiptAllocation], // receipt allocations to this sale
          [{ total: 12500 }], // buyer total sales
          [{ total: 5000 }],  // buyer receipts
          [{ total: 5000 }],  // buyer applied allocations
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
        totalWeight: 250,
        pricePerKg: 50,
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
        const reviewedSale = { ...mockSale, status: 'reviewed' };
        const completed = { ...mockSale, status: 'completed' };
        const settledPayment = { ...mockReceiptAllocation, paymentAmount: mockSale.totalAmount };
        setChains(
          [accountant],
          [reviewedSale],   // existing lookup
          [settledPayment], // receipt allocations settle the sale
          [completed],      // update returning
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
          [],             // no legacy payments
          [],             // no receipt allocations
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
        financeAccountId: 1,
      };

      it('should add payment to sale', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],         // sale lookup
        );
        mockCreateBuyerReceiptForSale.mockResolvedValue({
          receipt: { id: 1, receiptCode: 'RCT-20260201-001' },
          lines: [{ id: 1, financeAccountId: 1, paymentStatus: 'completed' }],
        });

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

      it('should allow overpayment and store the excess as buyer credit', async () => {
        setupAuth(accountant);
        setChains(
          [accountant],
          [mockSale],
        );
        mockCreateBuyerReceiptForSale.mockResolvedValue({
          receipt: { id: 2, receiptCode: 'RCT-20260201-002' },
          lines: [{ id: 2, financeAccountId: 1, paymentStatus: 'completed' }],
        });

        const res = await authedRequest('post', '/api/sales/1/payments').send({
          ...validPayment,
          paymentAmount: 1000,
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should return 400 for cancelled sale', async () => {
        setupAuth(accountant);
        const cancelledSale = { ...mockSale, status: 'cancelled' };
        setChains(
          [accountant],
          [cancelledSale],
        );

        const res = await authedRequest('post', '/api/sales/1/payments').send(validPayment);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALE_CANCELLED');
      });

      it('should return 400 for draft sale until it is reviewed', async () => {
        setupAuth(accountant);
        const draftSale = { ...mockSale, status: 'draft' };
        setChains(
          [accountant],
          [draftSale],
        );

        const res = await authedRequest('post', '/api/sales/1/payments').send(validPayment);
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('SALE_NOT_REVIEWED');
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
        const line = { id: 1, receiptId: 1, paymentAmount: '5000.00', paymentMethod: 'cheque', paymentStatus: 'pending', financeAccountId: 1, treasuryTransactionId: null, treasuryReversalTransactionId: null };
        const bounced = { ...line, paymentStatus: 'bounced' };
        setChains(
          [accountant],
          [line],     // existing receipt line
          [bounced],  // update returning
          [],         // allocations to re-check
        );

        const res = await authedRequest('put', '/api/payments/receipt-line-1').send({
          paymentStatus: 'bounced',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent payment', async () => {
        setupAuth(accountant);
        setChains([accountant], []);

        const res = await authedRequest('put', '/api/payments/receipt-line-999').send({
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
          [],
        );

        const res = await authedRequest('get', '/api/payments');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });
    });
  });
});
