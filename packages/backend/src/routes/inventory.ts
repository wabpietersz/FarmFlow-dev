import { qualified } from '../lib/sql-utils';
import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { and, asc, desc, eq, ilike, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createSupplierSchema, updateSupplierSchema } from '../validators/feed';
import {
  consumeInventoryToBatchSchema,
  consumeInventoryToSiteSchema,
  createSupplierContractSchema,
  createSupplierInvoiceSchema,
  createSupplierPaymentSchema,
  createServiceWorkOrderSchema,
  createInventoryItemSchema,
  createInventoryItemTypeSchema,
  createInventoryPurchaseOrderSchema,
  reviewServiceWorkOrderSchema,
  reviewSupplierContractSchema,
  reviewSupplierInvoiceSchema,
  receiveInventoryPurchaseOrderSchema,
  settleServiceWorkOrderSchema,
  updateInventoryItemSchema,
  updateInventoryItemTypeSchema,
  updateInventoryPurchaseOrderSchema,
  updateInventoryPurchaseOrderStatusSchema,
  stockLocationSchema,
  updateStockLocationSchema,
  stockTransferSchema,
  writeOffLotSchema,
  createRequisitionSchema,
  reviewRequisitionSchema,
  convertRequisitionSchema,
} from '../validators/inventory';
import { db } from '../db';
import {
  batchInventoryConsumptions,
  batches,
  feedInventory,
  financeAccounts,
  inventoryAuditTrail,
  inventoryItemTypes,
  inventoryMovements,
  inventoryLots,
  purchaseOrderItems,
  purchaseOrders,
  serviceWorkOrders,
  siteInventoryConsumptions,
  sites,
  supplierContracts,
  supplierContractTerms,
  supplierInvoices,
  supplierPaymentAllocations,
  supplierPayments,
  suppliers,
  treasuryTransactionLinks,
  stockLocations,
  stockTransfers,
} from '../db/schema';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { createSupplierPayment } from '../lib/treasury';
import { defaultPurchaseCostCentreId, resolveEntryTags } from '../lib/finance-tags';
import { StockError, ensureFarmStore, expiringLots, farmStoreForBatch, planLotConsumptionOrLegacy, stockBalances, transferStock, writeOffLot } from '../lib/stock';
import { computeInvoiceMatch, convertRequisitionToOrder, createRequisition, listRequisitions, receivePurchaseOrder, reviewRequisition } from '../lib/procurement';

function serviceTypeCategoryCode(serviceType: string) {
  if (serviceType === 'utility') return 'electricity';
  if (serviceType === 'fuel') return 'fuel_gas';
  return 'repairs_maintenance';
}
import { assertPeriodOpen } from '../lib/period-locks';
import { getProductionBatchAvailableQuantity, postInventoryMovement } from '../lib/inventory-movements';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

const router = Router();

interface LotConsumption {
  lotId: number;
  purchaseOrderItemId?: number | null;
  lotCode: string;
  quantityUsed: number;
  costPerUnit: number;
  lineCost: number;
  previousRemaining: number;
  newRemaining: number;
}

