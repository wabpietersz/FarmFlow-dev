import request from 'supertest';
import app from '../app';

jest.mock('../lib/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: jest.fn(),
  },
}));

function createChainMock(resolvedValue: unknown = []) {
  const chain: Record<string, jest.Mock> = {};
  const methods = [
    'select', 'from', 'where', 'limit', 'offset', 'orderBy',
    'leftJoin', 'insert', 'values', 'returning', 'update',
    'set', 'delete', '$dynamic', 'innerJoin',
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

jest.mock('../db', () => ({
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
}));

jest.mock('../lib/treasury', () => ({
  createChequeBook: jest.fn(),
  createFinanceReconciliation: jest.fn(),
  createManualTreasuryTransaction: jest.fn(),
  createOperationalExpense: jest.fn(),
  createPettyCashAllocation: jest.fn(),
  getFinanceAccountBalance: jest.fn(),
  listPendingBuyerChequeReceipts: jest.fn(),
  listBouncedBuyerChequeReceipts: jest.fn(),
  listFinanceAccountsWithBalances: jest.fn(),
  reviewOperationalExpense: jest.fn(),
  reviewPettyCashExpense: jest.fn(),
  settleOperationalExpense: jest.fn(),
  submitPettyCashExpense: jest.fn(),
  updateChequeLeafStatus: jest.fn(),
}));

import { firebaseAuth } from '../lib/firebase';
import {
  createFinanceReconciliation,
  createManualTreasuryTransaction,
  createOperationalExpense,
  listBouncedBuyerChequeReceipts,
  listPendingBuyerChequeReceipts,
  reviewOperationalExpense,
  settleOperationalExpense,
} from '../lib/treasury';

const mockVerifyIdToken = firebaseAuth.verifyIdToken as jest.Mock;
const mockCreateManualTreasuryTransaction = createManualTreasuryTransaction as jest.Mock;
const mockCreateOperationalExpense = createOperationalExpense as jest.Mock;
const mockReviewOperationalExpense = reviewOperationalExpense as jest.Mock;
const mockSettleOperationalExpense = settleOperationalExpense as jest.Mock;
const mockCreateFinanceReconciliation = createFinanceReconciliation as jest.Mock;
const mockListPendingBuyerChequeReceipts = listPendingBuyerChequeReceipts as jest.Mock;
const mockListBouncedBuyerChequeReceipts = listBouncedBuyerChequeReceipts as jest.Mock;

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

function setupAuth() {
  mockVerifyIdToken.mockResolvedValue({ uid: accountant.firebaseUid });
}

function setChains(...resolvedValues: unknown[]) {
  chainIndex = 0;
  dbChains = resolvedValues.map((value) => createChainMock(value));
}

function authedRequest(method: 'get' | 'post', url: string) {
  return request(app)[method](url).set('Authorization', 'Bearer valid-token');
}

describe('Treasury Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  it('GET /api/treasury/cheques/overview should return outgoing, pending incoming, and bounced incoming groups', async () => {
    setupAuth();
    setChains(
      [accountant],
      [{
        id: 1,
        chequeNumber: '000101',
        financeAccountId: 3,
        accountName: 'Operations Current',
        status: 'issued',
        issueDate: '2026-04-01',
        clearDate: null,
        amount: '18000.00',
        payeeName: 'Feed Supplier',
        sourceModule: 'inventory',
        sourceEntityType: 'supplier_payment',
        sourceEntityId: 21,
        treasuryTransactionId: 88,
      }],
    );
    mockListPendingBuyerChequeReceipts.mockResolvedValue([
      {
        id: 'receipt-line-5',
        receiptCode: 'RCT-20260401-001',
        buyerName: 'Fresh Mart',
        receiptDate: '2026-04-01',
        paymentAmount: 9000,
        financeAccountId: 3,
        financeAccountName: 'Operations Current',
        chequeNumber: 'CHK-55',
        bankName: 'ABC Bank',
        paymentStatus: 'pending',
      },
    ]);
    mockListBouncedBuyerChequeReceipts.mockResolvedValue([
      {
        id: 'receipt-line-6',
        receiptCode: 'RCT-20260402-001',
        buyerName: 'Fresh Mart',
        receiptDate: '2026-04-02',
        paymentAmount: 5000,
        financeAccountId: 3,
        financeAccountName: 'Operations Current',
        chequeNumber: 'CHK-56',
        bankName: 'ABC Bank',
        paymentStatus: 'bounced',
        treasuryTransactionId: 91,
        treasuryReversalTransactionId: 92,
      },
    ]);

    const res = await authedRequest('get', '/api/treasury/cheques/overview');
    expect(res.status).toBe(200);
    expect(res.body.data.outgoingCheques).toHaveLength(1);
    expect(res.body.data.pendingIncomingReceipts).toHaveLength(1);
    expect(res.body.data.bouncedIncomingReceipts).toHaveLength(1);
    expect(res.body.data.bouncedIncomingReceipts[0].treasuryReversalTransactionId).toBe(92);
  });

  it('POST /api/treasury/transactions/manual should create a manual treasury transaction', async () => {
    setupAuth();
    setChains([accountant]);
    mockCreateManualTreasuryTransaction.mockResolvedValue({
      id: 44,
      transactionCode: 'TRX-20260404-001',
      transactionType: 'manual_inflow',
      transactionDate: '2026-04-04',
      status: 'posted',
    });

    const res = await authedRequest('post', '/api/treasury/transactions/manual').send({
      transactionDate: '2026-04-04',
      transactionType: 'manual_inflow',
      financeAccountId: 3,
      amount: 2500,
      narrative: 'Cash top-up',
    });

    expect(res.status).toBe(201);
    expect(mockCreateManualTreasuryTransaction).toHaveBeenCalledWith(expect.objectContaining({
      transactionType: 'manual_inflow',
      financeAccountId: 3,
      amount: 2500,
    }));
  });

  it('POST /api/treasury/expenses/operational should create an operational expense request', async () => {
    setupAuth();
    setChains([accountant]);
    mockCreateOperationalExpense.mockResolvedValue({
      id: 12,
      expenseCode: 'OPE-20260404-001',
      status: 'pending_approval',
    });

    const res = await authedRequest('post', '/api/treasury/expenses/operational').send({
      expenseDate: '2026-04-04',
      expenseCategory: 'Repairs',
      allocationType: 'site',
      siteId: 1,
      amount: 3200,
      notes: 'Water line repair',
    });

    expect(res.status).toBe(201);
    expect(mockCreateOperationalExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseCategory: 'Repairs',
      siteId: 1,
      amount: 3200,
    }));
  });

  it('PUT /api/treasury/expenses/operational/:id/review should review an operational expense', async () => {
    setupAuth();
    setChains([accountant]);
    mockReviewOperationalExpense.mockResolvedValue({
      id: 12,
      status: 'approved',
    });

    const res = await request(app)
      .put('/api/treasury/expenses/operational/12/review')
      .set('Authorization', 'Bearer valid-token')
      .send({
        status: 'approved',
        approvalNotes: 'Approved for urgent repair',
      });

    expect(res.status).toBe(200);
    expect(mockReviewOperationalExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseId: 12,
      status: 'approved',
    }));
  });

  it('PUT /api/treasury/expenses/operational/:id/settle should settle an approved operational expense', async () => {
    setupAuth();
    setChains([accountant]);
    mockSettleOperationalExpense.mockResolvedValue({
      id: 12,
      status: 'paid',
      treasuryTransactionId: 91,
    });

    const res = await request(app)
      .put('/api/treasury/expenses/operational/12/settle')
      .set('Authorization', 'Bearer valid-token')
      .send({
        financeAccountId: 3,
        paymentMethod: 'bank_transfer',
        paymentDate: '2026-04-04',
      });

    expect(res.status).toBe(200);
    expect(mockSettleOperationalExpense).toHaveBeenCalledWith(expect.objectContaining({
      expenseId: 12,
      financeAccountId: 3,
      paymentMethod: 'bank_transfer',
    }));
  });

  it('POST /api/treasury/reconciliations should create a reconciliation close', async () => {
    setupAuth();
    setChains([accountant]);
    mockCreateFinanceReconciliation.mockResolvedValue({
      id: 8,
      financeAccountId: 3,
      status: 'closed',
    });

    const res = await authedRequest('post', '/api/treasury/reconciliations').send({
      financeAccountId: 3,
      periodStart: '2026-04-01',
      periodEnd: '2026-04-30',
      statementDate: '2026-04-30',
      statementBalance: 120000,
      clearedEntryIds: [1, 2, 3],
    });

    expect(res.status).toBe(201);
    expect(mockCreateFinanceReconciliation).toHaveBeenCalledWith(expect.objectContaining({
      financeAccountId: 3,
      clearedEntryIds: [1, 2, 3],
    }));
  });
});
