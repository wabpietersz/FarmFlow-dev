import { needsApproval } from '../lib/approvals';
import { qualified } from '../lib/sql-utils';
import { Router, type Request, type Response } from 'express';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { UserRole } from '@farmflow/shared';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import {
  createFinanceReconciliationSchema,
  createChequeBookSchema,
  createFinanceAccountSchema,
  createManualTreasuryTransactionSchema,
  createOperationalExpenseSchema,
  createPeriodLockSchema,
  createPettyCashAllocationSchema,
  createPettyCashExpenseSchema,
  releasePeriodLockSchema,
  reviewOperationalExpenseSchema,
  reviewPettyCashExpenseSchema,
  settleOperationalExpenseSchema,
  updateChequeLeafStatusSchema,
  createFinanceCategorySchema,
  updateFinanceCategorySchema,
  createCostCentreSchema,
  updateCostCentreSchema,
  retagLedgerEntrySchema,
} from '../validators/treasury';
import { db } from '../db';
import {
  chequeBooks,
  chequeLeaves,
  financeAccounts,
  pettyCashAllocations,
  pettyCashExpenses,
  operationalExpenses,
  periodLocks,
  financeReconciliations,
  treasuryTransactionEntries,
  treasuryTransactionLinks,
  treasuryTransactions,
  users,
  sites,
  batches,
  costCentres,
  financeCategories,
} from '../db/schema';
import { createAuditLog } from '../lib/audit';
import { assertPeriodOpen } from '../lib/period-locks';
import { resolveEntryTags } from '../lib/finance-tags';
import logger from '../lib/logger';
import { hasPermission } from '../lib/permissions';
import { getNextPeriodLockCode } from '../lib/period-locks';
import {
  listBouncedBuyerChequeReceipts,
  createChequeBook,
  createFinanceReconciliation,
  createManualTreasuryTransaction,
  createOperationalExpense,
  createPettyCashAllocation,
  getFinanceAccountBalance,
  listPendingBuyerChequeReceipts,
  listFinanceAccountsWithBalances,
  reviewOperationalExpense,
  reviewPettyCashExpense,
  settleOperationalExpense,
  submitPettyCashExpense,
  updateChequeLeafStatus,
} from '../lib/treasury';
import { isMissingTreasuryColumn, isMissingTreasuryTable, sendTreasurySchemaNotReady } from '../lib/treasury-errors';

/** Fully qualified: Drizzle drops the table name in single-table queries, which breaks correlated sub-queries. */
const TX_ID = sql.raw('"treasury_transactions"."id"');

const router = Router();