async function generateLotCode(date: string, prefix = 'LOT'): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const lotPrefix = `${prefix}-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(inventoryLots)
    .where(ilike(inventoryLots.lotCode, `${lotPrefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${lotPrefix}${seq}`;
}

async function generatePOCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `PO-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.orderCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

async function generateSupplierContractCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `CON-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(supplierContracts)
    .where(ilike(supplierContracts.contractCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

async function generateSupplierInvoiceCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `INV-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(supplierInvoices)
    .where(ilike(supplierInvoices.invoiceCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

async function generateServiceWorkOrderCode(date: string): Promise<string> {
  const dateStr = date.replace(/-/g, '').slice(0, 8);
  const prefix = `WRK-${dateStr}-`;
  const [result] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(serviceWorkOrders)
    .where(ilike(serviceWorkOrders.workOrderCode, `${prefix}%`));
  const seq = String((result?.total ?? 0) + 1).padStart(3, '0');
  return `${prefix}${seq}`;
}

async function recalculateWeightedAverageCost(inventoryItemId: number): Promise<number> {
  const [result] = await db
    .select({
      totalValue: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric * ${inventoryLots.costPerUnit}::numeric), 0)`,
      totalQty: sql<string>`COALESCE(SUM(${inventoryLots.remainingQuantity}::numeric), 0)`,
    })
    .from(inventoryLots)
    .where(and(
      eq(inventoryLots.inventoryItemId, inventoryItemId),
      sql`${inventoryLots.remainingQuantity}::numeric > 0`,
    ));

  const totalValue = Number(result?.totalValue ?? 0);
  const totalQty = Number(result?.totalQty ?? 0);
  if (totalQty === 0) return 0;
  return Math.round((totalValue / totalQty) * 100) / 100;
}

async function consumeInventoryFIFO(
  inventoryItemId: number,
  requiredQuantity: number,
  preferredLocationId?: number | null,
): Promise<{ lotConsumptions: LotConsumption[]; totalCost: number }> {
  return planLotConsumptionOrLegacy({ inventoryItemId, quantity: requiredQuantity, preferredLocationId });
}

function sendStockError(res: Response, error: StockError) {
  res.status(error.statusCode).json({ success: false, error: error.message, code: error.code, statusCode: error.statusCode, timestamp: new Date().toISOString() });
}

async function getInventoryItemWithType(itemId: number) {
  const [item] = await db
    .select({
      id: feedInventory.id,
      itemTypeId: feedInventory.itemTypeId,
      itemCode: feedInventory.itemCode,
      ingredientName: feedInventory.ingredientName,
      description: feedInventory.description,
      supplierId: feedInventory.supplierId,
      quantity: feedInventory.quantity,
      unit: feedInventory.unit,
      costPerUnit: feedInventory.costPerUnit,
      reorderLevel: feedInventory.reorderLevel,
      lastRestockDate: feedInventory.lastRestockDate,
      createdAt: feedInventory.createdAt,
      updatedAt: feedInventory.updatedAt,
      typeCode: inventoryItemTypes.typeCode,
      typeName: inventoryItemTypes.typeName,
      typeCategory: inventoryItemTypes.category,
      typeDefaultUnit: inventoryItemTypes.defaultUnit,
      allowsBatchAllocation: inventoryItemTypes.allowsBatchAllocation,
      isFeed: inventoryItemTypes.isFeed,
      typeStatus: inventoryItemTypes.status,
      supplierName: suppliers.supplierName,
    })
    .from(feedInventory)
    .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
    .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id))
    .where(eq(feedInventory.id, itemId))
    .limit(1);

  return item;
}

// =============================================================================
// ITEM TYPES
// =============================================================================

router.get('/item-types', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, category } = req.query;
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(inventoryItemTypes.status, status as string));
    }
    if (category && category !== 'all') {
      conditions.push(eq(inventoryItemTypes.category, category as string));
    }

    const types = conditions.length > 0
      ? await db.select().from(inventoryItemTypes).where(and(...conditions)).orderBy(asc(inventoryItemTypes.typeName))
      : await db.select().from(inventoryItemTypes).orderBy(asc(inventoryItemTypes.typeName));

    res.json({ success: true, data: types, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory item types', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory item types', code: 'ITEM_TYPES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/item-types', authenticate, requirePermission('inventory:create'), validate(createInventoryItemTypeSchema), async (req: Request, res: Response) => {
  try {
    const { typeCode, typeName, category, defaultUnit, allowsBatchAllocation, isFeed, status, description } = req.body;
    const normalizedCode = String(typeCode).trim().toLowerCase().replace(/\s+/g, '_');

    const [duplicate] = await db
      .select({ id: inventoryItemTypes.id })
      .from(inventoryItemTypes)
      .where(eq(inventoryItemTypes.typeCode, normalizedCode))
      .limit(1);

    if (duplicate) {
      res.status(409).json({ success: false, error: 'An inventory type with this code already exists', code: 'ITEM_TYPE_CODE_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [created] = await db
      .insert(inventoryItemTypes)
      .values({
        typeCode: normalizedCode,
        typeName,
        category,
        defaultUnit,
        allowsBatchAllocation,
        isFeed,
        financeCategoryId: req.body.financeCategoryId ?? null,
        status,
        description: description || null,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_item_type_created',
      entityType: 'inventory_item_type',
      entityId: created.id,
      changes: { typeCode: normalizedCode, typeName, category, allowsBatchAllocation, isFeed },
    });

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create inventory item type', { error });
    res.status(500).json({ success: false, error: 'Failed to create inventory item type', code: 'CREATE_ITEM_TYPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/item-types/:id', authenticate, requirePermission('inventory:update'), validate(updateInventoryItemTypeSchema), async (req: Request, res: Response) => {
  try {
    const typeId = Number(req.params.id as string);

    const [existing] = await db.select().from(inventoryItemTypes).where(eq(inventoryItemTypes.id, typeId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item type not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
    if (req.body.typeCode) {
      updateData.typeCode = String(req.body.typeCode).trim().toLowerCase().replace(/\s+/g, '_');
    }

    const [updated] = await db
      .update(inventoryItemTypes)
      .set(updateData)
      .where(eq(inventoryItemTypes.id, typeId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_item_type_updated',
      entityType: 'inventory_item_type',
      entityId: typeId,
      changes: { before: existing, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update inventory item type', { error });
    res.status(500).json({ success: false, error: 'Failed to update inventory item type', code: 'UPDATE_ITEM_TYPE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// SUPPLIERS
// =============================================================================

router.get('/suppliers', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    const conditions = [];

    if (status && status !== 'all') {
      conditions.push(eq(suppliers.status, status as string));
    }
    if (search) {
      conditions.push(ilike(suppliers.supplierName, `%${search as string}%`));
    }

    const data = conditions.length > 0
      ? await db.select().from(suppliers).where(and(...conditions)).orderBy(asc(suppliers.supplierName))
      : await db.select().from(suppliers).orderBy(asc(suppliers.supplierName));

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory suppliers', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch suppliers', code: 'SUPPLIERS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/suppliers/:id/payments', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);

    if (!supplier) {
      res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const paymentsList = await db
      .select({
        id: supplierPayments.id,
        paymentCode: supplierPayments.paymentCode,
        supplierId: supplierPayments.supplierId,
        supplierName: suppliers.supplierName,
        purchaseOrderId: supplierPayments.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
        paymentDate: supplierPayments.paymentDate,
        financeAccountId: supplierPayments.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: supplierPayments.paymentMethod,
        amount: supplierPayments.amount,
        paymentStatus: supplierPayments.paymentStatus,
        referenceNumber: supplierPayments.referenceNumber,
        chequeLeafId: supplierPayments.chequeLeafId,
        chequeNumber: supplierPayments.chequeNumber,
        chequeDate: supplierPayments.chequeDate,
        bankName: supplierPayments.bankName,
        treasuryTransactionId: supplierPayments.treasuryTransactionId,
        treasuryReversalTransactionId: supplierPayments.treasuryReversalTransactionId,
        notes: supplierPayments.notes,
        recordedBy: supplierPayments.recordedBy,
        createdAt: supplierPayments.createdAt,
        updatedAt: supplierPayments.updatedAt,
      })
      .from(supplierPayments)
      .leftJoin(suppliers, eq(supplierPayments.supplierId, suppliers.id))
      .leftJoin(purchaseOrders, eq(supplierPayments.purchaseOrderId, purchaseOrders.id))
      .leftJoin(financeAccounts, eq(supplierPayments.financeAccountId, financeAccounts.id))
      .where(eq(supplierPayments.supplierId, supplierId))
      .orderBy(desc(supplierPayments.paymentDate), desc(supplierPayments.id));

    res.json({ success: true, data: paymentsList, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch supplier payments', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier payments', code: 'SUPPLIER_PAYMENTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/suppliers/:id/payments', authenticate, requirePermission('inventory:update'), validate(createSupplierPaymentSchema), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);
    const payment = await createSupplierPayment({
      supplierId,
      purchaseOrderId: req.body.purchaseOrderId ?? null,
      supplierInvoiceId: req.body.supplierInvoiceId ?? null,
      supplierInvoiceAllocations: req.body.supplierInvoiceAllocations ?? null,
      paymentDate: req.body.paymentDate,
      financeAccountId: req.body.financeAccountId,
      paymentMethod: req.body.paymentMethod,
      amount: req.body.amount,
      referenceNumber: req.body.referenceNumber ?? null,
      chequeLeafId: req.body.chequeLeafId ?? null,
      notes: req.body.notes ?? null,
      recordedBy: req.user!.id,
      tags: req.body.categoryId || req.body.costCentreId || req.body.batchId
        ? { categoryId: req.body.categoryId ?? null, costCentreId: req.body.costCentreId ?? null, batchId: req.body.batchId ?? null }
        : null,
    });

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_payment_created',
      entityType: 'supplier_payment',
      entityId: payment.id,
      changes: {
        supplierId,
        purchaseOrderId: req.body.purchaseOrderId ?? null,
        financeAccountId: req.body.financeAccountId,
        paymentMethod: req.body.paymentMethod,
        amount: req.body.amount,
      },
    });

    res.status(201).json({ success: true, data: payment, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create supplier payment', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create supplier payment',
      code: 'SUPPLIER_PAYMENT_CREATE_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/contracts', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { supplierId, status } = req.query;
    const conditions = [];

    if (supplierId) {
      conditions.push(eq(supplierContracts.supplierId, Number(supplierId)));
    }
    if (status && status !== 'all') {
      conditions.push(eq(supplierContracts.status, String(status)));
    }

    const contracts = await db
      .select({
        id: supplierContracts.id,
        contractCode: supplierContracts.contractCode,
        supplierId: supplierContracts.supplierId,
        supplierName: suppliers.supplierName,
        contractType: supplierContracts.contractType,
        contractTitle: supplierContracts.contractTitle,
        description: supplierContracts.description,
        status: supplierContracts.status,
        validFrom: supplierContracts.validFrom,
        validTo: supplierContracts.validTo,
        currencyCode: supplierContracts.currencyCode,
        paymentTermsDays: supplierContracts.paymentTermsDays,
        commercialTerms: supplierContracts.commercialTerms,
        rateTable: supplierContracts.rateTable,
        attachmentUrls: supplierContracts.attachmentUrls,
        alertDaysBeforeExpiry: supplierContracts.alertDaysBeforeExpiry,
        createdBy: supplierContracts.createdBy,
        approvedBy: supplierContracts.approvedBy,
        approvedAt: supplierContracts.approvedAt,
        approvalNotes: supplierContracts.approvalNotes,
        createdAt: supplierContracts.createdAt,
        updatedAt: supplierContracts.updatedAt,
        linkedPurchaseOrderCount: sql<number>`(
          SELECT COUNT(*)::int
          FROM ${purchaseOrders}
          WHERE ${qualified(purchaseOrders.contractId)} = ${qualified(supplierContracts.id)}
        )`,
      })
      .from(supplierContracts)
      .leftJoin(suppliers, eq(supplierContracts.supplierId, suppliers.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supplierContracts.createdAt), desc(supplierContracts.id));

    res.json({ success: true, data: contracts, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch supplier contracts', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier contracts', code: 'SUPPLIER_CONTRACTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/contracts', authenticate, requirePermission('inventory:create'), validate(createSupplierContractSchema), async (req: Request, res: Response) => {
  try {
    const [supplier] = await db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, req.body.supplierId))
      .limit(1);

    if (!supplier || supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const contractCode = await generateSupplierContractCode(req.body.validFrom);
    const [contract] = await db
      .insert(supplierContracts)
      .values({
        contractCode,
        supplierId: req.body.supplierId,
        contractType: req.body.contractType,
        contractTitle: req.body.contractTitle,
        description: req.body.description || null,
        status: req.body.status,
        validFrom: req.body.validFrom,
        validTo: req.body.validTo || null,
        currencyCode: req.body.currencyCode,
        paymentTermsDays: req.body.paymentTermsDays,
        commercialTerms: req.body.commercialTerms || null,
        rateTable: req.body.rateTable || {},
        attachmentUrls: req.body.attachmentUrls || [],
        alertDaysBeforeExpiry: req.body.alertDaysBeforeExpiry,
        createdBy: req.user!.id,
      })
      .returning();

    if (req.body.terms?.length) {
      await db.insert(supplierContractTerms).values(
        req.body.terms.map((term: { termType: string; termKey: string; termValue: string; sortOrder?: number }) => ({
          contractId: contract.id,
          termType: term.termType,
          termKey: term.termKey,
          termValue: term.termValue,
          sortOrder: term.sortOrder ?? 0,
        })),
      );
    }

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_contract_created',
      entityType: 'supplier_contract',
      entityId: contract.id,
      changes: { supplierId: contract.supplierId, contractCode, status: contract.status },
    });

    res.status(201).json({ success: true, data: contract, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create supplier contract', { error });
    res.status(500).json({ success: false, error: 'Failed to create supplier contract', code: 'SUPPLIER_CONTRACT_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/contracts/:id', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id as string);
    const [contract] = await db
      .select({
        id: supplierContracts.id,
        contractCode: supplierContracts.contractCode,
        supplierId: supplierContracts.supplierId,
        supplierName: suppliers.supplierName,
        contractType: supplierContracts.contractType,
        contractTitle: supplierContracts.contractTitle,
        description: supplierContracts.description,
        status: supplierContracts.status,
        validFrom: supplierContracts.validFrom,
        validTo: supplierContracts.validTo,
        currencyCode: supplierContracts.currencyCode,
        paymentTermsDays: supplierContracts.paymentTermsDays,
        commercialTerms: supplierContracts.commercialTerms,
        rateTable: supplierContracts.rateTable,
        attachmentUrls: supplierContracts.attachmentUrls,
        alertDaysBeforeExpiry: supplierContracts.alertDaysBeforeExpiry,
        createdBy: supplierContracts.createdBy,
        approvedBy: supplierContracts.approvedBy,
        approvedAt: supplierContracts.approvedAt,
        approvalNotes: supplierContracts.approvalNotes,
        createdAt: supplierContracts.createdAt,
        updatedAt: supplierContracts.updatedAt,
      })
      .from(supplierContracts)
      .leftJoin(suppliers, eq(supplierContracts.supplierId, suppliers.id))
      .where(eq(supplierContracts.id, contractId))
      .limit(1);

    if (!contract) {
      res.status(404).json({ success: false, error: 'Supplier contract not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [terms, linkedPurchaseOrders, linkedInvoices] = await Promise.all([
      db.select().from(supplierContractTerms).where(eq(supplierContractTerms.contractId, contractId)).orderBy(asc(supplierContractTerms.sortOrder), asc(supplierContractTerms.id)),
      db.select({
        id: purchaseOrders.id,
        orderCode: purchaseOrders.orderCode,
        orderDate: purchaseOrders.orderDate,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
      }).from(purchaseOrders).where(eq(purchaseOrders.contractId, contractId)).orderBy(desc(purchaseOrders.orderDate)),
      db.select({
        id: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        invoiceReference: supplierInvoices.invoiceReference,
        invoiceDate: supplierInvoices.invoiceDate,
        dueDate: supplierInvoices.dueDate,
        invoiceAmount: supplierInvoices.invoiceAmount,
        status: supplierInvoices.status,
      }).from(supplierInvoices).where(eq(supplierInvoices.contractId, contractId)).orderBy(desc(supplierInvoices.invoiceDate)),
    ]);

    res.json({ success: true, data: { ...contract, terms, linkedPurchaseOrders, linkedInvoices }, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch supplier contract detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier contract detail', code: 'SUPPLIER_CONTRACT_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/contracts/:id/review', authenticate, requirePermission('inventory:update'), validate(reviewSupplierContractSchema), async (req: Request, res: Response) => {
  try {
    const contractId = Number(req.params.id as string);
    const [existing] = await db.select().from(supplierContracts).where(eq(supplierContracts.id, contractId)).limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Supplier contract not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(supplierContracts)
      .set({
        status: req.body.status,
        approvalNotes: req.body.approvalNotes || null,
        approvedBy: req.body.status === 'active' ? req.user!.id : null,
        approvedAt: req.body.status === 'active' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(supplierContracts.id, contractId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_contract_reviewed',
      entityType: 'supplier_contract',
      entityId: contractId,
      changes: {
        before: { status: existing.status, approvalNotes: existing.approvalNotes },
        after: { status: updated.status, approvalNotes: updated.approvalNotes },
      },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to review supplier contract', { error });
    res.status(500).json({ success: false, error: 'Failed to review supplier contract', code: 'SUPPLIER_CONTRACT_REVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/supplier-invoices', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { supplierId, purchaseOrderId, status } = req.query;
    const conditions = [];

    if (supplierId) {
      conditions.push(eq(supplierInvoices.supplierId, Number(supplierId)));
    }
    if (purchaseOrderId) {
      conditions.push(eq(supplierInvoices.purchaseOrderId, Number(purchaseOrderId)));
    }
    if (status && status !== 'all') {
      conditions.push(eq(supplierInvoices.status, String(status)));
    }

    const invoices = await db
      .select({
        id: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.supplierName,
        purchaseOrderId: supplierInvoices.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
        contractId: supplierInvoices.contractId,
        contractCode: supplierContracts.contractCode,
        invoiceReference: supplierInvoices.invoiceReference,
        invoiceDate: supplierInvoices.invoiceDate,
        dueDate: supplierInvoices.dueDate,
        invoiceAmount: supplierInvoices.invoiceAmount,
        currencyCode: supplierInvoices.currencyCode,
        status: supplierInvoices.status,
        matchStatus: supplierInvoices.matchStatus,
        receivedValue: supplierInvoices.receivedValue,
        matchVariance: supplierInvoices.matchVariance,
        overrideNote: supplierInvoices.overrideNote,
        approvedBy: supplierInvoices.approvedBy,
        approvedAt: supplierInvoices.approvedAt,
        approvalNotes: supplierInvoices.approvalNotes,
        notes: supplierInvoices.notes,
        createdBy: supplierInvoices.createdBy,
        createdAt: supplierInvoices.createdAt,
        updatedAt: supplierInvoices.updatedAt,
        paidAmount: sql<number>`(
          SELECT COALESCE(SUM(${qualified(supplierPaymentAllocations.allocatedAmount)}::numeric), 0)::float
          FROM ${supplierPaymentAllocations}
          INNER JOIN ${supplierPayments} ON ${qualified(supplierPayments.id)} = ${qualified(supplierPaymentAllocations.supplierPaymentId)}
          WHERE ${qualified(supplierPaymentAllocations.supplierInvoiceId)} = ${qualified(supplierInvoices.id)}
            AND ${qualified(supplierPayments.paymentStatus)} IN ('pending', 'completed')
        )`,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .leftJoin(purchaseOrders, eq(supplierInvoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(supplierContracts, eq(supplierInvoices.contractId, supplierContracts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(supplierInvoices.invoiceDate), desc(supplierInvoices.id));

    res.json({
      success: true,
      data: invoices.map((invoice) => {
        const paidAmount = Math.round(Number(invoice.paidAmount ?? 0) * 100) / 100;
        const invoiceAmount = Number(invoice.invoiceAmount);
        return {
          ...invoice,
          paidAmount,
          balanceDue: Math.round((invoiceAmount - paidAmount) * 100) / 100,
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch supplier invoices', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier invoices', code: 'SUPPLIER_INVOICES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/supplier-invoices', authenticate, requirePermission('inventory:create'), validate(createSupplierInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, req.body.supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (req.body.purchaseOrderId) {
      const [purchaseOrder] = await db
        .select({
          id: purchaseOrders.id,
          supplierId: purchaseOrders.supplierId,
          contractId: purchaseOrders.contractId,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.id, req.body.purchaseOrderId))
        .limit(1);

      if (!purchaseOrder || purchaseOrder.supplierId !== req.body.supplierId) {
        res.status(400).json({ success: false, error: 'Purchase order does not belong to the selected supplier', code: 'INVALID_PURCHASE_ORDER', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }

      if (req.body.contractId && purchaseOrder.contractId && purchaseOrder.contractId !== req.body.contractId) {
        res.status(400).json({ success: false, error: 'Selected contract does not match the purchase order', code: 'CONTRACT_MISMATCH', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (req.body.contractId) {
      const [contract] = await db
        .select()
        .from(supplierContracts)
        .where(eq(supplierContracts.id, req.body.contractId))
        .limit(1);
      if (!contract || contract.supplierId !== req.body.supplierId) {
        res.status(400).json({ success: false, error: 'Contract does not belong to the selected supplier', code: 'INVALID_CONTRACT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const invoiceCode = await generateSupplierInvoiceCode(req.body.invoiceDate);
    const [invoice] = await db
      .insert(supplierInvoices)
      .values({
        invoiceCode,
        supplierId: req.body.supplierId,
        purchaseOrderId: req.body.purchaseOrderId ?? null,
        contractId: req.body.contractId ?? null,
        invoiceReference: req.body.invoiceReference,
        invoiceDate: req.body.invoiceDate,
        dueDate: req.body.dueDate,
        invoiceAmount: req.body.invoiceAmount.toFixed(2),
        ...(await (async () => {
          const match = await computeInvoiceMatch({ purchaseOrderId: req.body.purchaseOrderId ?? null, invoiceAmount: req.body.invoiceAmount });
          return {
            matchStatus: match.matchStatus,
            receivedValue: match.receivedValue != null ? String(match.receivedValue) : null,
            matchVariance: match.matchVariance != null ? String(match.matchVariance) : null,
          };
        })()),
        currencyCode: req.body.currencyCode,
        status: req.body.status,
        notes: req.body.notes ?? null,
        createdBy: req.user!.id,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_invoice_created',
      entityType: 'supplier_invoice',
      entityId: invoice.id,
      changes: { supplierId: invoice.supplierId, purchaseOrderId: invoice.purchaseOrderId, invoiceCode, invoiceAmount: req.body.invoiceAmount },
    });

    res.status(201).json({ success: true, data: invoice, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create supplier invoice', { error });
    res.status(500).json({ success: false, error: 'Failed to create supplier invoice', code: 'SUPPLIER_INVOICE_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/supplier-invoices/:id', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const invoiceId = Number(req.params.id as string);
    const [invoice] = await db
      .select({
        id: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.supplierName,
        purchaseOrderId: supplierInvoices.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
        contractId: supplierInvoices.contractId,
        contractCode: supplierContracts.contractCode,
        invoiceReference: supplierInvoices.invoiceReference,
        invoiceDate: supplierInvoices.invoiceDate,
        dueDate: supplierInvoices.dueDate,
        invoiceAmount: supplierInvoices.invoiceAmount,
        currencyCode: supplierInvoices.currencyCode,
        status: supplierInvoices.status,
        matchStatus: supplierInvoices.matchStatus,
        receivedValue: supplierInvoices.receivedValue,
        matchVariance: supplierInvoices.matchVariance,
        overrideNote: supplierInvoices.overrideNote,
        approvedBy: supplierInvoices.approvedBy,
        approvedAt: supplierInvoices.approvedAt,
        approvalNotes: supplierInvoices.approvalNotes,
        notes: supplierInvoices.notes,
        createdBy: supplierInvoices.createdBy,
        createdAt: supplierInvoices.createdAt,
        updatedAt: supplierInvoices.updatedAt,
      })
      .from(supplierInvoices)
      .leftJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .leftJoin(purchaseOrders, eq(supplierInvoices.purchaseOrderId, purchaseOrders.id))
      .leftJoin(supplierContracts, eq(supplierInvoices.contractId, supplierContracts.id))
      .where(eq(supplierInvoices.id, invoiceId))
      .limit(1);

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Supplier invoice not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const allocations = await db
      .select({
        id: supplierPaymentAllocations.id,
        supplierPaymentId: supplierPaymentAllocations.supplierPaymentId,
        allocatedAmount: supplierPaymentAllocations.allocatedAmount,
        paymentCode: supplierPayments.paymentCode,
        paymentDate: supplierPayments.paymentDate,
        paymentMethod: supplierPayments.paymentMethod,
        paymentStatus: supplierPayments.paymentStatus,
        treasuryTransactionId: supplierPayments.treasuryTransactionId,
      })
      .from(supplierPaymentAllocations)
      .innerJoin(supplierPayments, eq(supplierPaymentAllocations.supplierPaymentId, supplierPayments.id))
      .where(eq(supplierPaymentAllocations.supplierInvoiceId, invoiceId))
      .orderBy(desc(supplierPayments.paymentDate), desc(supplierPaymentAllocations.id));

    const paidAmount = allocations
      .filter((allocation) => ['pending', 'completed'].includes(String(allocation.paymentStatus)))
      .reduce((sum, allocation) => sum + Number(allocation.allocatedAmount), 0);

    res.json({
      success: true,
      data: {
        ...invoice,
        allocations,
        paidAmount: Math.round(paidAmount * 100) / 100,
        balanceDue: Math.round((Number(invoice.invoiceAmount) - paidAmount) * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch supplier invoice detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch supplier invoice detail', code: 'SUPPLIER_INVOICE_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/supplier-invoices/:id/review', authenticate, requirePermission('inventory:update'), validate(reviewSupplierInvoiceSchema), async (req: Request, res: Response) => {
  try {
    const invoiceId = Number(req.params.id as string);
    const [existing] = await db.select().from(supplierInvoices).where(eq(supplierInvoices.id, invoiceId)).limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Supplier invoice not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status === 'cancelled') {
      res.status(400).json({ success: false, error: 'Cancelled invoices cannot be reviewed', code: 'INVALID_INVOICE_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const match = await computeInvoiceMatch({ purchaseOrderId: existing.purchaseOrderId, invoiceAmount: Number(existing.invoiceAmount), excludeInvoiceId: existing.id });
    if (req.body.status === 'approved' && match.matchStatus === 'over_billed' && !req.body.overrideNote?.trim()) {
      res.status(400).json({
        success: false,
        error: `This invoice is ${Math.abs(match.matchVariance ?? 0).toLocaleString('en-US')} more than the goods received on its order (Rs ${(match.receivedValue ?? 0).toLocaleString('en-US')}). Receive the rest of the goods first, or give a reason to approve anyway.`,
        code: 'INVOICE_OVER_BILLED',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const [updated] = await db
      .update(supplierInvoices)
      .set({
        matchStatus: match.matchStatus,
        receivedValue: match.receivedValue != null ? String(match.receivedValue) : null,
        matchVariance: match.matchVariance != null ? String(match.matchVariance) : null,
        overrideNote: req.body.overrideNote?.trim() || existing.overrideNote || null,
        status: req.body.status,
        approvedBy: req.body.status === 'approved' ? req.user!.id : null,
        approvedAt: req.body.status === 'approved' ? new Date() : null,
        approvalNotes: req.body.approvalNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(supplierInvoices.id, invoiceId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'supplier_invoice_reviewed',
      entityType: 'supplier_invoice',
      entityId: invoiceId,
      changes: {
        before: { status: existing.status, approvalNotes: existing.approvalNotes },
        after: { status: updated.status, approvalNotes: updated.approvalNotes },
      },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to review supplier invoice', { error });
    res.status(500).json({ success: false, error: 'Failed to review supplier invoice', code: 'SUPPLIER_INVOICE_REVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/payables/summary', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { supplierId } = req.query;
    const conditions = [];

    if (supplierId) {
      conditions.push(eq(supplierInvoices.supplierId, Number(supplierId)));
    }

    const summaries = await db
      .select({
        supplierId: supplierInvoices.supplierId,
        supplierName: suppliers.supplierName,
        purchaseOrderId: supplierInvoices.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
        invoiceId: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        invoiceReference: supplierInvoices.invoiceReference,
        dueDate: supplierInvoices.dueDate,
        orderedAmount: sql<number>`COALESCE((
          SELECT SUM(${qualified(purchaseOrderItems.orderedQuantity)}::numeric * ${qualified(purchaseOrderItems.unitPrice)}::numeric)
          FROM ${purchaseOrderItems}
          WHERE ${qualified(purchaseOrderItems.purchaseOrderId)} = ${qualified(supplierInvoices.purchaseOrderId)}
        ), 0)::float`,
        receivedAmount: sql<number>`COALESCE((
          SELECT SUM(${qualified(purchaseOrderItems.receivedQuantity)}::numeric * ${qualified(purchaseOrderItems.unitPrice)}::numeric)
          FROM ${purchaseOrderItems}
          WHERE ${qualified(purchaseOrderItems.purchaseOrderId)} = ${qualified(supplierInvoices.purchaseOrderId)}
        ), 0)::float`,
        invoicedAmount: supplierInvoices.invoiceAmount,
        paidAmount: sql<number>`COALESCE((
          SELECT SUM(${qualified(supplierPaymentAllocations.allocatedAmount)}::numeric)
          FROM ${supplierPaymentAllocations}
          INNER JOIN ${supplierPayments} ON ${qualified(supplierPayments.id)} = ${qualified(supplierPaymentAllocations.supplierPaymentId)}
          WHERE ${qualified(supplierPaymentAllocations.supplierInvoiceId)} = ${qualified(supplierInvoices.id)}
            AND ${qualified(supplierPayments.paymentStatus)} IN ('pending', 'completed')
        ), 0)::float`,
      })
      .from(supplierInvoices)
      .innerJoin(suppliers, eq(supplierInvoices.supplierId, suppliers.id))
      .leftJoin(purchaseOrders, eq(supplierInvoices.purchaseOrderId, purchaseOrders.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(suppliers.supplierName), asc(supplierInvoices.dueDate), asc(supplierInvoices.id));

    res.json({
      success: true,
      data: summaries.map((summary) => {
        const balanceDue = Math.round((Number(summary.invoicedAmount) - Number(summary.paidAmount ?? 0)) * 100) / 100;
        return {
          ...summary,
          balanceDue,
          paymentStatus: balanceDue <= 0 ? 'paid' : Number(summary.paidAmount ?? 0) > 0 ? 'partially_paid' : 'unpaid',
        };
      }),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch payables summary', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch payables summary', code: 'PAYABLES_SUMMARY_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/service-work-orders', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, serviceType, siteId, batchId } = req.query;
    const conditions = [];

    if (status && status !== 'all') conditions.push(eq(serviceWorkOrders.status, String(status)));
    if (serviceType && serviceType !== 'all') conditions.push(eq(serviceWorkOrders.serviceType, String(serviceType)));
    if (siteId) conditions.push(eq(serviceWorkOrders.siteId, Number(siteId)));
    if (batchId) conditions.push(eq(serviceWorkOrders.batchId, Number(batchId)));

    const workOrders = await db
      .select({
        id: serviceWorkOrders.id,
        workOrderCode: serviceWorkOrders.workOrderCode,
        serviceType: serviceWorkOrders.serviceType,
        title: serviceWorkOrders.title,
        supplierId: serviceWorkOrders.supplierId,
        supplierName: suppliers.supplierName,
        contractId: serviceWorkOrders.contractId,
        contractCode: supplierContracts.contractCode,
        allocationType: serviceWorkOrders.allocationType,
        siteId: serviceWorkOrders.siteId,
        siteName: sites.siteName,
        batchId: serviceWorkOrders.batchId,
        batchCode: batches.batchCode,
        serviceDate: serviceWorkOrders.serviceDate,
        invoiceReference: serviceWorkOrders.invoiceReference,
        quantity: serviceWorkOrders.quantity,
        unit: serviceWorkOrders.unit,
        unitRate: serviceWorkOrders.unitRate,
        totalAmount: serviceWorkOrders.totalAmount,
        status: serviceWorkOrders.status,
        approvalNotes: serviceWorkOrders.approvalNotes,
        approvedBy: serviceWorkOrders.approvedBy,
        approvedAt: serviceWorkOrders.approvedAt,
        financeAccountId: serviceWorkOrders.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: serviceWorkOrders.paymentMethod,
        referenceNumber: serviceWorkOrders.referenceNumber,
        chequeNumber: serviceWorkOrders.chequeNumber,
        supplierPaymentId: serviceWorkOrders.supplierPaymentId,
        treasuryTransactionId: serviceWorkOrders.treasuryTransactionId,
        notes: serviceWorkOrders.notes,
        requestedBy: serviceWorkOrders.requestedBy,
        createdAt: serviceWorkOrders.createdAt,
        updatedAt: serviceWorkOrders.updatedAt,
      })
      .from(serviceWorkOrders)
      .leftJoin(suppliers, eq(serviceWorkOrders.supplierId, suppliers.id))
      .leftJoin(supplierContracts, eq(serviceWorkOrders.contractId, supplierContracts.id))
      .leftJoin(sites, eq(serviceWorkOrders.siteId, sites.id))
      .leftJoin(batches, eq(serviceWorkOrders.batchId, batches.id))
      .leftJoin(financeAccounts, eq(serviceWorkOrders.financeAccountId, financeAccounts.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(serviceWorkOrders.serviceDate), desc(serviceWorkOrders.id));

    res.json({ success: true, data: workOrders, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch service work orders', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch service work orders', code: 'SERVICE_WORK_ORDERS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/service-work-orders', authenticate, requirePermission('inventory:create'), validate(createServiceWorkOrderSchema), async (req: Request, res: Response) => {
  try {
    await assertPeriodOpen(req.body.serviceDate, 'financial');

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, req.body.supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (req.body.contractId) {
      const [contract] = await db.select().from(supplierContracts).where(eq(supplierContracts.id, req.body.contractId)).limit(1);
      if (!contract || contract.supplierId !== req.body.supplierId) {
        res.status(400).json({ success: false, error: 'Contract does not belong to the selected supplier', code: 'INVALID_CONTRACT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (req.body.siteId) {
      const [site] = await db.select({ id: sites.id }).from(sites).where(eq(sites.id, req.body.siteId)).limit(1);
      if (!site) {
        res.status(404).json({ success: false, error: 'Site not found', code: 'SITE_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (req.body.batchId) {
      const [batch] = await db.select({ id: batches.id }).from(batches).where(eq(batches.id, req.body.batchId)).limit(1);
      if (!batch) {
        res.status(404).json({ success: false, error: 'Batch not found', code: 'BATCH_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
    }

    const workOrderTags = await resolveEntryTags({
      categoryId: req.body.categoryId ?? null,
      categoryCode: req.body.categoryId ? null : serviceTypeCategoryCode(req.body.serviceType),
      costCentreId: req.body.costCentreId ?? null,
      batchId: req.body.allocationType === 'batch' ? req.body.batchId ?? null : null,
      siteId: req.body.allocationType === 'site' ? req.body.siteId ?? null : null,
      costCentreCode: req.body.costCentreId
        ? null
        : req.body.allocationType === 'mill' ? 'MILL' : req.body.allocationType === 'shared_overhead' ? 'ADMIN' : null,
    });

    const workOrderCode = await generateServiceWorkOrderCode(req.body.serviceDate);
    const [created] = await db
      .insert(serviceWorkOrders)
      .values({
        workOrderCode,
        serviceType: req.body.serviceType,
        title: req.body.title,
        supplierId: req.body.supplierId,
        contractId: req.body.contractId ?? null,
        categoryId: workOrderTags.categoryId,
        costCentreId: workOrderTags.costCentreId,
        allocationType: req.body.allocationType,
        siteId: req.body.siteId ?? null,
        batchId: req.body.batchId ?? null,
        serviceDate: req.body.serviceDate,
        invoiceReference: req.body.invoiceReference ?? null,
        quantity: req.body.quantity != null ? String(req.body.quantity) : null,
        unit: req.body.unit ?? null,
        unitRate: req.body.unitRate != null ? String(req.body.unitRate) : null,
        totalAmount: req.body.totalAmount.toFixed(2),
        status: 'pending_approval',
        requestedBy: req.user!.id,
        notes: req.body.notes ?? null,
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'service_work_order_created',
      entityType: 'service_work_order',
      entityId: created.id,
      changes: { workOrderCode, serviceType: created.serviceType, totalAmount: created.totalAmount },
    });

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create service work order', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create service work order', code: 'SERVICE_WORK_ORDER_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/service-work-orders/:id/review', authenticate, requirePermission('inventory:update'), validate(reviewServiceWorkOrderSchema), async (req: Request, res: Response) => {
  try {
    const workOrderId = Number(req.params.id as string);
    const [existing] = await db.select().from(serviceWorkOrders).where(eq(serviceWorkOrders.id, workOrderId)).limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Service work order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status !== 'pending_approval') {
      res.status(400).json({ success: false, error: 'Only pending work orders can be reviewed', code: 'INVALID_WORK_ORDER_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(serviceWorkOrders)
      .set({
        status: req.body.status,
        approvalNotes: req.body.approvalNotes || null,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(serviceWorkOrders.id, workOrderId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'service_work_order_reviewed',
      entityType: 'service_work_order',
      entityId: workOrderId,
      changes: { before: { status: existing.status }, after: { status: updated.status } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to review service work order', { error });
    res.status(500).json({ success: false, error: 'Failed to review service work order', code: 'SERVICE_WORK_ORDER_REVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/service-work-orders/:id/settle', authenticate, requirePermission('inventory:update'), validate(settleServiceWorkOrderSchema), async (req: Request, res: Response) => {
  try {
    const workOrderId = Number(req.params.id as string);
    const [workOrder] = await db.select().from(serviceWorkOrders).where(eq(serviceWorkOrders.id, workOrderId)).limit(1);

    if (!workOrder) {
      res.status(404).json({ success: false, error: 'Service work order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (workOrder.status !== 'approved') {
      res.status(400).json({ success: false, error: 'Service work order must be approved before settlement', code: 'INVALID_WORK_ORDER_STATUS', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const paymentDate = req.body.paymentDate || String(workOrder.serviceDate);
    await assertPeriodOpen(paymentDate, 'financial');

    const payment = await createSupplierPayment({
      supplierId: workOrder.supplierId!,
      paymentDate,
      financeAccountId: req.body.financeAccountId,
      paymentMethod: req.body.paymentMethod,
      amount: Number(workOrder.totalAmount),
      referenceNumber: req.body.referenceNumber || workOrder.invoiceReference || workOrder.workOrderCode,
      chequeLeafId: req.body.chequeLeafId ?? null,
      notes: workOrder.notes ?? workOrder.title,
      recordedBy: req.user!.id,
      tags: {
        categoryId: workOrder.categoryId,
        costCentreId: workOrder.costCentreId,
        batchId: workOrder.batchId,
        siteId: workOrder.siteId,
        categoryCode: workOrder.categoryId ? null : serviceTypeCategoryCode(workOrder.serviceType),
        costCentreCode: workOrder.costCentreId || workOrder.batchId || workOrder.siteId ? null : 'ADMIN',
      },
    });

    if (payment.treasuryTransactionId) {
      await db.insert(treasuryTransactionLinks).values({
        treasuryTransactionId: payment.treasuryTransactionId,
        sourceModule: 'inventory',
        sourceEntityType: 'service_work_order',
        sourceEntityId: workOrderId,
        sourceCodeSnapshot: workOrder.workOrderCode,
        allocatedAmount: String(workOrder.totalAmount),
      });
    }

    const [updated] = await db
      .update(serviceWorkOrders)
      .set({
        status: req.body.paymentMethod === 'cheque' ? 'pending' : 'paid',
        financeAccountId: req.body.financeAccountId,
        paymentMethod: req.body.paymentMethod,
        referenceNumber: req.body.referenceNumber || null,
        chequeLeafId: req.body.chequeLeafId ?? null,
        chequeNumber: payment.chequeNumber ?? null,
        supplierPaymentId: payment.id,
        treasuryTransactionId: payment.treasuryTransactionId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(serviceWorkOrders.id, workOrderId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'service_work_order_settled',
      entityType: 'service_work_order',
      entityId: workOrderId,
      changes: { supplierPaymentId: payment.id, treasuryTransactionId: payment.treasuryTransactionId },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to settle service work order', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to settle service work order', code: 'SERVICE_WORK_ORDER_SETTLE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/suppliers', authenticate, requirePermission('inventory:create'), validate(createSupplierSchema), async (req: Request, res: Response) => {
  try {
    const { supplierName, contactPerson, phoneNumber, email, address } = req.body;

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.supplierName, supplierName)).limit(1);
    if (existing) {
      res.status(409).json({ success: false, error: 'A supplier with this name already exists', code: 'SUPPLIER_NAME_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [created] = await db
      .insert(suppliers)
      .values({
        supplierName,
        contactPerson: contactPerson || null,
        phoneNumber: phoneNumber || null,
        email: email || null,
        address: address || null,
        defaultCategoryId: req.body.defaultCategoryId ?? null,
        status: 'active',
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_supplier_created',
      entityType: 'supplier',
      entityId: created.id,
      changes: { supplierName, contactPerson, phoneNumber, email },
    });

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create inventory supplier', { error });
    res.status(500).json({ success: false, error: 'Failed to create supplier', code: 'CREATE_SUPPLIER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/suppliers/:id', authenticate, requirePermission('inventory:update'), validate(updateSupplierSchema), async (req: Request, res: Response) => {
  try {
    const supplierId = Number(req.params.id as string);

    const [existing] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Supplier not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db
      .update(suppliers)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(suppliers.id, supplierId))
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_supplier_updated',
      entityType: 'supplier',
      entityId: supplierId,
      changes: { before: existing, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update inventory supplier', { error });
    res.status(500).json({ success: false, error: 'Failed to update supplier', code: 'UPDATE_SUPPLIER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// INVENTORY ITEMS
// =============================================================================

router.get('/items', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { search, itemTypeId, category, feedOnly = 'false', page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: feedInventory.id,
        itemTypeId: feedInventory.itemTypeId,
        itemCode: feedInventory.itemCode,
        ingredientName: feedInventory.ingredientName,
        description: feedInventory.description,
        supplierId: feedInventory.supplierId,
        supplierName: suppliers.supplierName,
        quantity: feedInventory.quantity,
        unit: feedInventory.unit,
        costPerUnit: feedInventory.costPerUnit,
        reorderLevel: feedInventory.reorderLevel,
        lastRestockDate: feedInventory.lastRestockDate,
        createdAt: feedInventory.createdAt,
        updatedAt: feedInventory.updatedAt,
        typeCode: inventoryItemTypes.typeCode,
        typeName: inventoryItemTypes.typeName,
        category: inventoryItemTypes.category,
        defaultUnit: inventoryItemTypes.defaultUnit,
        allowsBatchAllocation: inventoryItemTypes.allowsBatchAllocation,
        isFeed: inventoryItemTypes.isFeed,
      })
      .from(feedInventory)
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .leftJoin(suppliers, eq(feedInventory.supplierId, suppliers.id))
      .$dynamic();

    const conditions = [];
    if (search) {
      conditions.push(ilike(feedInventory.ingredientName, `%${search as string}%`));
    }
    if (itemTypeId) {
      conditions.push(eq(feedInventory.itemTypeId, Number(itemTypeId)));
    }
    if (category && category !== 'all') {
      conditions.push(eq(inventoryItemTypes.category, category as string));
    }
    if (feedOnly === 'true') {
      conditions.push(eq(inventoryItemTypes.isFeed, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(feedInventory.createdAt)).limit(limitNum).offset(offset);

    let countQuery = db
      .select({ total: sql<number>`count(*)::int` })
      .from(feedInventory)
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .$dynamic();

    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }

    const [{ total }] = await countQuery;
    const itemIds = results.map((item) => item.id);
    let lotCounts: Record<number, number> = {};
    if (itemIds.length > 0) {
      const lotCountRows = await db
        .select({
          inventoryItemId: inventoryLots.inventoryItemId,
          count: sql<number>`count(*)::int`,
        })
        .from(inventoryLots)
        .where(sql`${inventoryLots.inventoryItemId} IN (${sql.join(itemIds.map((id) => sql`${id}`), sql`, `)}) AND ${inventoryLots.remainingQuantity}::numeric > 0`)
        .groupBy(inventoryLots.inventoryItemId);

      lotCounts = Object.fromEntries(lotCountRows.map((row) => [row.inventoryItemId, row.count]));
    }

    res.json({
      success: true,
      data: results.map((item) => ({
        ...item,
        lowStock: item.reorderLevel ? Number(item.quantity) < Number(item.reorderLevel) : false,
        lotCount: lotCounts[item.id] ?? 0,
      })),
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory items', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory items', code: 'INVENTORY_ITEMS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/items/:id', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const item = await getInventoryItemWithType(itemId);

    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const lots = await db
      .select({
        id: inventoryLots.id,
        purchaseOrderItemId: inventoryLots.purchaseOrderItemId,
        lotCode: inventoryLots.lotCode,
        receivedQuantity: inventoryLots.receivedQuantity,
        remainingQuantity: inventoryLots.remainingQuantity,
        costPerUnit: inventoryLots.costPerUnit,
        receivedDate: inventoryLots.receivedDate,
        notes: inventoryLots.notes,
        poOrderCode: purchaseOrders.orderCode,
      })
      .from(inventoryLots)
      .leftJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(eq(inventoryLots.inventoryItemId, itemId))
      .orderBy(asc(inventoryLots.receivedDate), asc(inventoryLots.id));

    const consumptions = await db
      .select({
        id: batchInventoryConsumptions.id,
        batchId: batchInventoryConsumptions.batchId,
        batchCode: batches.batchCode,
        quantity: batchInventoryConsumptions.quantity,
        unit: batchInventoryConsumptions.unit,
        unitCost: batchInventoryConsumptions.unitCost,
        lineCost: batchInventoryConsumptions.lineCost,
        consumptionDate: batchInventoryConsumptions.consumptionDate,
        referenceType: batchInventoryConsumptions.referenceType,
        referenceId: batchInventoryConsumptions.referenceId,
        notes: batchInventoryConsumptions.notes,
        inventoryLotId: batchInventoryConsumptions.inventoryLotId,
      })
      .from(batchInventoryConsumptions)
      .innerJoin(batches, eq(batchInventoryConsumptions.batchId, batches.id))
      .where(eq(batchInventoryConsumptions.inventoryItemId, itemId))
      .orderBy(desc(batchInventoryConsumptions.consumptionDate), desc(batchInventoryConsumptions.id));

    const totalConsumed = consumptions.reduce((sum, row) => sum + Number(row.quantity), 0);
    const totalConsumedCost = consumptions.reduce((sum, row) => sum + Number(row.lineCost), 0);

    res.json({
      success: true,
      data: {
        item,
        lots,
        consumptions,
        summary: {
          totalConsumed: Math.round(totalConsumed * 100) / 100,
          totalConsumedCost: Math.round(totalConsumedCost * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory item detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory item detail', code: 'INVENTORY_ITEM_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/items', authenticate, requirePermission('inventory:create'), validate(createInventoryItemSchema), async (req: Request, res: Response) => {
  try {
    const { itemTypeId, itemCode, ingredientName, description, supplierId, quantity, unit, costPerUnit, reorderLevel } = req.body;

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [itemType] = await db.select().from(inventoryItemTypes).where(eq(inventoryItemTypes.id, itemTypeId)).limit(1);
    if (!itemType || itemType.status !== 'active') {
      res.status(400).json({ success: false, error: 'Inventory type must exist and be active', code: 'INVALID_ITEM_TYPE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [created] = await db
      .insert(feedInventory)
      .values({
        itemTypeId,
        itemCode: itemCode || null,
        ingredientName,
        description: description || null,
        supplierId,
        quantity: String(quantity),
        unit,
        costPerUnit: String(costPerUnit),
        reorderLevel: reorderLevel != null ? String(reorderLevel) : null,
        lastRestockDate: new Date().toISOString().split('T')[0],
      })
      .returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_item_created',
      entityType: 'inventory_item',
      entityId: created.id,
      changes: { itemTypeId, ingredientName, supplierId, quantity, unit, costPerUnit },
    });

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create inventory item', { error });
    res.status(500).json({ success: false, error: 'Failed to create inventory item', code: 'CREATE_INVENTORY_ITEM_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/items/:id', authenticate, requirePermission('inventory:update'), validate(updateInventoryItemSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const [existing] = await db.select().from(feedInventory).where(eq(feedInventory.id, itemId)).limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (req.body.supplierId) {
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, req.body.supplierId)).limit(1);
      if (!supplier || supplier.status !== 'active') {
        res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    if (req.body.itemTypeId) {
      const [itemType] = await db.select().from(inventoryItemTypes).where(eq(inventoryItemTypes.id, req.body.itemTypeId)).limit(1);
      if (!itemType || itemType.status !== 'active') {
        res.status(400).json({ success: false, error: 'Inventory type must exist and be active', code: 'INVALID_ITEM_TYPE', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const updateData: Record<string, unknown> = { ...req.body, updatedAt: new Date() };
    if (req.body.quantity !== undefined) updateData.quantity = String(req.body.quantity);
    if (req.body.costPerUnit !== undefined) updateData.costPerUnit = String(req.body.costPerUnit);
    if (req.body.reorderLevel !== undefined) updateData.reorderLevel = req.body.reorderLevel != null ? String(req.body.reorderLevel) : null;

    const [updated] = await db.update(feedInventory).set(updateData).where(eq(feedInventory.id, itemId)).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_item_updated',
      entityType: 'inventory_item',
      entityId: itemId,
      changes: { before: existing, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update inventory item', { error });
    res.status(500).json({ success: false, error: 'Failed to update inventory item', code: 'UPDATE_INVENTORY_ITEM_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/items/:id/consume', authenticate, requirePermission('inventory:update'), validate(consumeInventoryToBatchSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { batchId, quantity, consumptionDate, notes } = req.body;
    await assertPeriodOpen(consumptionDate, 'inventory');

    const item = await getInventoryItemWithType(itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (item.isFeed) {
      res.status(400).json({ success: false, error: 'Feed items must be consumed through feed production or distribution flows', code: 'FEED_ITEM_NOT_ALLOWED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (!item.allowsBatchAllocation) {
      res.status(400).json({ success: false, error: 'This inventory type does not allow batch consumption', code: 'BATCH_ALLOCATION_DISABLED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [batch] = await db.select({ id: batches.id, batchCode: batches.batchCode, status: batches.status }).from(batches).where(eq(batches.id, batchId)).limit(1);
    if (batch?.status === 'closed') {
      res.status(400).json({ success: false, error: 'This batch is closed. Reopen it to make changes.', code: 'BATCH_CLOSED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (!batch) {
      res.status(404).json({ success: false, error: 'Batch not found', code: 'BATCH_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (Number(item.quantity) < quantity) {
      res.status(400).json({ success: false, error: 'Insufficient inventory quantity', code: 'INSUFFICIENT_INVENTORY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    let lotConsumptions: LotConsumption[] = [];
    let totalCost = 0;
    try {
      const store = await farmStoreForBatch(batchId);
      const result = await consumeInventoryFIFO(itemId, quantity, store?.id);
      lotConsumptions = result.lotConsumptions;
      totalCost = result.totalCost;
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (error instanceof StockError) { sendStockError(res, error); return; }
      logger.warn('Falling back to weighted cost for batch consumption', { itemId, error: (error as Error).message });
      totalCost = Math.round(quantity * Number(item.costPerUnit) * 100) / 100;
    }

    const previousQuantity = Number(item.quantity);
    const newQuantity = Math.round((previousQuantity - quantity) * 100) / 100;

    for (const consumption of lotConsumptions) {
      await db.update(inventoryLots).set({
        remainingQuantity: String(consumption.newRemaining),
      }).where(eq(inventoryLots.id, consumption.lotId));

      await db.insert(batchInventoryConsumptions).values({
        batchId,
        inventoryItemId: itemId,
        inventoryLotId: consumption.lotId,
        purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
        quantity: String(consumption.quantityUsed),
        unit: item.unit,
        unitCost: String(consumption.costPerUnit),
        lineCost: String(consumption.lineCost),
        consumptionDate,
        referenceType: 'inventory_item',
        referenceId: itemId,
        notes: notes || null,
        createdBy: req.user!.id,
      });

      await db.insert(inventoryAuditTrail).values({
        inventoryItemId: itemId,
        changeType: 'batch_consumption',
        previousQuantity: String(consumption.previousRemaining),
        changeQuantity: String(-consumption.quantityUsed),
        newQuantity: String(consumption.newRemaining),
        referenceId: batchId,
        referenceType: 'batch',
        notes: `Batch ${batch.batchCode}${notes ? ` - ${notes}` : ''}`,
        lotId: consumption.lotId,
        costAtTime: String(consumption.costPerUnit),
        performedBy: req.user!.id,
      });

      await postInventoryMovement({
        movementType: 'batch_consume',
        movementDate: consumptionDate,
        sourceModule: 'inventory',
        sourceEntityType: 'batch_inventory_consumption',
        sourceEntityId: batchId,
        sourceCodeSnapshot: batch.batchCode,
        inventoryItemId: itemId,
        inventoryLotId: consumption.lotId,
        purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
        batchId,
        quantity: -consumption.quantityUsed,
        unit: item.unit,
        unitCost: consumption.costPerUnit,
        lineCost: consumption.lineCost,
        balanceAfterQuantity: consumption.newRemaining,
        balanceScope: 'inventory_lot',
        notes: notes || null,
        createdBy: req.user!.id,
      });
    }

    if (lotConsumptions.length === 0) {
      const unitCost = Number(item.costPerUnit);
      await db.insert(batchInventoryConsumptions).values({
        batchId,
        inventoryItemId: itemId,
        quantity: String(quantity),
        unit: item.unit,
        unitCost: String(unitCost),
        lineCost: String(totalCost),
        consumptionDate,
        referenceType: 'inventory_item',
        referenceId: itemId,
        notes: notes || null,
        createdBy: req.user!.id,
      });

      await db.insert(inventoryAuditTrail).values({
        inventoryItemId: itemId,
        changeType: 'batch_consumption',
        previousQuantity: String(previousQuantity),
        changeQuantity: String(-quantity),
        newQuantity: String(newQuantity),
        referenceId: batchId,
        referenceType: 'batch',
        notes: `Batch ${batch.batchCode}${notes ? ` - ${notes}` : ''}`,
        costAtTime: String(unitCost),
        performedBy: req.user!.id,
      });

      await postInventoryMovement({
        movementType: 'batch_consume',
        movementDate: consumptionDate,
        sourceModule: 'inventory',
        sourceEntityType: 'batch_inventory_consumption',
        sourceEntityId: batchId,
        sourceCodeSnapshot: batch.batchCode,
        inventoryItemId: itemId,
        batchId,
        quantity: -quantity,
        unit: item.unit,
        unitCost,
        lineCost: totalCost,
        balanceAfterQuantity: newQuantity,
        balanceScope: 'inventory_item',
        notes: notes || null,
        createdBy: req.user!.id,
      });
    }

    const weightedAvgCost = await recalculateWeightedAverageCost(itemId);
    await db.update(feedInventory).set({
      quantity: String(newQuantity),
      costPerUnit: String(weightedAvgCost || Number(item.costPerUnit)),
      updatedAt: new Date(),
    }).where(eq(feedInventory.id, itemId));

    createAuditLog({
      userId: req.user!.id,
      action: 'batch_inventory_consumed',
      entityType: 'batch_inventory_consumption',
      entityId: batchId,
      changes: { inventoryItemId: itemId, quantity, batchId, totalCost, notes },
    });

    res.json({
      success: true,
      data: {
        batchId,
        batchCode: batch.batchCode,
        inventoryItemId: itemId,
        previousQuantity,
        newQuantity,
        quantityConsumed: quantity,
        totalCost,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to consume inventory to batch', { error });
    res.status(500).json({ success: false, error: 'Failed to consume inventory to batch', code: 'BATCH_CONSUMPTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/items/:id/consume-site', authenticate, requirePermission('inventory:update'), validate(consumeInventoryToSiteSchema), async (req: Request, res: Response) => {
  try {
    const itemId = Number(req.params.id as string);
    const { siteId, quantity, consumptionDate, notes } = req.body;
    await assertPeriodOpen(consumptionDate, 'inventory');

    const item = await getInventoryItemWithType(itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (item.isFeed) {
      res.status(400).json({ success: false, error: 'Feed items must be consumed through feed workflows', code: 'FEED_ITEM_NOT_ALLOWED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [site] = await db.select({ id: sites.id, siteName: sites.siteName }).from(sites).where(eq(sites.id, siteId)).limit(1);
    if (!site) {
      res.status(404).json({ success: false, error: 'Site not found', code: 'SITE_NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (Number(item.quantity) < quantity) {
      res.status(400).json({ success: false, error: 'Insufficient inventory quantity', code: 'INSUFFICIENT_INVENTORY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    let lotConsumptions: LotConsumption[] = [];
    let totalCost = 0;
    try {
      const store = await ensureFarmStore(siteId);
      const result = await consumeInventoryFIFO(itemId, quantity, store.id);
      lotConsumptions = result.lotConsumptions;
      totalCost = result.totalCost;
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (error instanceof StockError) { sendStockError(res, error); return; }
      logger.warn('Falling back to weighted cost for site consumption', { itemId, error: (error as Error).message });
      totalCost = Math.round(quantity * Number(item.costPerUnit) * 100) / 100;
    }

    const previousQuantity = Number(item.quantity);
    const newQuantity = Math.round((previousQuantity - quantity) * 100) / 100;

    for (const consumption of lotConsumptions) {
      await db.update(inventoryLots).set({
        remainingQuantity: String(consumption.newRemaining),
      }).where(eq(inventoryLots.id, consumption.lotId));

      await db.insert(siteInventoryConsumptions).values({
        siteId,
        inventoryItemId: itemId,
        inventoryLotId: consumption.lotId,
        purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
        quantity: String(consumption.quantityUsed),
        unit: item.unit,
        unitCost: String(consumption.costPerUnit),
        lineCost: String(consumption.lineCost),
        consumptionDate,
        referenceType: 'inventory_item',
        referenceId: itemId,
        notes: notes || null,
        createdBy: req.user!.id,
      });

      await db.insert(inventoryAuditTrail).values({
        inventoryItemId: itemId,
        changeType: 'site_consumption',
        previousQuantity: String(consumption.previousRemaining),
        changeQuantity: String(-consumption.quantityUsed),
        newQuantity: String(consumption.newRemaining),
        referenceId: siteId,
        referenceType: 'site',
        notes: `Site ${site.siteName}${notes ? ` - ${notes}` : ''}`,
        lotId: consumption.lotId,
        costAtTime: String(consumption.costPerUnit),
        performedBy: req.user!.id,
      });

      await postInventoryMovement({
        movementType: 'site_consume',
        movementDate: consumptionDate,
        sourceModule: 'inventory',
        sourceEntityType: 'site_inventory_consumption',
        sourceEntityId: siteId,
        sourceCodeSnapshot: site.siteName,
        inventoryItemId: itemId,
        inventoryLotId: consumption.lotId,
        purchaseOrderItemId: consumption.purchaseOrderItemId ?? null,
        quantity: -consumption.quantityUsed,
        unit: item.unit,
        unitCost: consumption.costPerUnit,
        lineCost: consumption.lineCost,
        balanceAfterQuantity: consumption.newRemaining,
        balanceScope: 'inventory_lot',
        notes: notes || null,
        createdBy: req.user!.id,
      });
    }

    if (lotConsumptions.length === 0) {
      const unitCost = Number(item.costPerUnit);
      await db.insert(siteInventoryConsumptions).values({
        siteId,
        inventoryItemId: itemId,
        quantity: String(quantity),
        unit: item.unit,
        unitCost: String(unitCost),
        lineCost: String(totalCost),
        consumptionDate,
        referenceType: 'inventory_item',
        referenceId: itemId,
        notes: notes || null,
        createdBy: req.user!.id,
      });

      await db.insert(inventoryAuditTrail).values({
        inventoryItemId: itemId,
        changeType: 'site_consumption',
        previousQuantity: String(previousQuantity),
        changeQuantity: String(-quantity),
        newQuantity: String(newQuantity),
        referenceId: siteId,
        referenceType: 'site',
        notes: `Site ${site.siteName}${notes ? ` - ${notes}` : ''}`,
        costAtTime: String(unitCost),
        performedBy: req.user!.id,
      });

      await postInventoryMovement({
        movementType: 'site_consume',
        movementDate: consumptionDate,
        sourceModule: 'inventory',
        sourceEntityType: 'site_inventory_consumption',
        sourceEntityId: siteId,
        sourceCodeSnapshot: site.siteName,
        inventoryItemId: itemId,
        quantity: -quantity,
        unit: item.unit,
        unitCost,
        lineCost: totalCost,
        balanceAfterQuantity: newQuantity,
        balanceScope: 'inventory_item',
        notes: notes || null,
        createdBy: req.user!.id,
      });
    }

    const weightedAvgCost = await recalculateWeightedAverageCost(itemId);
    await db.update(feedInventory).set({
      quantity: String(newQuantity),
      costPerUnit: String(weightedAvgCost || Number(item.costPerUnit)),
      updatedAt: new Date(),
    }).where(eq(feedInventory.id, itemId));

    createAuditLog({
      userId: req.user!.id,
      action: 'site_inventory_consumed',
      entityType: 'site_inventory_consumption',
      entityId: siteId,
      changes: { inventoryItemId: itemId, quantity, siteId, totalCost, notes },
    });

    res.json({
      success: true,
      data: {
        siteId,
        siteName: site.siteName,
        inventoryItemId: itemId,
        previousQuantity,
        newQuantity,
        quantityConsumed: quantity,
        totalCost,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to consume inventory to site', { error });
    res.status(500).json({ success: false, error: 'Failed to consume inventory to site', code: 'SITE_CONSUMPTION_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// =============================================================================
// PURCHASE ORDERS
// =============================================================================

router.get('/purchase-orders', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { status, supplierId, search, page = '1', limit = '20' } = req.query;
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    let query = db
      .select({
        id: purchaseOrders.id,
        orderCode: purchaseOrders.orderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        contractId: purchaseOrders.contractId,
        contractCode: supplierContracts.contractCode,
        contractTitle: supplierContracts.contractTitle,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(supplierContracts, eq(purchaseOrders.contractId, supplierContracts.id))
      .$dynamic();

    const conditions = [];
    if (status && status !== 'all') conditions.push(eq(purchaseOrders.status, status as string));
    if (supplierId) conditions.push(eq(purchaseOrders.supplierId, Number(supplierId)));
    if (search) conditions.push(ilike(purchaseOrders.orderCode, `%${search as string}%`));

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query.orderBy(desc(purchaseOrders.createdAt)).limit(limitNum).offset(offset);

    let countQuery = db.select({ total: sql<number>`count(*)::int` }).from(purchaseOrders).$dynamic();
    if (conditions.length > 0) {
      countQuery = countQuery.where(and(...conditions));
    }
    const [{ total }] = await countQuery;

    res.json({
      success: true,
      data: results,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory purchase orders', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch purchase orders', code: 'PO_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/purchase-orders/:id', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        orderCode: purchaseOrders.orderCode,
        supplierId: purchaseOrders.supplierId,
        supplierName: suppliers.supplierName,
        contractId: purchaseOrders.contractId,
        contractCode: supplierContracts.contractCode,
        contractTitle: supplierContracts.contractTitle,
        orderDate: purchaseOrders.orderDate,
        expectedDeliveryDate: purchaseOrders.expectedDeliveryDate,
        actualDeliveryDate: purchaseOrders.actualDeliveryDate,
        status: purchaseOrders.status,
        totalCost: purchaseOrders.totalCost,
        notes: purchaseOrders.notes,
        createdBy: purchaseOrders.createdBy,
        createdAt: purchaseOrders.createdAt,
        updatedAt: purchaseOrders.updatedAt,
      })
      .from(purchaseOrders)
      .leftJoin(suppliers, eq(purchaseOrders.supplierId, suppliers.id))
      .leftJoin(supplierContracts, eq(purchaseOrders.contractId, supplierContracts.id))
      .where(eq(purchaseOrders.id, poId))
      .limit(1);

    if (!po) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const items = await db
      .select({
        id: purchaseOrderItems.id,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        inventoryItemId: purchaseOrderItems.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        itemCode: feedInventory.itemCode,
        itemTypeId: feedInventory.itemTypeId,
        typeName: inventoryItemTypes.typeName,
        typeCode: inventoryItemTypes.typeCode,
        isFeed: inventoryItemTypes.isFeed,
        orderedQuantity: purchaseOrderItems.orderedQuantity,
        unitPrice: purchaseOrderItems.unitPrice,
        receivedQuantity: purchaseOrderItems.receivedQuantity,
        unit: purchaseOrderItems.unit,
        notes: purchaseOrderItems.notes,
      })
      .from(purchaseOrderItems)
      .innerJoin(feedInventory, eq(purchaseOrderItems.inventoryItemId, feedInventory.id))
      .innerJoin(inventoryItemTypes, eq(feedInventory.itemTypeId, inventoryItemTypes.id))
      .where(eq(purchaseOrderItems.purchaseOrderId, poId));

    const poPayments = await db
      .select({
        id: supplierPayments.id,
        paymentCode: supplierPayments.paymentCode,
        paymentDate: supplierPayments.paymentDate,
        financeAccountId: supplierPayments.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: supplierPayments.paymentMethod,
        amount: supplierPayments.amount,
        paymentStatus: supplierPayments.paymentStatus,
        chequeNumber: supplierPayments.chequeNumber,
        treasuryTransactionId: supplierPayments.treasuryTransactionId,
        notes: supplierPayments.notes,
      })
      .from(supplierPayments)
      .leftJoin(financeAccounts, eq(supplierPayments.financeAccountId, financeAccounts.id))
      .where(eq(supplierPayments.purchaseOrderId, poId))
      .orderBy(desc(supplierPayments.paymentDate), desc(supplierPayments.id));

    const poInvoices = await db
      .select({
        id: supplierInvoices.id,
        invoiceCode: supplierInvoices.invoiceCode,
        invoiceReference: supplierInvoices.invoiceReference,
        invoiceDate: supplierInvoices.invoiceDate,
        dueDate: supplierInvoices.dueDate,
        invoiceAmount: supplierInvoices.invoiceAmount,
        status: supplierInvoices.status,
        paidAmount: sql<number>`COALESCE((
          SELECT SUM(${qualified(supplierPaymentAllocations.allocatedAmount)}::numeric)
          FROM ${supplierPaymentAllocations}
          INNER JOIN ${supplierPayments} ON ${qualified(supplierPayments.id)} = ${qualified(supplierPaymentAllocations.supplierPaymentId)}
          WHERE ${qualified(supplierPaymentAllocations.supplierInvoiceId)} = ${qualified(supplierInvoices.id)}
            AND ${qualified(supplierPayments.paymentStatus)} IN ('pending', 'completed')
        ), 0)::float`,
      })
      .from(supplierInvoices)
      .where(eq(supplierInvoices.purchaseOrderId, poId))
      .orderBy(desc(supplierInvoices.invoiceDate), desc(supplierInvoices.id));

    const paymentSummary = poPayments.reduce((summary, payment) => {
      if (payment.paymentStatus === 'completed') {
        summary.totalPaid += Number(payment.amount);
      }
      if (payment.paymentStatus === 'pending') {
        summary.pendingAmount += Number(payment.amount);
      }
      return summary;
    }, { totalPaid: 0, pendingAmount: 0 });

    res.json({
      success: true,
      data: {
        purchaseOrder: po,
        items: items.map((item) => ({
          ...item,
          receivedPercentage: Number(item.orderedQuantity) > 0
            ? Math.round((Number(item.receivedQuantity) / Number(item.orderedQuantity)) * 10000) / 100
            : 0,
        })),
        payments: poPayments,
        invoices: poInvoices.map((invoice) => ({
          ...invoice,
          balanceDue: Math.round((Number(invoice.invoiceAmount) - Number(invoice.paidAmount ?? 0)) * 100) / 100,
        })),
        paymentSummary: {
          totalPaid: Number(paymentSummary.totalPaid.toFixed(2)),
          pendingAmount: Number(paymentSummary.pendingAmount.toFixed(2)),
          totalInvoiced: Number(poInvoices.reduce((sum, invoice) => sum + Number(invoice.invoiceAmount), 0).toFixed(2)),
          outstandingAmount: Number((Number(po.totalCost) - paymentSummary.totalPaid).toFixed(2)),
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory purchase order detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch purchase order detail', code: 'PO_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/purchase-orders', authenticate, requirePermission('inventory:create'), validate(createInventoryPurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const { supplierId, contractId, orderDate, expectedDeliveryDate, notes, items } = req.body;

    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId)).limit(1);
    if (!supplier || supplier.status !== 'active') {
      res.status(400).json({ success: false, error: 'Supplier must exist and be active', code: 'INVALID_SUPPLIER', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (contractId) {
      const [contract] = await db.select().from(supplierContracts).where(eq(supplierContracts.id, contractId)).limit(1);
      if (!contract || contract.supplierId !== supplierId) {
        res.status(400).json({ success: false, error: 'Contract does not belong to the selected supplier', code: 'INVALID_CONTRACT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    for (const item of items as Array<{ inventoryItemId: number }>) {
      const [inventoryItem] = await db.select({ id: feedInventory.id }).from(feedInventory).where(eq(feedInventory.id, item.inventoryItemId)).limit(1);
      if (!inventoryItem) {
        res.status(400).json({ success: false, error: `Inventory item ${item.inventoryItemId} not found`, code: 'INVALID_INVENTORY_ITEM', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }

    const orderCode = await generatePOCode(orderDate);
    const totalCost = (items as Array<{ orderedQuantity: number; unitPrice: number }>).reduce(
      (sum, item) => sum + item.orderedQuantity * item.unitPrice,
      0,
    );

    const [created] = await db.insert(purchaseOrders).values({
      orderCode,
      supplierId,
      contractId: contractId ?? null,
      costCentreId: req.body.costCentreId
        ?? await defaultPurchaseCostCentreId((items as Array<{ inventoryItemId: number }>).map((item) => item.inventoryItemId)),
      deliveryLocationId: req.body.deliveryLocationId ?? null,
      orderDate,
      expectedDeliveryDate: expectedDeliveryDate || null,
      status: 'draft',
      totalCost: String(Math.round(totalCost * 100) / 100),
      notes: notes || null,
      createdBy: req.user!.id,
    }).returning();

    await db.insert(purchaseOrderItems).values(
      (items as Array<{ inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }>).map((item) => ({
        purchaseOrderId: created.id,
        inventoryItemId: item.inventoryItemId,
        orderedQuantity: String(item.orderedQuantity),
        unitPrice: String(item.unitPrice),
        unit: item.unit,
        notes: item.notes || null,
      })),
    );

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_purchase_order_created',
      entityType: 'purchase_order',
      entityId: created.id,
      changes: { orderCode, supplierId, totalCost, itemCount: items.length },
    });

    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create inventory purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to create purchase order', code: 'CREATE_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/purchase-orders/:id', authenticate, requirePermission('inventory:update'), validate(updateInventoryPurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);
    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);

    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (existing.status !== 'draft') {
      res.status(400).json({ success: false, error: 'Can only update draft purchase orders', code: 'PO_NOT_DRAFT', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const { items, contractId, ...headerFields } = req.body;
    if (contractId) {
      const [contract] = await db.select().from(supplierContracts).where(eq(supplierContracts.id, contractId)).limit(1);
      if (!contract || contract.supplierId !== existing.supplierId) {
        res.status(400).json({ success: false, error: 'Contract does not belong to the purchase order supplier', code: 'INVALID_CONTRACT', statusCode: 400, timestamp: new Date().toISOString() });
        return;
      }
    }
    await db.update(purchaseOrders).set({ ...headerFields, contractId: contractId ?? null, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId));

    if (items) {
      await db.delete(purchaseOrderItems).where(eq(purchaseOrderItems.purchaseOrderId, poId));
      if (items.length > 0) {
        await db.insert(purchaseOrderItems).values(
          (items as Array<{ inventoryItemId: number; orderedQuantity: number; unitPrice: number; unit: string; notes?: string | null }>).map((item) => ({
            purchaseOrderId: poId,
            inventoryItemId: item.inventoryItemId,
            orderedQuantity: String(item.orderedQuantity),
            unitPrice: String(item.unitPrice),
            unit: item.unit,
            notes: item.notes || null,
          })),
        );

        const totalCost = (items as Array<{ orderedQuantity: number; unitPrice: number }>).reduce(
          (sum, item) => sum + item.orderedQuantity * item.unitPrice,
          0,
        );

        await db.update(purchaseOrders).set({ totalCost: String(Math.round(totalCost * 100) / 100), updatedAt: new Date() }).where(eq(purchaseOrders.id, poId));
      }
    }

    const [updated] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_purchase_order_updated',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { before: existing, after: req.body },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update inventory purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to update purchase order', code: 'UPDATE_PO_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/purchase-orders/:id/status', authenticate, requirePermission('inventory:update'), validate(updateInventoryPurchaseOrderStatusSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);
    const { status } = req.body;

    const [existing] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, poId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Purchase order not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    if (status === 'submitted' && existing.status !== 'draft') {
      res.status(400).json({ success: false, error: 'Can only submit draft purchase orders', code: 'INVALID_PO_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    if (status === 'cancelled' && !['draft', 'submitted'].includes(existing.status)) {
      res.status(400).json({ success: false, error: 'Can only cancel draft or submitted purchase orders', code: 'INVALID_PO_TRANSITION', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }

    const [updated] = await db.update(purchaseOrders).set({ status, updatedAt: new Date() }).where(eq(purchaseOrders.id, poId)).returning();

    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_purchase_order_status_updated',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { before: { status: existing.status }, after: { status } },
    });

    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to update inventory purchase order status', { error });
    res.status(500).json({ success: false, error: 'Failed to update purchase order status', code: 'UPDATE_PO_STATUS_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/purchase-orders/:id/receive', authenticate, requirePermission('inventory:update'), validate(receiveInventoryPurchaseOrderSchema), async (req: Request, res: Response) => {
  try {
    const poId = Number(req.params.id as string);
    const result = await receivePurchaseOrder({ purchaseOrderId: poId, lines: req.body.items, locationId: req.body.locationId ?? null, userId: req.user!.id });
    createAuditLog({
      userId: req.user!.id,
      action: 'inventory_purchase_order_received',
      entityType: 'purchase_order',
      entityId: poId,
      changes: { newStatus: result.status, lotsCreated: result.lotsCreated },
    });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    if (error instanceof Error && /closed period/i.test(error.message)) {
      res.status(400).json({ success: false, error: error.message, code: 'PERIOD_LOCKED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to receive inventory purchase order', { error });
    res.status(500).json({ success: false, error: 'Failed to receive purchase order items', code: 'PO_RECEIVE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/site-consumptions', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { siteId, itemId } = req.query;
    const conditions = [];
    if (siteId) conditions.push(eq(siteInventoryConsumptions.siteId, Number(siteId)));
    if (itemId) conditions.push(eq(siteInventoryConsumptions.inventoryItemId, Number(itemId)));

    const consumptions = await db
      .select({
        id: siteInventoryConsumptions.id,
        siteId: siteInventoryConsumptions.siteId,
        siteName: sites.siteName,
        inventoryItemId: siteInventoryConsumptions.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        inventoryLotId: siteInventoryConsumptions.inventoryLotId,
        lotCode: inventoryLots.lotCode,
        quantity: siteInventoryConsumptions.quantity,
        unit: siteInventoryConsumptions.unit,
        unitCost: siteInventoryConsumptions.unitCost,
        lineCost: siteInventoryConsumptions.lineCost,
        consumptionDate: siteInventoryConsumptions.consumptionDate,
        referenceType: siteInventoryConsumptions.referenceType,
        referenceId: siteInventoryConsumptions.referenceId,
        notes: siteInventoryConsumptions.notes,
      })
      .from(siteInventoryConsumptions)
      .leftJoin(sites, eq(siteInventoryConsumptions.siteId, sites.id))
      .leftJoin(feedInventory, eq(siteInventoryConsumptions.inventoryItemId, feedInventory.id))
      .leftJoin(inventoryLots, eq(siteInventoryConsumptions.inventoryLotId, inventoryLots.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(siteInventoryConsumptions.consumptionDate), desc(siteInventoryConsumptions.id));

    res.json({ success: true, data: consumptions, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch site inventory consumptions', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch site inventory consumptions', code: 'SITE_CONSUMPTIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/movements', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { itemId, batchId, lotId, productionBatchId, movementType } = req.query;
    const conditions = [];

    if (itemId) conditions.push(eq(inventoryMovements.inventoryItemId, Number(itemId)));
    if (batchId) conditions.push(eq(inventoryMovements.batchId, Number(batchId)));
    if (lotId) conditions.push(eq(inventoryMovements.inventoryLotId, Number(lotId)));
    if (productionBatchId) conditions.push(eq(inventoryMovements.productionBatchId, Number(productionBatchId)));
    if (movementType && movementType !== 'all') conditions.push(eq(inventoryMovements.movementType, String(movementType)));

    const movements = await db
      .select({
        id: inventoryMovements.id,
        movementType: inventoryMovements.movementType,
        movementDate: inventoryMovements.movementDate,
        sourceModule: inventoryMovements.sourceModule,
        sourceEntityType: inventoryMovements.sourceEntityType,
        sourceEntityId: inventoryMovements.sourceEntityId,
        sourceCodeSnapshot: inventoryMovements.sourceCodeSnapshot,
        inventoryItemId: inventoryMovements.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        inventoryLotId: inventoryMovements.inventoryLotId,
        lotCode: inventoryLots.lotCode,
        purchaseOrderId: inventoryMovements.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
        productionBatchId: inventoryMovements.productionBatchId,
        batchId: inventoryMovements.batchId,
        batchCode: batches.batchCode,
        quantity: inventoryMovements.quantity,
        unit: inventoryMovements.unit,
        unitCost: inventoryMovements.unitCost,
        lineCost: inventoryMovements.lineCost,
        balanceAfterQuantity: inventoryMovements.balanceAfterQuantity,
        balanceScope: inventoryMovements.balanceScope,
        notes: inventoryMovements.notes,
        createdBy: inventoryMovements.createdBy,
        createdAt: inventoryMovements.createdAt,
      })
      .from(inventoryMovements)
      .leftJoin(feedInventory, eq(inventoryMovements.inventoryItemId, feedInventory.id))
      .leftJoin(inventoryLots, eq(inventoryMovements.inventoryLotId, inventoryLots.id))
      .leftJoin(purchaseOrders, eq(inventoryMovements.purchaseOrderId, purchaseOrders.id))
      .leftJoin(batches, eq(inventoryMovements.batchId, batches.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(inventoryMovements.movementDate), desc(inventoryMovements.id));

    res.json({ success: true, data: movements, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch inventory movements', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch inventory movements', code: 'INVENTORY_MOVEMENTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/lots/:id/trace', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const lotId = Number(req.params.id as string);
    const [lot] = await db
      .select({
        id: inventoryLots.id,
        inventoryItemId: inventoryLots.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        lotCode: inventoryLots.lotCode,
        receivedQuantity: inventoryLots.receivedQuantity,
        remainingQuantity: inventoryLots.remainingQuantity,
        costPerUnit: inventoryLots.costPerUnit,
        receivedDate: inventoryLots.receivedDate,
        purchaseOrderItemId: inventoryLots.purchaseOrderItemId,
        purchaseOrderId: purchaseOrderItems.purchaseOrderId,
        purchaseOrderCode: purchaseOrders.orderCode,
      })
      .from(inventoryLots)
      .leftJoin(feedInventory, eq(inventoryLots.inventoryItemId, feedInventory.id))
      .leftJoin(purchaseOrderItems, eq(inventoryLots.purchaseOrderItemId, purchaseOrderItems.id))
      .leftJoin(purchaseOrders, eq(purchaseOrderItems.purchaseOrderId, purchaseOrders.id))
      .where(eq(inventoryLots.id, lotId))
      .limit(1);

    if (!lot) {
      res.status(404).json({ success: false, error: 'Inventory lot not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [movements, productionUsage, batchUsage] = await Promise.all([
      db.select().from(inventoryMovements).where(eq(inventoryMovements.inventoryLotId, lotId)).orderBy(asc(inventoryMovements.movementDate), asc(inventoryMovements.id)),
      db
        .select({
          id: inventoryMovements.id,
          productionBatchId: inventoryMovements.productionBatchId,
          quantity: inventoryMovements.quantity,
          unit: inventoryMovements.unit,
          lineCost: inventoryMovements.lineCost,
          movementDate: inventoryMovements.movementDate,
        })
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.inventoryLotId, lotId), eq(inventoryMovements.movementType, 'production_consume')))
        .orderBy(asc(inventoryMovements.movementDate), asc(inventoryMovements.id)),
      db
        .select({
          id: inventoryMovements.id,
          batchId: inventoryMovements.batchId,
          batchCode: batches.batchCode,
          quantity: inventoryMovements.quantity,
          unit: inventoryMovements.unit,
          lineCost: inventoryMovements.lineCost,
          movementDate: inventoryMovements.movementDate,
        })
        .from(inventoryMovements)
        .leftJoin(batches, eq(inventoryMovements.batchId, batches.id))
        .where(and(eq(inventoryMovements.inventoryLotId, lotId), eq(inventoryMovements.movementType, 'batch_consume')))
        .orderBy(asc(inventoryMovements.movementDate), asc(inventoryMovements.id)),
    ]);

    res.json({
      success: true,
      data: {
        lot,
        movements,
        productionUsage,
        batchUsage,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch lot trace', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch lot trace', code: 'LOT_TRACE_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/batch-allocations', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const { batchId } = req.query;
    const conditions = [eq(inventoryMovements.movementType, 'batch_consume')];
    if (batchId) {
      conditions.push(eq(inventoryMovements.batchId, Number(batchId)));
    }

    const allocations = await db
      .select({
        id: inventoryMovements.id,
        movementDate: inventoryMovements.movementDate,
        batchId: inventoryMovements.batchId,
        batchCode: batches.batchCode,
        inventoryItemId: inventoryMovements.inventoryItemId,
        ingredientName: feedInventory.ingredientName,
        inventoryLotId: inventoryMovements.inventoryLotId,
        lotCode: inventoryLots.lotCode,
        sourceEntityType: inventoryMovements.sourceEntityType,
        sourceCodeSnapshot: inventoryMovements.sourceCodeSnapshot,
        quantity: inventoryMovements.quantity,
        unit: inventoryMovements.unit,
        unitCost: inventoryMovements.unitCost,
        lineCost: inventoryMovements.lineCost,
        notes: inventoryMovements.notes,
      })
      .from(inventoryMovements)
      .leftJoin(batches, eq(inventoryMovements.batchId, batches.id))
      .leftJoin(feedInventory, eq(inventoryMovements.inventoryItemId, feedInventory.id))
      .leftJoin(inventoryLots, eq(inventoryMovements.inventoryLotId, inventoryLots.id))
      .where(and(...conditions))
      .orderBy(desc(inventoryMovements.movementDate), desc(inventoryMovements.id));

    res.json({ success: true, data: allocations, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch batch allocations', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch batch allocations', code: 'BATCH_ALLOCATIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ─── Stores, balances, transfers, expiry ─────────────────────────────────────

router.get('/locations', authenticate, requirePermission('inventory:read'), async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(stockLocations).orderBy(asc(stockLocations.name));
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch stores', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch stores', code: 'LOCATIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/locations', authenticate, requirePermission('inventory:create'), validate(stockLocationSchema), async (req: Request, res: Response) => {
  try {
    const [created] = await db.insert(stockLocations).values({ ...req.body, siteId: req.body.siteId ?? null }).returning();
    createAuditLog({ userId: req.user!.id, action: 'stock_location_created', entityType: 'stock_location', entityId: created.id, changes: req.body });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({ success: false, error: 'A store with this code already exists', code: 'DUPLICATE', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to create store', { error });
    res.status(500).json({ success: false, error: 'Failed to create store', code: 'LOCATION_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/locations/:id', authenticate, requirePermission('inventory:update'), validate(updateStockLocationSchema), async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id as string);
    const [location] = await db.select().from(stockLocations).where(eq(stockLocations.id, id)).limit(1);
    if (!location) {
      res.status(404).json({ success: false, error: 'Store not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (location.code === 'MAIN' && req.body.status === 'inactive') {
      res.status(400).json({ success: false, error: 'The Main store cannot be deactivated', code: 'SYSTEM_LOCATION', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    const [updated] = await db.update(stockLocations).set({ ...req.body, updatedAt: new Date() }).where(eq(stockLocations.id, id)).returning();
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update store', { error });
    res.status(500).json({ success: false, error: 'Failed to update store', code: 'LOCATION_UPDATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/stock-balances', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const data = await stockBalances({
      locationId: req.query.locationId ? Number(req.query.locationId) : null,
      inventoryItemId: req.query.itemId ? Number(req.query.itemId) : null,
    });
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch stock balances', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch stock balances', code: 'STOCK_BALANCES_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/transfers', authenticate, requirePermission('inventory:read'), async (_req: Request, res: Response) => {
  try {
    const fromLocation = alias(stockLocations, 'from_location');
    const toLocation = alias(stockLocations, 'to_location');
    const rows = await db
      .select({
        id: stockTransfers.id,
        transferCode: stockTransfers.transferCode,
        transferDate: stockTransfers.transferDate,
        fromName: fromLocation.name,
        toName: toLocation.name,
        notes: stockTransfers.notes,
        lineCount: sql<number>`(SELECT count(*)::int FROM stock_transfer_lines l WHERE l.transfer_id = ${qualified(stockTransfers.id)})`,
        value: sql<number>`(SELECT COALESCE(SUM(l.quantity::numeric * lot.cost_per_unit::numeric), 0)::float FROM stock_transfer_lines l JOIN inventory_lots lot ON lot.id = l.source_lot_id WHERE l.transfer_id = ${qualified(stockTransfers.id)})`,
        items: sql<string>`(SELECT string_agg(DISTINCT fi.ingredient_name, ', ') FROM stock_transfer_lines l JOIN feed_inventory fi ON fi.id = l.inventory_item_id WHERE l.transfer_id = ${qualified(stockTransfers.id)})`,
      })
      .from(stockTransfers)
      .innerJoin(fromLocation, eq(stockTransfers.fromLocationId, fromLocation.id))
      .innerJoin(toLocation, eq(stockTransfers.toLocationId, toLocation.id))
      .orderBy(desc(stockTransfers.transferDate), desc(stockTransfers.id))
      .limit(100);
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch transfers', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch transfers', code: 'TRANSFERS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/transfers', authenticate, requirePermission('inventory:update'), validate(stockTransferSchema), async (req: Request, res: Response) => {
  try {
    const transfer = await transferStock({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'stock_transferred', entityType: 'stock_transfer', entityId: transfer.id, changes: req.body });
    res.status(201).json({ success: true, data: transfer, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    if (error instanceof Error && /closed period/i.test(error.message)) {
      res.status(400).json({ success: false, error: error.message, code: 'PERIOD_LOCKED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to transfer stock', { error });
    res.status(500).json({ success: false, error: 'Failed to transfer stock', code: 'TRANSFER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/expiring', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const withinDays = Math.min(Math.max(Number(req.query.days) || 30, 0), 365);
    res.json({ success: true, data: await expiringLots({ withinDays }), timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch expiring stock', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch expiring stock', code: 'EXPIRING_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/lots/:id/write-off', authenticate, requirePermission('inventory:update'), validate(writeOffLotSchema), async (req: Request, res: Response) => {
  try {
    const result = await writeOffLot({ lotId: Number(req.params.id as string), quantity: req.body.quantity ?? null, reason: req.body.reason, date: req.body.date, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'stock_written_off', entityType: 'inventory_lot', entityId: result.lotId, changes: { ...result, reason: req.body.reason } });
    res.json({ success: true, data: result, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    logger.error('Failed to write off stock', { error });
    res.status(500).json({ success: false, error: 'Failed to write off stock', code: 'WRITE_OFF_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ─── Requisitions ────────────────────────────────────────────────────────────

router.get('/requisitions', authenticate, requirePermission('inventory:read'), async (req: Request, res: Response) => {
  try {
    const data = await listRequisitions({
      status: typeof req.query.status === 'string' ? req.query.status : null,
      costCentreId: req.query.costCentreId ? Number(req.query.costCentreId) : null,
    });
    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch requisitions', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch requisitions', code: 'REQUISITIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/requisitions', authenticate, requirePermission('inventory:read'), validate(createRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await createRequisition({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'requisition_created', entityType: 'purchase_requisition', entityId: requisition.id, changes: req.body });
    res.status(201).json({ success: true, data: requisition, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    logger.error('Failed to create requisition', { error });
    res.status(500).json({ success: false, error: 'Failed to create requisition', code: 'REQUISITION_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/requisitions/:id/review', authenticate, requirePermission('inventory:update'), validate(reviewRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const requisition = await reviewRequisition({ requisitionId: Number(req.params.id as string), ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'requisition_reviewed', entityType: 'purchase_requisition', entityId: requisition.id, changes: req.body });
    res.json({ success: true, data: requisition, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    logger.error('Failed to review requisition', { error });
    res.status(500).json({ success: false, error: 'Failed to review requisition', code: 'REQUISITION_REVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/requisitions/:id/order', authenticate, requirePermission('inventory:create'), validate(convertRequisitionSchema), async (req: Request, res: Response) => {
  try {
    const order = await convertRequisitionToOrder({ requisitionId: Number(req.params.id as string), ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'requisition_ordered', entityType: 'purchase_order', entityId: order.id, changes: { requisitionId: Number(req.params.id as string) } });
    res.status(201).json({ success: true, data: order, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof StockError) { sendStockError(res, error); return; }
    logger.error('Failed to create order from requisition', { error });
    res.status(500).json({ success: false, error: 'Failed to create the purchase order', code: 'REQUISITION_ORDER_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

export default router;
