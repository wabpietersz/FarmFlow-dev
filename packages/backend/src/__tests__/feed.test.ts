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

// Test users
const feedMillOperator = {
  id: 6,
  firebaseUid: 'feed-mill-uid',
  email: 'feedmill@farmflow.com',
  fullName: 'Feed Mill Operator',
  userRole: 'feed_mill_operator',
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

// Mock data
const mockRecipe = {
  id: 1,
  recipeName: 'Starter Mix A',
  feedType: 'starter',
  status: 'active',
  cost: '1500.00',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecipeIngredient = {
  id: 1,
  recipeId: 1,
  supplierId: null,
  inventoryItemId: 1,
  ingredientName: 'Maize Meal',
  proportion: '60.00',
  unit: 'kg',
};

const mockRecipeIngredient2 = {
  id: 2,
  recipeId: 1,
  supplierId: null,
  inventoryItemId: 2,
  ingredientName: 'Soybean Meal',
  proportion: '40.00',
  unit: 'kg',
};

const mockSupplier = {
  id: 1,
  supplierName: 'AgriCorp Feeds',
  contactPerson: 'John Doe',
  phoneNumber: '+27821234567',
  email: 'john@agricorp.co.za',
  address: '123 Farm Rd, Cape Town',
  status: 'active',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInactiveSupplier = {
  ...mockSupplier,
  id: 2,
  supplierName: 'Old Supplier',
  status: 'inactive',
};

const mockPurchaseOrder = {
  id: 1,
  orderCode: 'PO-20260210-001',
  supplierId: 1,
  orderDate: '2026-02-10',
  expectedDeliveryDate: '2026-02-15',
  actualDeliveryDate: null,
  status: 'draft',
  totalCost: '15000.00',
  notes: null,
  createdBy: 6,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockSubmittedPO = {
  ...mockPurchaseOrder,
  id: 2,
  orderCode: 'PO-20260210-002',
  status: 'submitted',
};

const mockPOItem = {
  id: 1,
  purchaseOrderId: 1,
  inventoryItemId: 1,
  orderedQuantity: '1000.00',
  unitPrice: '5.50',
  receivedQuantity: '0.00',
  unit: 'kg',
  notes: null,
};

const mockPOItem2 = {
  id: 2,
  purchaseOrderId: 1,
  inventoryItemId: 2,
  orderedQuantity: '500.00',
  unitPrice: '8.00',
  receivedQuantity: '0.00',
  unit: 'kg',
  notes: null,
};

const mockInventoryItem1 = {
  id: 1,
  ingredientName: 'Maize Meal',
  supplierId: null,
  quantity: '5000.00',
  unit: 'kg',
  costPerUnit: '5.50',
  reorderLevel: '500.00',
  lastRestockDate: '2026-01-15',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockInventoryItem2 = {
  id: 2,
  ingredientName: 'Soybean Meal',
  supplierId: null,
  quantity: '3000.00',
  unit: 'kg',
  costPerUnit: '8.00',
  reorderLevel: '300.00',
  lastRestockDate: '2026-01-15',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockProduction = {
  id: 1,
  productionCode: 'PROD-20260210-001',
  recipeId: 1,
  plannedQuantity: '1000.00',
  actualQuantity: null,
  unit: 'kg',
  status: 'planned',
  productionDate: '2026-02-10',
  productionCost: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCompletedProduction = {
  ...mockProduction,
  id: 2,
  productionCode: 'PROD-20260210-002',
  status: 'completed',
  actualQuantity: '950.00',
  productionCost: '7300.00',
};

const mockInProgressProduction = {
  ...mockProduction,
  status: 'in_progress',
};

const mockProductionMaterial = {
  id: 1,
  productionBatchId: 1,
  inventoryItemId: 1,
  plannedQuantity: '600.00',
  actualQuantity: null,
  unit: 'kg',
};

const mockFarmBatch = {
  id: 1,
  batchCode: 'BATCH-S1-C1-20260201',
  siteId: 1,
  cageId: 1,
  chicksPlaced: 1000,
  status: 'growing',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockDistribution = {
  id: 1,
  productionBatchId: 2,
  farmBatchId: 1,
  feedType: 'starter',
  quantity: '200.00',
  unit: 'kg',
  distributionDate: '2026-02-10',
  notes: null,
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

describe('Feed Production & Distribution Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chainIndex = 0;
    dbChains = [];
  });

  // ==================== AUTHENTICATION ====================
  describe('Authentication & Authorization', () => {
    it('GET /api/feed/production should require authentication', async () => {
      const res = await request(app).get('/api/feed/production');
      expect(res.status).toBe(401);
    });

    it('GET /api/feed/distribution should require authentication', async () => {
      const res = await request(app).get('/api/feed/distribution');
      expect(res.status).toBe(401);
    });

    it('POST /api/feed/production should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/feed/production').send({
        recipeId: 1,
        plannedQuantity: 1000,
        productionDate: '2026-02-10',
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/feed/distribution should return 403 for viewer', async () => {
      setupAuth(viewer);
      setChains([viewer]);

      const res = await authedRequest('post', '/api/feed/distribution').send({
        farmBatchId: 1,
        feedType: 'starter',
        quantity: 200,
        distributionDate: '2026-02-10',
      });
      expect(res.status).toBe(403);
    });

    it('GET /api/feed/production should return 200 for feed_mill_operator', async () => {
      setupAuth(feedMillOperator);
      setChains(
        [feedMillOperator], // auth
        [],                 // production list query
        [{ total: 0 }],    // count query
      );

      const res = await authedRequest('get', '/api/feed/production');
      expect(res.status).toBe(200);
    });
  });

  // ==================== PRODUCTION CRUD ====================
  describe('Production Routes', () => {
    describe('GET /api/feed/production', () => {
      it('should return paginated production list', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockProduction, recipeName: 'Starter Mix A', feedType: 'starter' }],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/feed/production');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
        expect(res.body.total).toBe(1);
      });

      it('should filter by status', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],
          [{ total: 0 }],
        );

        const res = await authedRequest('get', '/api/feed/production?status=completed');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(0);
      });
    });

    describe('GET /api/feed/production/summary', () => {
      it('should return production summary', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],          // auth
          [{ total: 2 }],              // active count
          [{ feedType: 'starter', totalProduced: 2000, batchCount: 3 }], // completed stats
        );

        const res = await authedRequest('get', '/api/feed/production/summary');
        expect(res.status).toBe(200);
        expect(res.body.data.activeProductionCount).toBe(2);
      });
    });

    describe('GET /api/feed/production/:id', () => {
      it('should return production detail with materials', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],                      // auth
          [{ ...mockProduction, recipeName: 'Starter Mix A', feedType: 'starter' }], // production
          [mockProductionMaterial],                 // materials
          [{ total: 0 }],                          // distributed total
        );

        const res = await authedRequest('get', '/api/feed/production/1');
        expect(res.status).toBe(200);
        expect(res.body.data.production.productionCode).toBe('PROD-20260210-001');
        expect(res.body.data.materials).toHaveLength(1);
      });

      it('should return 404 for non-existent production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],   // empty production
        );

        const res = await authedRequest('get', '/api/feed/production/999');
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/feed/production', () => {
      it('should create production batch with materials', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],                                  // auth
          [mockRecipe],                                        // recipe lookup
          [mockRecipeIngredient, mockRecipeIngredient2],        // ingredients
          [{ total: 0 }],                                      // code generation count
          [mockProduction],                                    // insert returning
          [mockInventoryItem1],                                // inventory item 1 lookup
          [mockInventoryItem2],                                // inventory item 2 lookup
          [],                                                  // insert materials
          [mockProductionMaterial],                             // fetch materials
        );

        const res = await authedRequest('post', '/api/feed/production').send({
          recipeId: 1,
          plannedQuantity: 1000,
          productionDate: '2026-02-10',
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should return 404 for non-existent recipe', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],   // recipe not found
        );

        const res = await authedRequest('post', '/api/feed/production').send({
          recipeId: 999,
          plannedQuantity: 1000,
          productionDate: '2026-02-10',
        });
        expect(res.status).toBe(404);
      });

      it('should return 400 for inactive recipe', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockRecipe, status: 'inactive' }], // inactive recipe
        );

        const res = await authedRequest('post', '/api/feed/production').send({
          recipeId: 1,
          plannedQuantity: 1000,
          productionDate: '2026-02-10',
        });
        expect(res.status).toBe(400);
      });

      it('should validate required fields', async () => {
        setupAuth(feedMillOperator);
        setChains([feedMillOperator]);

        const res = await authedRequest('post', '/api/feed/production').send({});
        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/feed/production/:id/status', () => {
      it('should transition planned → in_progress', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockProduction],            // existing (planned)
          [mockInProgressProduction],  // updated
        );

        const res = await authedRequest('put', '/api/feed/production/1/status').send({
          status: 'in_progress',
        });
        expect(res.status).toBe(200);
      });

      it('should transition planned → cancelled', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockProduction],
          [{ ...mockProduction, status: 'cancelled' }],
        );

        const res = await authedRequest('put', '/api/feed/production/1/status').send({
          status: 'cancelled',
        });
        expect(res.status).toBe(200);
      });

      it('should reject invalid transition (planned → completed)', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockProduction], // planned
        );

        const res = await authedRequest('put', '/api/feed/production/1/status').send({
          status: 'completed',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
      });

      it('should reject transition from completed status', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockCompletedProduction],
        );

        const res = await authedRequest('put', '/api/feed/production/1/status').send({
          status: 'cancelled',
        });
        expect(res.status).toBe(400);
      });

      it('should return 404 for non-existent production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [], // not found
        );

        const res = await authedRequest('put', '/api/feed/production/999/status').send({
          status: 'in_progress',
        });
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/feed/production/:id/complete', () => {
      it('should complete production, deduct inventory, calculate cost', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],                      // auth
          [mockInProgressProduction],              // existing (in_progress)
          [mockInventoryItem1],                    // inventory check item 1
          [mockInventoryItem1],                    // deduct item 1 update
          [{ actualQuantity: '600.00' }],          // update material 1
          [{ ...mockInProgressProduction, status: 'completed', actualQuantity: '950.00' }], // update production
        );

        const res = await authedRequest('post', '/api/feed/production/1/complete').send({
          actualQuantity: 950,
          materials: [
            { inventoryItemId: 1, actualQuantity: 600 },
          ],
        });
        expect(res.status).toBe(200);
      });

      it('should reject completion if not in_progress', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockProduction], // planned, not in_progress
        );

        const res = await authedRequest('post', '/api/feed/production/1/complete').send({
          actualQuantity: 950,
          materials: [{ inventoryItemId: 1, actualQuantity: 600 }],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_STATUS');
      });

      it('should reject if insufficient inventory', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockInProgressProduction],
          [{ ...mockInventoryItem1, quantity: '100.00' }], // insufficient
        );

        const res = await authedRequest('post', '/api/feed/production/1/complete').send({
          actualQuantity: 950,
          materials: [{ inventoryItemId: 1, actualQuantity: 600 }],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INSUFFICIENT_INVENTORY');
      });
    });

    describe('DELETE /api/feed/production/:id', () => {
      it('should delete planned production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockProduction],  // planned
          [],                // delete
        );

        const res = await authedRequest('delete', '/api/feed/production/1');
        expect(res.status).toBe(200);
      });

      it('should delete cancelled production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockProduction, status: 'cancelled' }],
          [],
        );

        const res = await authedRequest('delete', '/api/feed/production/1');
        expect(res.status).toBe(200);
      });

      it('should reject delete of completed production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockCompletedProduction],
        );

        const res = await authedRequest('delete', '/api/feed/production/2');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('CANNOT_DELETE');
      });

      it('should reject delete of in_progress production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockInProgressProduction],
        );

        const res = await authedRequest('delete', '/api/feed/production/1');
        expect(res.status).toBe(400);
      });
    });
  });

  // ==================== DISTRIBUTION CRUD ====================
  describe('Distribution Routes', () => {
    describe('GET /api/feed/distribution', () => {
      it('should return paginated distribution list', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockDistribution, productionCode: 'PROD-20260210-002', farmBatchCode: 'BATCH-S1-C1-20260201' }],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/feed/distribution');
        expect(res.status).toBe(200);
        expect(res.body.data).toHaveLength(1);
      });

      it('should filter by feed type', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],
          [{ total: 0 }],
        );

        const res = await authedRequest('get', '/api/feed/distribution?feedType=starter');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/feed/distribution/by-batch/:batchId', () => {
      it('should return distributions for a farm batch', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockDistribution],     // distributions
          [{ total: 200 }],       // total distributed
        );

        const res = await authedRequest('get', '/api/feed/distribution/by-batch/1');
        expect(res.status).toBe(200);
        expect(res.body.data.distributions).toHaveLength(1);
      });
    });

    describe('GET /api/feed/distribution/:id', () => {
      it('should return distribution detail', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockDistribution, productionCode: 'PROD-20260210-002', farmBatchCode: 'BATCH-S1-C1-20260201' }],
        );

        const res = await authedRequest('get', '/api/feed/distribution/1');
        expect(res.status).toBe(200);
        expect(res.body.data.feedType).toBe('starter');
      });

      it('should return 404 for non-existent distribution', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],
        );

        const res = await authedRequest('get', '/api/feed/distribution/999');
        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/feed/distribution', () => {
      it('should create distribution linked to production batch', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],                       // auth
          [mockFarmBatch],                          // farm batch check
          [mockCompletedProduction],                // production check
          [{ total: 200 }],                         // existing distributed total
          [mockDistribution],                       // insert returning
        );

        const res = await authedRequest('post', '/api/feed/distribution').send({
          productionBatchId: 2,
          farmBatchId: 1,
          feedType: 'starter',
          quantity: 200,
          distributionDate: '2026-02-10',
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should create distribution without production link (manual)', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockFarmBatch],
          [{ ...mockDistribution, productionBatchId: null }],
        );

        const res = await authedRequest('post', '/api/feed/distribution').send({
          farmBatchId: 1,
          feedType: 'starter',
          quantity: 200,
          distributionDate: '2026-02-10',
        });
        expect(res.status).toBe(201);
      });

      it('should reject distribution from non-completed production', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockFarmBatch],
          [mockProduction],  // planned, not completed
        );

        const res = await authedRequest('post', '/api/feed/distribution').send({
          productionBatchId: 1,
          farmBatchId: 1,
          feedType: 'starter',
          quantity: 200,
          distributionDate: '2026-02-10',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PROD_NOT_COMPLETED');
      });

      it('should reject if exceeds available produced quantity', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockFarmBatch],
          [mockCompletedProduction],   // actualQuantity: 950
          [{ total: 900 }],            // already distributed 900
        );

        const res = await authedRequest('post', '/api/feed/distribution').send({
          productionBatchId: 2,
          farmBatchId: 1,
          feedType: 'starter',
          quantity: 100,     // would exceed (900 + 100 > 950)
          distributionDate: '2026-02-10',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INSUFFICIENT_PRODUCED_FEED');
      });

      it('should return 404 for non-existent farm batch', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],  // farm batch not found
        );

        const res = await authedRequest('post', '/api/feed/distribution').send({
          farmBatchId: 999,
          feedType: 'starter',
          quantity: 200,
          distributionDate: '2026-02-10',
        });
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('FARM_BATCH_NOT_FOUND');
      });

      it('should validate required fields', async () => {
        setupAuth(feedMillOperator);
        setChains([feedMillOperator]);

        const res = await authedRequest('post', '/api/feed/distribution').send({});
        expect(res.status).toBe(400);
      });
    });

    describe('DELETE /api/feed/distribution/:id', () => {
      it('should delete distribution', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockDistribution],
          [],
        );

        const res = await authedRequest('delete', '/api/feed/distribution/1');
        expect(res.status).toBe(200);
      });

      it('should return 404 for non-existent distribution', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],
        );

        const res = await authedRequest('delete', '/api/feed/distribution/999');
        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== PURCHASE ORDERS ====================
  describe('Purchase Orders', () => {
    describe('GET /api/feed/purchase-orders', () => {
      it('should require authentication', async () => {
        const res = await request(app).get('/api/feed/purchase-orders');
        expect(res.status).toBe(401);
      });

      it('should return 403 for viewer', async () => {
        setupAuth(viewer);
        setChains([viewer]);

        const res = await authedRequest('get', '/api/feed/purchase-orders');
        expect(res.status).toBe(403);
      });

      it('should list purchase orders', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockPurchaseOrder, supplierName: 'AgriCorp Feeds' }], // query results
          [{ total: 1 }], // count query
        );

        const res = await authedRequest('get', '/api/feed/purchase-orders');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data).toBeDefined();
      });

      it('should filter by status', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],
          [{ total: 1 }],
        );

        const res = await authedRequest('get', '/api/feed/purchase-orders?status=submitted');
        expect(res.status).toBe(200);
      });
    });

    describe('GET /api/feed/purchase-orders/:id', () => {
      it('should return PO detail with items', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [{ ...mockPurchaseOrder, supplierName: 'AgriCorp Feeds' }], // PO query
          [{ ...mockPOItem, ingredientName: 'Maize Meal' }], // items query
        );

        const res = await authedRequest('get', '/api/feed/purchase-orders/1');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.purchaseOrder).toBeDefined();
        expect(res.body.data.items).toBeDefined();
      });

      it('should return 404 for non-existent PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],  // no PO found
        );

        const res = await authedRequest('get', '/api/feed/purchase-orders/999');
        expect(res.status).toBe(404);
        expect(res.body.code).toBe('NOT_FOUND');
      });
    });

    describe('POST /api/feed/purchase-orders', () => {
      it('should create purchase order', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSupplier],            // supplier validation
          [mockInventoryItem1],      // item 1 inventory validation
          [{ total: 0 }],           // PO code generation count
          [mockPurchaseOrder],       // insert returning
          [],                        // items insert
          [mockPOItem],             // items fetch
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders').send({
          supplierId: 1,
          orderDate: '2026-02-10',
          expectedDeliveryDate: '2026-02-15',
          items: [
            { inventoryItemId: 1, orderedQuantity: 1000, unitPrice: 5.50, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should reject invalid supplier', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],  // supplier not found
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders').send({
          supplierId: 999,
          orderDate: '2026-02-10',
          items: [
            { inventoryItemId: 1, orderedQuantity: 100, unitPrice: 5.00, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_SUPPLIER');
      });

      it('should reject inactive supplier', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockInactiveSupplier],  // inactive supplier
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders').send({
          supplierId: 2,
          orderDate: '2026-02-10',
          items: [
            { inventoryItemId: 1, orderedQuantity: 100, unitPrice: 5.00, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INACTIVE_SUPPLIER');
      });

      it('should reject invalid inventory item', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSupplier],  // valid supplier
          [],              // inventory item not found
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders').send({
          supplierId: 1,
          orderDate: '2026-02-10',
          items: [
            { inventoryItemId: 999, orderedQuantity: 100, unitPrice: 5.00, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INVENTORY_ITEM');
      });

      it('should validate required fields', async () => {
        setupAuth(feedMillOperator);
        setChains([feedMillOperator]);

        const res = await authedRequest('post', '/api/feed/purchase-orders').send({});
        expect(res.status).toBe(400);
      });
    });

    describe('PUT /api/feed/purchase-orders/:id', () => {
      it('should update draft purchase order', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],  // existing (draft)
          [mockPurchaseOrder],  // update returning
          [mockPOItem],         // items fetch
          [mockPurchaseOrder],  // fresh PO fetch
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/1').send({
          notes: 'Updated notes',
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should reject update of non-draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],  // submitted PO (not draft)
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/2').send({
          notes: 'Cannot update',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PO_NOT_DRAFT');
      });
    });

    describe('DELETE /api/feed/purchase-orders/:id', () => {
      it('should delete draft PO with no received items', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],   // existing (draft)
          [{ total: 0 }],       // no received items
          [],                    // delete
        );

        const res = await authedRequest('delete', '/api/feed/purchase-orders/1');
        expect(res.status).toBe(200);
      });

      it('should reject delete of non-draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],  // submitted (not draft)
        );

        const res = await authedRequest('delete', '/api/feed/purchase-orders/2');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PO_NOT_DRAFT');
      });

      it('should reject delete of PO with received items', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],  // draft PO
          [{ total: 1 }],      // has received items
        );

        const res = await authedRequest('delete', '/api/feed/purchase-orders/1');
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PO_HAS_RECEIVED');
      });
    });

    describe('PUT /api/feed/purchase-orders/:id/status', () => {
      it('should submit draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],  // existing (draft)
          [{ ...mockPurchaseOrder, status: 'submitted' }],  // update returning
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/1/status').send({
          status: 'submitted',
        });
        expect(res.status).toBe(200);
      });

      it('should reject submitting non-draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],  // already submitted
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/2/status').send({
          status: 'submitted',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_PO_TRANSITION');
      });

      it('should cancel draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],  // draft PO
          [{ total: 0 }],      // no received items
          [{ ...mockPurchaseOrder, status: 'cancelled' }],  // update returning
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/1/status').send({
          status: 'cancelled',
        });
        expect(res.status).toBe(200);
      });

      it('should reject cancelling PO with received items', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],  // submitted PO
          [{ total: 1 }],    // has received items
        );

        const res = await authedRequest('put', '/api/feed/purchase-orders/2/status').send({
          status: 'cancelled',
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('PO_HAS_RECEIVED');
      });
    });

    describe('POST /api/feed/purchase-orders/:id/receive', () => {
      it('should receive items from submitted PO', async () => {
        setupAuth(feedMillOperator);
        const poItem = { ...mockPOItem, purchaseOrderId: 2 };
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],     // existing submitted PO
          [poItem],              // PO line item lookup
          [],                    // update PO item received qty
          [mockInventoryItem1],  // inventory lookup (for lot creation)
          [{ total: 0 }],        // lot count for generateLotCode
          [{ id: 1, lotCode: 'LOT-20260213-001', inventoryItemId: 1, receivedQuantity: '500', remainingQuantity: '500', costPerUnit: '5.00', receivedDate: '2026-02-13' }], // insert lot returning
          [{ totalValue: '2500.00', totalQty: '500.00' }], // recalculate weighted average cost
          [],                    // inventory update
          [],                    // audit trail insert
          [{ ...poItem, receivedQuantity: '500.00' }], // all items check for status determination
          [{ ...mockSubmittedPO, status: 'partially_received' }], // PO update returning
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders/2/receive').send({
          items: [
            { itemId: 1, receivedQuantity: 500 },
          ],
        });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      it('should reject receiving from draft PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockPurchaseOrder],  // draft PO
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders/1/receive').send({
          items: [
            { itemId: 1, receivedQuantity: 100 },
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_PO_STATUS');
      });

      it('should reject over-receiving', async () => {
        setupAuth(feedMillOperator);
        const poItem = { ...mockPOItem, purchaseOrderId: 2 };
        setChains(
          [feedMillOperator],
          [mockSubmittedPO],  // submitted PO
          [poItem],           // PO item (ordered 1000, received 0, belongs to PO 2)
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders/2/receive').send({
          items: [
            { itemId: 1, receivedQuantity: 1500 },  // exceeds ordered qty
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('EXCEEDS_ORDERED_QTY');
      });

      it('should return 404 for non-existent PO', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],  // PO not found
        );

        const res = await authedRequest('post', '/api/feed/purchase-orders/999/receive').send({
          items: [{ itemId: 1, receivedQuantity: 100 }],
        });
        expect(res.status).toBe(404);
      });
    });
  });

  // ==================== SUPPLIER-INVENTORY ENFORCEMENT ====================
  describe('Supplier-Inventory Enforcement', () => {
    describe('POST /api/feed/inventory', () => {
      it('should require supplierId for inventory creation', async () => {
        setupAuth(feedMillOperator);
        setChains([feedMillOperator]);

        const res = await authedRequest('post', '/api/feed/inventory').send({
          ingredientName: 'Wheat Bran',
          quantity: 1000,
          unit: 'kg',
          costPerUnit: 4.50,
          // missing supplierId
        });
        expect(res.status).toBe(400);
      });

      it('should validate supplier exists and is active', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],  // supplier not found
        );

        const res = await authedRequest('post', '/api/feed/inventory').send({
          ingredientName: 'Wheat Bran',
          supplierId: 999,
          quantity: 1000,
          unit: 'kg',
          costPerUnit: 4.50,
        });
        expect(res.status).toBe(400);
      });

      it('should reject inactive supplier', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [mockInactiveSupplier],  // inactive supplier
        );

        const res = await authedRequest('post', '/api/feed/inventory').send({
          ingredientName: 'Wheat Bran',
          supplierId: 2,
          quantity: 1000,
          unit: 'kg',
          costPerUnit: 4.50,
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INACTIVE_SUPPLIER');
      });
    });
  });

  // ==================== RECIPE WITH INVENTORY FK ====================
  describe('Recipe Ingredient FK', () => {
    describe('POST /api/feed/recipes', () => {
      it('should create recipe with inventoryItemId', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],                    // unique name check (no existing recipe)
          [mockRecipe],          // insert recipe returning
          [mockInventoryItem1],  // inventory FK validation (1st ingredient)
          [mockInventoryItem2],  // inventory FK validation (2nd ingredient)
          [],                    // insert ingredients
          [mockRecipeIngredient, mockRecipeIngredient2], // fetch inserted ingredients
        );

        const res = await authedRequest('post', '/api/feed/recipes').send({
          recipeName: 'Grower Mix B',
          feedType: 'grower',
          cost: 1800,
          ingredients: [
            { inventoryItemId: 1, proportion: 60, unit: 'kg' },
            { inventoryItemId: 2, proportion: 40, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
      });

      it('should reject invalid inventory item FK', async () => {
        setupAuth(feedMillOperator);
        setChains(
          [feedMillOperator],
          [],              // unique name check (no existing)
          [mockRecipe],    // insert recipe returning
          [],              // inventory item not found
        );

        const res = await authedRequest('post', '/api/feed/recipes').send({
          recipeName: 'Bad Recipe',
          feedType: 'starter',
          cost: 1000,
          ingredients: [
            { inventoryItemId: 999, proportion: 100, unit: 'kg' },
          ],
        });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe('INVALID_INVENTORY_ITEM');
      });

      it('should require inventoryItemId (not ingredientName)', async () => {
        setupAuth(feedMillOperator);
        setChains([feedMillOperator]);

        const res = await authedRequest('post', '/api/feed/recipes').send({
          recipeName: 'Old Style Recipe',
          feedType: 'starter',
          cost: 1000,
          ingredients: [
            { ingredientName: 'Maize Meal', proportion: 100, unit: 'kg' },  // old format
          ],
        });
        expect(res.status).toBe(400);  // validator requires inventoryItemId
      });
    });
  });
});