router.get('/accounts', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const accounts = await listFinanceAccountsWithBalances();
    res.json({ success: true, data: accounts, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch treasury accounts', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch treasury accounts', code: 'TREASURY_ACCOUNTS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/accounts', authenticate, requirePermission('treasury:accounts:manage'), validate(createFinanceAccountSchema), async (req: Request, res: Response) => {
  try {
    const [existing] = await db
      .select({ id: financeAccounts.id })
      .from(financeAccounts)
      .where(eq(financeAccounts.accountCode, req.body.accountCode))
      .limit(1);

    if (existing) {
      res.status(409).json({ success: false, error: 'Account code already exists', code: 'TREASURY_ACCOUNT_CODE_EXISTS', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }

    const [account] = await db
      .insert(financeAccounts)
      .values({
        accountCode: req.body.accountCode,
        accountName: req.body.accountName,
        accountType: req.body.accountType,
        bankName: req.body.bankName || null,
        branchName: req.body.branchName || null,
        accountNumberMasked: req.body.accountNumberMasked || null,
        currencyCode: req.body.currencyCode || 'LKR',
        allowsCheque: req.body.allowsCheque ?? false,
        openingBalance: Number(req.body.openingBalance ?? 0).toFixed(2),
        openingBalanceDate: req.body.openingBalanceDate || null,
        status: req.body.status || 'active',
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json({
      success: true,
      data: {
        ...account,
        currentBalance: await getFinanceAccountBalance(account.id),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create treasury account', { error });
    res.status(500).json({ success: false, error: 'Failed to create treasury account', code: 'TREASURY_ACCOUNT_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/cheque-books', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const books = await db
      .select({
        id: chequeBooks.id,
        financeAccountId: chequeBooks.financeAccountId,
        accountName: financeAccounts.accountName,
        bookCode: chequeBooks.bookCode,
        startNumber: chequeBooks.startNumber,
        endNumber: chequeBooks.endNumber,
        issuedDate: chequeBooks.issuedDate,
        status: chequeBooks.status,
        createdAt: chequeBooks.createdAt,
        updatedAt: chequeBooks.updatedAt,
        availableLeaves: sql<number>`
          COALESCE((
            SELECT COUNT(*)::int
            FROM ${chequeLeaves}
            WHERE ${qualified(chequeLeaves.chequeBookId)} = ${qualified(chequeBooks.id)}
              AND ${qualified(chequeLeaves.status)} = 'available'
          ), 0)
        `,
        issuedLeaves: sql<number>`
          COALESCE((
            SELECT COUNT(*)::int
            FROM ${chequeLeaves}
            WHERE ${qualified(chequeLeaves.chequeBookId)} = ${qualified(chequeBooks.id)}
              AND ${qualified(chequeLeaves.status)} = 'issued'
          ), 0)
        `,
      })
      .from(chequeBooks)
      .leftJoin(financeAccounts, eq(chequeBooks.financeAccountId, financeAccounts.id))
      .orderBy(desc(chequeBooks.issuedDate), desc(chequeBooks.id));

    res.json({ success: true, data: books, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch cheque books', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch cheque books', code: 'CHEQUE_BOOKS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/cheque-books', authenticate, requirePermission('treasury:accounts:manage'), validate(createChequeBookSchema), async (req: Request, res: Response) => {
  try {
    const book = await createChequeBook({
      financeAccountId: req.body.financeAccountId,
      bookCode: req.body.bookCode || null,
      startNumber: req.body.startNumber,
      endNumber: req.body.endNumber,
      issuedDate: req.body.issuedDate,
      createdBy: req.user!.id,
    });

    res.status(201).json({ success: true, data: book, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create cheque book', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create cheque book',
      code: 'CHEQUE_BOOK_CREATE_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/cheque-leaves', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const { accountId, status } = req.query;

    let query = db
      .select({
        id: chequeLeaves.id,
        chequeBookId: chequeLeaves.chequeBookId,
        financeAccountId: chequeLeaves.financeAccountId,
        accountName: financeAccounts.accountName,
        bookCode: chequeBooks.bookCode,
        chequeNumber: chequeLeaves.chequeNumber,
        status: chequeLeaves.status,
        issueDate: chequeLeaves.issueDate,
        clearDate: chequeLeaves.clearDate,
        amount: chequeLeaves.amount,
        payeeName: chequeLeaves.payeeName,
        treasuryTransactionId: chequeLeaves.treasuryTransactionId,
        sourceModule: chequeLeaves.sourceModule,
        sourceEntityType: chequeLeaves.sourceEntityType,
        sourceEntityId: chequeLeaves.sourceEntityId,
        notes: chequeLeaves.notes,
        createdAt: chequeLeaves.createdAt,
        updatedAt: chequeLeaves.updatedAt,
      })
      .from(chequeLeaves)
      .leftJoin(chequeBooks, eq(chequeLeaves.chequeBookId, chequeBooks.id))
      .leftJoin(financeAccounts, eq(chequeLeaves.financeAccountId, financeAccounts.id))
      .$dynamic();

    const conditions = [];
    if (accountId) {
      conditions.push(eq(chequeLeaves.financeAccountId, Number(accountId)));
    }
    if (status && status !== 'all') {
      conditions.push(eq(chequeLeaves.status, String(status)));
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const leaves = await query.orderBy(desc(chequeLeaves.updatedAt), desc(chequeLeaves.id));
    res.json({ success: true, data: leaves, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch cheque leaves', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch cheque leaves', code: 'CHEQUE_LEAVES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/cheque-leaves/:id/status', authenticate, requirePermission('treasury:transactions:manage'), validate(updateChequeLeafStatusSchema), async (req: Request, res: Response) => {
  try {
    const chequeLeafId = Number(req.params.id as string);
    const leaf = await updateChequeLeafStatus({
      chequeLeafId,
      status: req.body.status,
      effectiveDate: req.body.effectiveDate,
      notes: req.body.notes || null,
    });

    res.json({ success: true, data: leaf, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to update cheque leaf status', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update cheque status',
      code: 'CHEQUE_LEAF_STATUS_UPDATE_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/cheques/overview', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const [outgoingCheques, pendingIncomingReceipts, bouncedIncomingReceipts] = await Promise.all([
      db
        .select({
          id: chequeLeaves.id,
          chequeNumber: chequeLeaves.chequeNumber,
          financeAccountId: chequeLeaves.financeAccountId,
          accountName: financeAccounts.accountName,
          status: chequeLeaves.status,
          issueDate: chequeLeaves.issueDate,
          clearDate: chequeLeaves.clearDate,
          amount: chequeLeaves.amount,
          payeeName: chequeLeaves.payeeName,
          sourceModule: chequeLeaves.sourceModule,
          sourceEntityType: chequeLeaves.sourceEntityType,
          sourceEntityId: chequeLeaves.sourceEntityId,
          treasuryTransactionId: chequeLeaves.treasuryTransactionId,
        })
        .from(chequeLeaves)
        .leftJoin(financeAccounts, eq(chequeLeaves.financeAccountId, financeAccounts.id))
        .where(sql`${chequeLeaves.status} IN ('issued', 'cleared', 'bounced', 'voided')`)
        .orderBy(desc(chequeLeaves.updatedAt), desc(chequeLeaves.id)),
      listPendingBuyerChequeReceipts(),
      listBouncedBuyerChequeReceipts(),
    ]);

    res.json({
      success: true,
      data: {
        outgoingCheques,
        pendingIncomingReceipts,
        bouncedIncomingReceipts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch cheque overview', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch cheque overview', code: 'CHEQUE_OVERVIEW_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ─── Finance master data: categories & cost centres ─────────────────────────

router.get('/categories', authenticate, async (req: Request, res: Response) => {
  try {
    const conditions = [];
    if (req.query.status) conditions.push(eq(financeCategories.status, String(req.query.status)));
    if (req.query.categoryType) conditions.push(eq(financeCategories.categoryType, String(req.query.categoryType)));
    const rows = await db
      .select()
      .from(financeCategories)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(financeCategories.sortOrder), asc(financeCategories.name));
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch finance categories', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch finance categories', code: 'FINANCE_CATEGORIES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/categories', authenticate, requirePermission('treasury:accounts:manage'), validate(createFinanceCategorySchema), async (req: Request, res: Response) => {
  try {
    const [created] = await db
      .insert(financeCategories)
      .values({
        code: req.body.code,
        name: req.body.name,
        categoryType: req.body.categoryType,
        reportGroup: req.body.reportGroup,
        description: req.body.description || null,
        sortOrder: req.body.sortOrder ?? 800,
        isSystem: false,
      })
      .returning();
    createAuditLog({ userId: req.user!.id, action: 'finance_category_created', entityType: 'finance_category', entityId: created.id, changes: req.body });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({ success: false, error: 'A category with this code or name already exists', code: 'DUPLICATE', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to create finance category', { error });
    res.status(500).json({ success: false, error: 'Failed to create finance category', code: 'FINANCE_CATEGORY_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/categories/:id', authenticate, requirePermission('treasury:accounts:manage'), validate(updateFinanceCategorySchema), async (req: Request, res: Response) => {
  try {
    const categoryId = Number(req.params.id as string);
    const [existing] = await db.select().from(financeCategories).where(eq(financeCategories.id, categoryId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Finance category not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (existing.isSystem && req.body.status === 'inactive') {
      res.status(400).json({ success: false, error: 'System categories cannot be deactivated', code: 'SYSTEM_CATEGORY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    const [updated] = await db
      .update(financeCategories)
      .set({
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.reportGroup !== undefined ? { reportGroup: req.body.reportGroup } : {}),
        ...(req.body.description !== undefined ? { description: req.body.description || null } : {}),
        ...(req.body.sortOrder !== undefined ? { sortOrder: req.body.sortOrder } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(financeCategories.id, categoryId))
      .returning();
    createAuditLog({ userId: req.user!.id, action: 'finance_category_updated', entityType: 'finance_category', entityId: categoryId, changes: { before: existing, after: updated } });
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({ success: false, error: 'A category with this name already exists', code: 'DUPLICATE', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to update finance category', { error });
    res.status(500).json({ success: false, error: 'Failed to update finance category', code: 'FINANCE_CATEGORY_UPDATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/cost-centres', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select()
      .from(costCentres)
      .where(req.query.status ? eq(costCentres.status, String(req.query.status)) : undefined)
      .orderBy(asc(costCentres.centreType), asc(costCentres.name));
    res.json({ success: true, data: rows, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to fetch cost centres', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch cost centres', code: 'COST_CENTRES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/cost-centres', authenticate, requirePermission('treasury:accounts:manage'), validate(createCostCentreSchema), async (req: Request, res: Response) => {
  try {
    const [created] = await db
      .insert(costCentres)
      .values({ code: req.body.code, name: req.body.name, centreType: req.body.centreType })
      .returning();
    createAuditLog({ userId: req.user!.id, action: 'cost_centre_created', entityType: 'cost_centre', entityId: created.id, changes: req.body });
    res.status(201).json({ success: true, data: created, timestamp: new Date().toISOString() });
  } catch (error) {
    if ((error as { code?: string })?.code === '23505') {
      res.status(409).json({ success: false, error: 'A cost centre with this code already exists', code: 'DUPLICATE', statusCode: 409, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to create cost centre', { error });
    res.status(500).json({ success: false, error: 'Failed to create cost centre', code: 'COST_CENTRE_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/cost-centres/:id', authenticate, requirePermission('treasury:accounts:manage'), validate(updateCostCentreSchema), async (req: Request, res: Response) => {
  try {
    const centreId = Number(req.params.id as string);
    const [existing] = await db.select().from(costCentres).where(eq(costCentres.id, centreId)).limit(1);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Cost centre not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (existing.siteId && req.body.name !== undefined) {
      res.status(400).json({ success: false, error: 'Site cost centres take their name from the site — rename the site instead', code: 'SITE_COST_CENTRE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    if (existing.code === 'ADMIN' && req.body.status === 'inactive') {
      res.status(400).json({ success: false, error: 'The Admin cost centre cannot be deactivated', code: 'SYSTEM_COST_CENTRE', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    const [updated] = await db
      .update(costCentres)
      .set({
        ...(req.body.name !== undefined ? { name: req.body.name } : {}),
        ...(req.body.status !== undefined ? { status: req.body.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(costCentres.id, centreId))
      .returning();
    createAuditLog({ userId: req.user!.id, action: 'cost_centre_updated', entityType: 'cost_centre', entityId: centreId, changes: { before: existing, after: updated } });
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Failed to update cost centre', { error });
    res.status(500).json({ success: false, error: 'Failed to update cost centre', code: 'COST_CENTRE_UPDATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

// ─── Money ledger (line level) ─────────────────────────────────────────────

router.get('/ledger', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const { accountId, categoryId, costCentreId, batchId, categoryType, from, to } = req.query;
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

    const conditions = [sql`${treasuryTransactions.status} NOT IN ('voided', 'bounced')`];
    if (accountId) conditions.push(eq(treasuryTransactionEntries.financeAccountId, Number(accountId)));
    if (categoryId) conditions.push(eq(treasuryTransactionEntries.categoryId, Number(categoryId)));
    if (costCentreId) conditions.push(eq(treasuryTransactionEntries.costCentreId, Number(costCentreId)));
    if (batchId) conditions.push(eq(treasuryTransactionEntries.batchId, Number(batchId)));
    if (categoryType) conditions.push(eq(financeCategories.categoryType, String(categoryType)));
    if (from) conditions.push(sql`${treasuryTransactionEntries.valueDate} >= ${String(from)}`);
    if (to) conditions.push(sql`${treasuryTransactionEntries.valueDate} <= ${String(to)}`);
    const where = and(...conditions);

    const baseQuery = () => db
      .select({
        id: treasuryTransactionEntries.id,
        valueDate: treasuryTransactionEntries.valueDate,
        entryDirection: treasuryTransactionEntries.entryDirection,
        amount: treasuryTransactionEntries.amount,
        notes: treasuryTransactionEntries.notes,
        financeAccountId: treasuryTransactionEntries.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        categoryId: treasuryTransactionEntries.categoryId,
        categoryCode: financeCategories.code,
        categoryName: financeCategories.name,
        categoryType: financeCategories.categoryType,
        reportGroup: financeCategories.reportGroup,
        costCentreId: treasuryTransactionEntries.costCentreId,
        costCentreName: costCentres.name,
        batchId: treasuryTransactionEntries.batchId,
        batchCode: batches.batchCode,
        treasuryTransactionId: treasuryTransactions.id,
        transactionCode: treasuryTransactions.transactionCode,
        transactionType: treasuryTransactions.transactionType,
        transactionStatus: treasuryTransactions.status,
        counterpartyNameSnapshot: treasuryTransactions.counterpartyNameSnapshot,
        referenceNumber: treasuryTransactions.referenceNumber,
        narrative: treasuryTransactions.narrative,
      })
      .from(treasuryTransactionEntries)
      .innerJoin(treasuryTransactions, eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id))
      .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
      .innerJoin(financeAccounts, eq(treasuryTransactionEntries.financeAccountId, financeAccounts.id))
      .leftJoin(costCentres, eq(treasuryTransactionEntries.costCentreId, costCentres.id))
      .leftJoin(batches, eq(treasuryTransactionEntries.batchId, batches.id));

    const [rows, [totals]] = await Promise.all([
      baseQuery()
        .where(where)
        .orderBy(desc(treasuryTransactionEntries.valueDate), desc(treasuryTransactionEntries.id))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({
          count: sql<number>`count(*)::int`,
          totalInflow: sql<number>`COALESCE(SUM(CASE WHEN ${treasuryTransactionEntries.entryDirection} = 'inflow' THEN ${treasuryTransactionEntries.amount}::numeric ELSE 0 END), 0)::float`,
          totalOutflow: sql<number>`COALESCE(SUM(CASE WHEN ${treasuryTransactionEntries.entryDirection} = 'outflow' THEN ${treasuryTransactionEntries.amount}::numeric ELSE 0 END), 0)::float`,
        })
        .from(treasuryTransactionEntries)
        .innerJoin(treasuryTransactions, eq(treasuryTransactionEntries.treasuryTransactionId, treasuryTransactions.id))
        .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
        .where(where),
    ]);

    res.json({
      success: true,
      data: {
        entries: rows,
        totals: {
          inflow: totals?.totalInflow ?? 0,
          outflow: totals?.totalOutflow ?? 0,
          net: Math.round(((totals?.totalInflow ?? 0) - (totals?.totalOutflow ?? 0)) * 100) / 100,
        },
        pagination: { page, limit, total: totals?.count ?? 0 },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch money ledger', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch money ledger', code: 'MONEY_LEDGER_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

/** Re-tag a ledger line (e.g. to clear "uncategorized" items). Amount, account and date never change. */
router.put('/ledger/:entryId/tags', authenticate, requirePermission('treasury:transactions:manage'), validate(retagLedgerEntrySchema), async (req: Request, res: Response) => {
  try {
    const entryId = Number(req.params.entryId as string);
    const [entry] = await db
      .select({
        id: treasuryTransactionEntries.id,
        valueDate: treasuryTransactionEntries.valueDate,
        entryDirection: treasuryTransactionEntries.entryDirection,
        categoryId: treasuryTransactionEntries.categoryId,
        costCentreId: treasuryTransactionEntries.costCentreId,
        batchId: treasuryTransactionEntries.batchId,
        currentCategoryType: financeCategories.categoryType,
      })
      .from(treasuryTransactionEntries)
      .innerJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
      .where(eq(treasuryTransactionEntries.id, entryId))
      .limit(1);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Ledger entry not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }
    if (entry.currentCategoryType === 'transfer') {
      res.status(400).json({ success: false, error: 'Transfer lines cannot be re-tagged', code: 'TRANSFER_ENTRY', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    await assertPeriodOpen(String(entry.valueDate), 'financial');
    const tags = await resolveEntryTags({
      categoryId: req.body.categoryId,
      costCentreId: req.body.costCentreId ?? null,
      batchId: req.body.batchId ?? null,
    });
    const [category] = await db.select().from(financeCategories).where(eq(financeCategories.id, tags.categoryId)).limit(1);
    if (category.categoryType === 'transfer'
      || (category.categoryType === 'income' && entry.entryDirection === 'outflow')
      || (category.categoryType === 'expense' && entry.entryDirection === 'inflow')) {
      res.status(400).json({ success: false, error: `"${category.name}" cannot be used for money ${entry.entryDirection === 'inflow' ? 'coming in' : 'going out'}`, code: 'FINANCE_TAG_INVALID', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    const [updated] = await db
      .update(treasuryTransactionEntries)
      .set({ categoryId: tags.categoryId, costCentreId: tags.costCentreId, batchId: tags.batchId })
      .where(eq(treasuryTransactionEntries.id, entryId))
      .returning();
    createAuditLog({
      userId: req.user!.id,
      action: 'ledger_entry_retagged',
      entityType: 'treasury_transaction_entry',
      entityId: entryId,
      changes: {
        before: { categoryId: entry.categoryId, costCentreId: entry.costCentreId, batchId: entry.batchId },
        after: tags,
      },
    });
    res.json({ success: true, data: updated, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (error instanceof Error && /closed period/i.test(error.message)) {
      res.status(400).json({ success: false, error: error.message, code: 'PERIOD_LOCKED', statusCode: 400, timestamp: new Date().toISOString() });
      return;
    }
    logger.error('Failed to re-tag ledger entry', { error });
    res.status(500).json({ success: false, error: 'Failed to re-tag ledger entry', code: 'LEDGER_RETAG_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/transactions', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const { accountId, transactionType, status, categoryId, costCentreId, batchId, from, to } = req.query;

    let query = db
      .select({
        id: treasuryTransactions.id,
        transactionCode: treasuryTransactions.transactionCode,
        transactionType: treasuryTransactions.transactionType,
        transactionDate: treasuryTransactions.transactionDate,
        status: treasuryTransactions.status,
        referenceNumber: treasuryTransactions.referenceNumber,
        counterpartyType: treasuryTransactions.counterpartyType,
        counterpartyId: treasuryTransactions.counterpartyId,
        counterpartyNameSnapshot: treasuryTransactions.counterpartyNameSnapshot,
        sourceModule: treasuryTransactions.sourceModule,
        sourceEntityType: sql<string | null>`
          (
            SELECT ${qualified(treasuryTransactionLinks.sourceEntityType)}
            FROM ${treasuryTransactionLinks}
            WHERE ${qualified(treasuryTransactionLinks.treasuryTransactionId)} = ${TX_ID}
            ORDER BY ${qualified(treasuryTransactionLinks.id)}
            LIMIT 1
          )
        `,
        sourceEntityId: sql<number | null>`
          (
            SELECT ${qualified(treasuryTransactionLinks.sourceEntityId)}
            FROM ${treasuryTransactionLinks}
            WHERE ${qualified(treasuryTransactionLinks.treasuryTransactionId)} = ${TX_ID}
            ORDER BY ${qualified(treasuryTransactionLinks.id)}
            LIMIT 1
          )
        `,
        sourceCodeSnapshot: sql<string | null>`
          (
            SELECT ${qualified(treasuryTransactionLinks.sourceCodeSnapshot)}
            FROM ${treasuryTransactionLinks}
            WHERE ${qualified(treasuryTransactionLinks.treasuryTransactionId)} = ${TX_ID}
            ORDER BY ${qualified(treasuryTransactionLinks.id)}
            LIMIT 1
          )
        `,
        narrative: treasuryTransactions.narrative,
        createdAt: treasuryTransactions.createdAt,
        categoryNames: sql<string | null>`
          (
            SELECT string_agg(DISTINCT fc.name, ', ')
            FROM ${treasuryTransactionEntries} e
            JOIN ${financeCategories} fc ON fc.id = e.category_id
            WHERE e.treasury_transaction_id = ${TX_ID}
          )
        `,
        costCentreNames: sql<string | null>`
          (
            SELECT string_agg(DISTINCT cc.name, ', ')
            FROM ${treasuryTransactionEntries} e
            JOIN ${costCentres} cc ON cc.id = e.cost_centre_id
            WHERE e.treasury_transaction_id = ${TX_ID}
          )
        `,
        hasUncategorized: sql<boolean>`
          EXISTS (
            SELECT 1 FROM ${treasuryTransactionEntries} e
            JOIN ${financeCategories} fc ON fc.id = e.category_id
            WHERE e.treasury_transaction_id = ${TX_ID} AND fc.category_type = 'suspense'
          )
        `,
      })
      .from(treasuryTransactions)
      .$dynamic();

    const conditions = [];
    if (transactionType) {
      conditions.push(eq(treasuryTransactions.transactionType, String(transactionType)));
    }
    if (status) {
      conditions.push(eq(treasuryTransactions.status, String(status)));
    }
    // Entry-level filters use EXISTS so a transaction with several matching lines is listed once.
    const entryFilters = [
      accountId ? sql`e.finance_account_id = ${Number(accountId)}` : null,
      categoryId ? sql`e.category_id = ${Number(categoryId)}` : null,
      costCentreId ? sql`e.cost_centre_id = ${Number(costCentreId)}` : null,
      batchId ? sql`e.batch_id = ${Number(batchId)}` : null,
    ].filter(Boolean);
    for (const filter of entryFilters) {
      conditions.push(sql`EXISTS (SELECT 1 FROM ${treasuryTransactionEntries} e WHERE e.treasury_transaction_id = ${TX_ID} AND ${filter})`);
    }
    if (from) {
      conditions.push(sql`${treasuryTransactions.transactionDate} >= ${String(from)}`);
    }
    if (to) {
      conditions.push(sql`${treasuryTransactions.transactionDate} <= ${String(to)}`);
    }
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const transactions = await query.orderBy(desc(treasuryTransactions.transactionDate), desc(treasuryTransactions.id));
    res.json({ success: true, data: transactions, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch treasury transactions', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch treasury transactions', code: 'TREASURY_TRANSACTIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/transactions/:id', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const transactionId = Number(req.params.id as string);
    const [transaction] = await db
      .select()
      .from(treasuryTransactions)
      .where(eq(treasuryTransactions.id, transactionId))
      .limit(1);

    if (!transaction) {
      res.status(404).json({ success: false, error: 'Treasury transaction not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const [entries, links] = await Promise.all([
      db
        .select({
          id: treasuryTransactionEntries.id,
          financeAccountId: treasuryTransactionEntries.financeAccountId,
          accountCode: financeAccounts.accountCode,
          accountName: financeAccounts.accountName,
          entryDirection: treasuryTransactionEntries.entryDirection,
          amount: treasuryTransactionEntries.amount,
          valueDate: treasuryTransactionEntries.valueDate,
          notes: treasuryTransactionEntries.notes,
          categoryId: treasuryTransactionEntries.categoryId,
          categoryName: financeCategories.name,
          categoryType: financeCategories.categoryType,
          costCentreId: treasuryTransactionEntries.costCentreId,
          costCentreName: costCentres.name,
          batchId: treasuryTransactionEntries.batchId,
          batchCode: batches.batchCode,
        })
        .from(treasuryTransactionEntries)
        .leftJoin(financeAccounts, eq(treasuryTransactionEntries.financeAccountId, financeAccounts.id))
        .leftJoin(financeCategories, eq(treasuryTransactionEntries.categoryId, financeCategories.id))
        .leftJoin(costCentres, eq(treasuryTransactionEntries.costCentreId, costCentres.id))
        .leftJoin(batches, eq(treasuryTransactionEntries.batchId, batches.id))
        .where(eq(treasuryTransactionEntries.treasuryTransactionId, transactionId))
        .orderBy(asc(treasuryTransactionEntries.id)),
      db
        .select()
        .from(treasuryTransactionLinks)
        .where(eq(treasuryTransactionLinks.treasuryTransactionId, transactionId))
        .orderBy(asc(treasuryTransactionLinks.id)),
    ]);

    res.json({
      success: true,
      data: {
        transaction,
        entries,
        links,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch treasury transaction detail', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch treasury transaction detail', code: 'TREASURY_TRANSACTION_DETAIL_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post(
  '/transactions/manual',
  authenticate,
  requirePermission('treasury:transactions:manage'),
  validate(createManualTreasuryTransactionSchema),
  async (req: Request, res: Response) => {
    try {
      const transaction = await createManualTreasuryTransaction({
        transactionDate: req.body.transactionDate,
        transactionType: req.body.transactionType,
        financeAccountId: req.body.financeAccountId,
        sourceFinanceAccountId: req.body.sourceFinanceAccountId,
        destinationFinanceAccountId: req.body.destinationFinanceAccountId,
        amount: req.body.amount,
        referenceNumber: req.body.referenceNumber || null,
        counterpartyName: req.body.counterpartyName || null,
        narrative: req.body.narrative,
        postedBy: req.user!.id,
        categoryId: req.body.categoryId ?? null,
        costCentreId: req.body.costCentreId ?? null,
        batchId: req.body.batchId ?? null,
        approval: req.body.transactionType === 'manual_outflow' && await needsApproval('money_out', Number(req.body.amount), req.user!.userRole)
          ? { requestedBy: req.user!.id, summary: `${req.body.narrative} (${req.body.counterpartyName || 'money out'})` }
          : null,
        sourceLink:
          req.body.sourceEntityType && req.body.sourceEntityId
            ? {
                sourceModule: 'treasury',
                sourceEntityType: req.body.sourceEntityType,
                sourceEntityId: req.body.sourceEntityId,
                sourceCodeSnapshot: req.body.sourceCodeSnapshot || null,
              }
            : null,
      });

      res.status(201).json({
        success: true,
        data: transaction,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
        sendTreasurySchemaNotReady(res);
        return;
      }
      logger.error('Failed to create manual treasury transaction', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create treasury transaction',
        code: 'TREASURY_TRANSACTION_CREATE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

router.get('/expenses/operational', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const expenses = await db
      .select({
        id: operationalExpenses.id,
        expenseCode: operationalExpenses.expenseCode,
        expenseDate: operationalExpenses.expenseDate,
        expenseCategory: operationalExpenses.expenseCategory,
        counterpartyName: operationalExpenses.counterpartyName,
        allocationType: operationalExpenses.allocationType,
        siteId: operationalExpenses.siteId,
        siteName: sites.siteName,
        batchId: operationalExpenses.batchId,
        amount: operationalExpenses.amount,
        status: operationalExpenses.status,
        approvalNotes: operationalExpenses.approvalNotes,
        approvedBy: operationalExpenses.approvedBy,
        approvedAt: operationalExpenses.approvedAt,
        financeAccountId: operationalExpenses.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        paymentMethod: operationalExpenses.paymentMethod,
        referenceNumber: operationalExpenses.referenceNumber,
        chequeLeafId: operationalExpenses.chequeLeafId,
        chequeNumber: operationalExpenses.chequeNumber,
        chequeDate: operationalExpenses.chequeDate,
        bankName: operationalExpenses.bankName,
        treasuryTransactionId: operationalExpenses.treasuryTransactionId,
        treasuryReversalTransactionId: operationalExpenses.treasuryReversalTransactionId,
        requestedBy: operationalExpenses.requestedBy,
        requestedByName: users.fullName,
        notes: operationalExpenses.notes,
        createdAt: operationalExpenses.createdAt,
        updatedAt: operationalExpenses.updatedAt,
      })
      .from(operationalExpenses)
      .leftJoin(financeAccounts, eq(operationalExpenses.financeAccountId, financeAccounts.id))
      .leftJoin(users, eq(operationalExpenses.requestedBy, users.id))
      .leftJoin(sites, eq(operationalExpenses.siteId, sites.id))
      .orderBy(desc(operationalExpenses.expenseDate), desc(operationalExpenses.id));

    res.json({ success: true, data: expenses, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch operational expenses', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch operational expenses', code: 'OPERATIONAL_EXPENSES_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/expenses/operational', authenticate, requirePermission('treasury:transactions:manage'), validate(createOperationalExpenseSchema), async (req: Request, res: Response) => {
  try {
    const expense = await createOperationalExpense({
      expenseDate: req.body.expenseDate,
      categoryId: req.body.categoryId,
      counterpartyName: req.body.counterpartyName || null,
      costCentreId: req.body.costCentreId ?? null,
      siteId: req.body.siteId ?? null,
      batchId: req.body.batchId ?? null,
      amount: req.body.amount,
      notes: req.body.notes || null,
      requestedBy: req.user!.id,
    });

    res.status(201).json({ success: true, data: expense, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create operational expense', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create operational expense', code: 'OPERATIONAL_EXPENSE_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/expenses/operational/:id/review', authenticate, requirePermission('treasury:transactions:manage'), validate(reviewOperationalExpenseSchema), async (req: Request, res: Response) => {
  try {
    const expense = await reviewOperationalExpense({
      expenseId: Number(req.params.id as string),
      status: req.body.status,
      approvalNotes: req.body.approvalNotes || null,
      approvedBy: req.user!.id,
    });

    res.json({ success: true, data: expense, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to review operational expense', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to review operational expense', code: 'OPERATIONAL_EXPENSE_REVIEW_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.put('/expenses/operational/:id/settle', authenticate, requirePermission('treasury:transactions:manage'), validate(settleOperationalExpenseSchema), async (req: Request, res: Response) => {
  try {
    const expense = await settleOperationalExpense({
      expenseId: Number(req.params.id as string),
      financeAccountId: req.body.financeAccountId,
      paymentMethod: req.body.paymentMethod,
      paymentDate: req.body.paymentDate,
      referenceNumber: req.body.referenceNumber || null,
      chequeLeafId: req.body.chequeLeafId ?? null,
      paidBy: req.user!.id,
    });

    res.json({ success: true, data: expense, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to settle operational expense', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to settle operational expense', code: 'OPERATIONAL_EXPENSE_SETTLEMENT_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/reconciliations', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const reconciliations = await db
      .select({
        id: financeReconciliations.id,
        financeAccountId: financeReconciliations.financeAccountId,
        financeAccountName: financeAccounts.accountName,
        periodStart: financeReconciliations.periodStart,
        periodEnd: financeReconciliations.periodEnd,
        statementDate: financeReconciliations.statementDate,
        bookBalance: financeReconciliations.bookBalance,
        clearedBalance: financeReconciliations.clearedBalance,
        statementBalance: financeReconciliations.statementBalance,
        varianceAmount: financeReconciliations.varianceAmount,
        status: financeReconciliations.status,
        notes: financeReconciliations.notes,
        createdBy: financeReconciliations.createdBy,
        closedBy: financeReconciliations.closedBy,
        closedAt: financeReconciliations.closedAt,
        createdAt: financeReconciliations.createdAt,
        updatedAt: financeReconciliations.updatedAt,
        clearedEntryCount: sql<number>`
          COALESCE((
            SELECT COUNT(*)::int
            FROM ${treasuryTransactionEntries}
            WHERE ${qualified(treasuryTransactionEntries.reconciliationId)} = ${qualified(financeReconciliations.id)}
          ), 0)
        `,
      })
      .from(financeReconciliations)
      .leftJoin(financeAccounts, eq(financeReconciliations.financeAccountId, financeAccounts.id))
      .orderBy(desc(financeReconciliations.statementDate), desc(financeReconciliations.id));

    res.json({ success: true, data: reconciliations, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch reconciliations', { error });
    res.status(500).json({ success: false, error: 'Failed to fetch reconciliations', code: 'TREASURY_RECONCILIATIONS_FETCH_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.post('/reconciliations', authenticate, requirePermission('treasury:transactions:manage'), validate(createFinanceReconciliationSchema), async (req: Request, res: Response) => {
  try {
    const reconciliation = await createFinanceReconciliation({
      financeAccountId: req.body.financeAccountId,
      periodStart: req.body.periodStart,
      periodEnd: req.body.periodEnd,
      statementDate: req.body.statementDate,
      statementBalance: req.body.statementBalance,
      clearedEntryIds: req.body.clearedEntryIds,
      notes: req.body.notes || null,
      createdBy: req.user!.id,
    });

    res.status(201).json({ success: true, data: reconciliation, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to create reconciliation', { error });
    res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Failed to create reconciliation', code: 'TREASURY_RECONCILIATION_CREATE_FAILED', statusCode: 500, timestamp: new Date().toISOString() });
  }
});

router.get('/managers', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const managers = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        siteId: users.siteId,
        siteName: sites.siteName,
      })
      .from(users)
      .leftJoin(sites, eq(users.siteId, sites.id))
      .where(and(eq(users.userRole, UserRole.FarmManager), eq(users.isActive, true)))
      .orderBy(asc(users.fullName));

    res.json({ success: true, data: managers, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch farm managers for treasury', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch farm managers',
      code: 'TREASURY_MANAGERS_FETCH_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/petty-cash/allocations', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const conditions = [];
    const canManagePettyCash = hasPermission(req.user!.userRole, 'treasury:petty_cash:manage');

    if (!canManagePettyCash) {
      conditions.push(eq(pettyCashAllocations.allocatedToUserId, req.user!.id));
    }

    let query = db
      .select({
        id: pettyCashAllocations.id,
        allocationCode: pettyCashAllocations.allocationCode,
        sourceFinanceAccountId: pettyCashAllocations.sourceFinanceAccountId,
        pettyCashAccountId: pettyCashAllocations.pettyCashAccountId,
        allocatedToUserId: pettyCashAllocations.allocatedToUserId,
        allocatedToName: users.fullName,
        siteId: pettyCashAllocations.siteId,
        siteName: sites.siteName,
        purpose: pettyCashAllocations.purpose,
        amount: pettyCashAllocations.amount,
        allocationDate: pettyCashAllocations.allocationDate,
        status: pettyCashAllocations.status,
        treasuryTransactionId: pettyCashAllocations.treasuryTransactionId,
        reviewedBy: pettyCashAllocations.reviewedBy,
        reviewedAt: pettyCashAllocations.reviewedAt,
        reviewNotes: pettyCashAllocations.reviewNotes,
        createdBy: pettyCashAllocations.createdBy,
        createdAt: pettyCashAllocations.createdAt,
        updatedAt: pettyCashAllocations.updatedAt,
        approvedExpenseAmount: sql<number>`
          COALESCE((
            SELECT SUM(${qualified(pettyCashExpenses.amount)}::numeric)
            FROM ${pettyCashExpenses}
            WHERE ${qualified(pettyCashExpenses.allocationId)} = ${qualified(pettyCashAllocations.id)}
              AND ${qualified(pettyCashExpenses.status)} = 'approved'
          ), 0)::float
        `,
        submittedExpenseAmount: sql<number>`
          COALESCE((
            SELECT SUM(${qualified(pettyCashExpenses.amount)}::numeric)
            FROM ${pettyCashExpenses}
            WHERE ${qualified(pettyCashExpenses.allocationId)} = ${qualified(pettyCashAllocations.id)}
              AND ${qualified(pettyCashExpenses.status)} = 'submitted'
          ), 0)::float
        `,
      })
      .from(pettyCashAllocations)
      .leftJoin(users, eq(pettyCashAllocations.allocatedToUserId, users.id))
      .leftJoin(sites, eq(pettyCashAllocations.siteId, sites.id))
      .$dynamic();

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const allocations = await query.orderBy(desc(pettyCashAllocations.allocationDate), desc(pettyCashAllocations.id));
    res.json({ success: true, data: allocations, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch petty cash allocations', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch petty cash allocations',
      code: 'PETTY_CASH_ALLOCATIONS_FETCH_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/petty-cash/allocations/:id', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const allocationId = Number(req.params.id as string);
    const canManagePettyCash = hasPermission(req.user!.userRole, 'treasury:petty_cash:manage');
    const [allocation] = await db
      .select({
        id: pettyCashAllocations.id,
        allocationCode: pettyCashAllocations.allocationCode,
        sourceFinanceAccountId: pettyCashAllocations.sourceFinanceAccountId,
        pettyCashAccountId: pettyCashAllocations.pettyCashAccountId,
        allocatedToUserId: pettyCashAllocations.allocatedToUserId,
        allocatedToName: users.fullName,
        purpose: pettyCashAllocations.purpose,
        amount: pettyCashAllocations.amount,
        allocationDate: pettyCashAllocations.allocationDate,
        status: pettyCashAllocations.status,
        treasuryTransactionId: pettyCashAllocations.treasuryTransactionId,
        reviewedBy: pettyCashAllocations.reviewedBy,
        reviewedAt: pettyCashAllocations.reviewedAt,
        reviewNotes: pettyCashAllocations.reviewNotes,
        createdBy: pettyCashAllocations.createdBy,
        createdAt: pettyCashAllocations.createdAt,
        updatedAt: pettyCashAllocations.updatedAt,
      })
      .from(pettyCashAllocations)
      .leftJoin(users, eq(pettyCashAllocations.allocatedToUserId, users.id))
      .where(eq(pettyCashAllocations.id, allocationId))
      .limit(1);

    if (!allocation) {
      res.status(404).json({
        success: false,
        error: 'Petty cash allocation not found',
        code: 'NOT_FOUND',
        statusCode: 404,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!canManagePettyCash && allocation.allocatedToUserId !== req.user!.id) {
      res.status(403).json({
        success: false,
        error: 'You can only view your own petty cash allocation',
        code: 'FORBIDDEN',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const expenses = await db
      .select({
        id: pettyCashExpenses.id,
        allocationId: pettyCashExpenses.allocationId,
        expenseDate: pettyCashExpenses.expenseDate,
        expenseCategory: pettyCashExpenses.expenseCategory,
        amount: pettyCashExpenses.amount,
        justification: pettyCashExpenses.justification,
        status: pettyCashExpenses.status,
        treasuryTransactionId: pettyCashExpenses.treasuryTransactionId,
        reviewedBy: pettyCashExpenses.reviewedBy,
        reviewedAt: pettyCashExpenses.reviewedAt,
        reviewNotes: pettyCashExpenses.reviewNotes,
        createdBy: pettyCashExpenses.createdBy,
        createdAt: pettyCashExpenses.createdAt,
        updatedAt: pettyCashExpenses.updatedAt,
      })
      .from(pettyCashExpenses)
      .where(eq(pettyCashExpenses.allocationId, allocationId))
      .orderBy(desc(pettyCashExpenses.expenseDate), desc(pettyCashExpenses.id));

    res.json({
      success: true,
      data: {
        allocation,
        expenses,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
      sendTreasurySchemaNotReady(res);
      return;
    }
    logger.error('Failed to fetch petty cash allocation detail', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch petty cash allocation detail',
      code: 'PETTY_CASH_ALLOCATION_DETAIL_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post(
  '/petty-cash/allocations',
  authenticate,
  requirePermission('treasury:petty_cash:manage'),
  validate(createPettyCashAllocationSchema),
  async (req: Request, res: Response) => {
    try {
      const allocation = await createPettyCashAllocation({
        sourceFinanceAccountId: req.body.sourceFinanceAccountId,
        pettyCashAccountId: req.body.pettyCashAccountId,
        allocatedToUserId: req.body.allocatedToUserId,
        amount: req.body.amount,
        allocationDate: req.body.allocationDate,
        purpose: req.body.purpose,
        createdBy: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: allocation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
        sendTreasurySchemaNotReady(res);
        return;
      }
      logger.error('Failed to create petty cash allocation', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create petty cash allocation',
        code: 'PETTY_CASH_ALLOCATION_CREATE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

router.post(
  '/petty-cash/allocations/:id/expenses',
  authenticate,
  requirePermission('treasury:petty_cash:submit'),
  validate(createPettyCashExpenseSchema),
  async (req: Request, res: Response) => {
    try {
      const allocationId = Number(req.params.id as string);
      const [allocation] = await db
        .select({
          id: pettyCashAllocations.id,
          allocatedToUserId: pettyCashAllocations.allocatedToUserId,
          createdBy: pettyCashAllocations.createdBy,
        })
        .from(pettyCashAllocations)
        .where(eq(pettyCashAllocations.id, allocationId))
        .limit(1);

      if (!allocation) {
        res.status(404).json({
          success: false,
          error: 'Petty cash allocation not found',
          code: 'NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (allocation.allocatedToUserId !== req.user!.id && allocation.createdBy !== req.user!.id) {
        res.status(403).json({
          success: false,
          error: 'You can only submit expenses for your own petty cash allocation',
          code: 'FORBIDDEN',
          statusCode: 403,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const expense = await submitPettyCashExpense({
        allocationId,
        expenseDate: req.body.expenseDate,
        categoryId: req.body.categoryId,
        costCentreId: req.body.costCentreId ?? null,
        amount: req.body.amount,
        justification: req.body.justification,
        createdBy: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: expense,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
        sendTreasurySchemaNotReady(res);
        return;
      }
      logger.error('Failed to submit petty cash expense', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to submit petty cash expense',
        code: 'PETTY_CASH_EXPENSE_CREATE_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

router.put(
  '/petty-cash/expenses/:id/review',
  authenticate,
  requirePermission('treasury:petty_cash:review'),
  validate(reviewPettyCashExpenseSchema),
  async (req: Request, res: Response) => {
    try {
      const expenseId = Number(req.params.id as string);
      const expense = await reviewPettyCashExpense({
        expenseId,
        status: req.body.status,
        reviewNotes: req.body.reviewNotes || null,
        reviewedBy: req.user!.id,
      });

      res.json({
        success: true,
        data: expense,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
      if (isMissingTreasuryTable(error) || isMissingTreasuryColumn(error)) {
        sendTreasurySchemaNotReady(res);
        return;
      }
      logger.error('Failed to review petty cash expense', { error });
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to review petty cash expense',
        code: 'PETTY_CASH_EXPENSE_REVIEW_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

router.get('/period-locks', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    const locks = await db.select().from(periodLocks).orderBy(desc(periodLocks.periodStart), desc(periodLocks.id));
    res.json({ success: true, data: locks, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to fetch period locks', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch period locks',
      code: 'PERIOD_LOCKS_FETCH_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/period-locks', authenticate, requirePermission('treasury:transactions:manage'), validate(createPeriodLockSchema), async (req: Request, res: Response) => {
  try {
    const lockCode = await getNextPeriodLockCode(req.body.periodStart);
    const [lock] = await db
      .insert(periodLocks)
      .values({
        lockCode,
        periodStart: req.body.periodStart,
        periodEnd: req.body.periodEnd,
        scope: req.body.scope,
        status: 'active',
        notes: req.body.notes || null,
        createdBy: req.user!.id,
      })
      .returning();

    res.status(201).json({ success: true, data: lock, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to create period lock', { error });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create period lock',
      code: 'PERIOD_LOCK_CREATE_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

router.put('/period-locks/:id/release', authenticate, requirePermission('treasury:transactions:manage'), validate(releasePeriodLockSchema), async (req: Request, res: Response) => {
  try {
    const lockId = Number(req.params.id as string);
    const [lock] = await db.select().from(periodLocks).where(eq(periodLocks.id, lockId)).limit(1);

    if (!lock) {
      res.status(404).json({ success: false, error: 'Period lock not found', code: 'NOT_FOUND', statusCode: 404, timestamp: new Date().toISOString() });
      return;
    }

    const notes = req.body.notes
      ? [lock.notes, `Released: ${req.body.notes}`].filter(Boolean).join('\n')
      : lock.notes;

    const [released] = await db
      .update(periodLocks)
      .set({
        status: 'released',
        notes,
        releasedBy: req.user!.id,
        releasedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(periodLocks.id, lockId))
      .returning();

    res.json({ success: true, data: released, timestamp: new Date().toISOString() });
  } catch (error) {
    if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
    logger.error('Failed to release period lock', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to release period lock',
      code: 'PERIOD_LOCK_RELEASE_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
