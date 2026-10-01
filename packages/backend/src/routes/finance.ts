import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { cashFlow, managementPnl, payablesAgeing, pnlByCostCentre, ReportInputError, supplierStatement } from '../lib/finance-reports';
import { getLoanRepayments, listBusinessLoans, OwnerLoanError, receiveBusinessLoan, recordOwnerMoney, repayBusinessLoan } from '../lib/owner-loans';

/** Management reports (P&L, cash flow, payables) and owner/loan money. Mounted at /finance. */
const router = Router();
const now = () => new Date().toISOString();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${today().slice(0, 4)}-01-01`;
const q = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof ReportInputError || error instanceof OwnerLoanError) {
    res.status(400).json({ success: false, error: error.message, code: 'FINANCE_RULE', statusCode: 400, timestamp: now() });
    return;
  }
  if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
  if (error instanceof Error && /closed period|finance account not found/i.test(error.message)) {
    res.status(400).json({ success: false, error: error.message, code: 'FINANCE_RULE', statusCode: 400, timestamp: now() });
    return;
  }
  logger.error(fallback, { error });
  res.status(500).json({ success: false, error: fallback, code: 'FINANCE_FAILED', statusCode: 500, timestamp: now() });
}

// --- Reports ---------------------------------------------------------------

router.get('/pnl', authenticate, requirePermission('reports:financial:read'), async (req: Request, res: Response) => {
  try {
    const data = await managementPnl({ from: q(req.query.from) ?? startOfYear(), to: q(req.query.to) ?? today(), costCentreId: req.query.costCentreId ? Number(req.query.costCentreId) : null });
    res.json({ success: true, data, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build profit & loss');
  }
});

router.get('/pnl/by-cost-centre', authenticate, requirePermission('reports:financial:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await pnlByCostCentre({ from: q(req.query.from) ?? startOfYear(), to: q(req.query.to) ?? today() }), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build profit & loss by cost centre');
  }
});

router.get('/cash-flow', authenticate, requirePermission('reports:financial:read'), async (req: Request, res: Response) => {
  try {
    const data = await cashFlow({ from: q(req.query.from) ?? startOfYear(), to: q(req.query.to) ?? today(), financeAccountId: req.query.accountId ? Number(req.query.accountId) : null });
    res.json({ success: true, data, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build cash flow');
  }
});

router.get('/payables', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await payablesAgeing(q(req.query.asOf)), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build payables');
  }
});

router.get('/payables/statement/:supplierId', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    const to = q(req.query.to) ?? today();
    const from = q(req.query.from) ?? `${to.slice(0, 8)}01`;
    res.json({ success: true, data: await supplierStatement(Number(req.params.supplierId), from, to), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build supplier statement');
  }
});

// --- Owner money and loans --------------------------------------------------

const ownerSchema = z.object({
  direction: z.enum(['in', 'out']),
  amount: z.number().positive('Amount must be positive'),
  date: isoDate,
  financeAccountId: z.number().int().positive('Choose an account'),
  reference: z.string().max(100).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});
router.post('/owner-money', authenticate, requirePermission('treasury:transactions:manage'), validate(ownerSchema), async (req: Request, res: Response) => {
  try {
    const transaction = await recordOwnerMoney({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: req.body.direction === 'in' ? 'finance.owner_capital' : 'finance.owner_drawings', entityType: 'treasury_transaction', entityId: transaction.id, changes: req.body });
    res.status(201).json({ success: true, data: transaction, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to record owner money');
  }
});

router.get('/loans', authenticate, requirePermission('treasury:read'), async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await listBusinessLoans(), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load loans');
  }
});

router.get('/loans/:id/repayments', authenticate, requirePermission('treasury:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getLoanRepayments(Number(req.params.id)), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load repayments');
  }
});

const loanSchema = z.object({
  lender: z.string().trim().min(1, 'Lender is required').max(150),
  principal: z.number().positive('Amount must be positive'),
  receivedDate: isoDate,
  financeAccountId: z.number().int().positive('Choose the account it was paid into'),
  interestRate: z.number().min(0).max(100).nullable().optional(),
  termMonths: z.number().int().positive().nullable().optional(),
  monthlyInstallment: z.number().positive().nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});
router.post('/loans', authenticate, requirePermission('treasury:transactions:manage'), validate(loanSchema), async (req: Request, res: Response) => {
  try {
    const loan = await receiveBusinessLoan({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'finance.loan_received', entityType: 'business_loan', entityId: loan.id, changes: req.body });
    res.status(201).json({ success: true, data: loan, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to record the loan');
  }
});

const repaySchema = z.object({
  paymentDate: isoDate,
  principalAmount: z.number().min(0),
  interestAmount: z.number().min(0),
  financeAccountId: z.number().int().positive('Choose the account it was paid from'),
  reference: z.string().max(100).nullable().optional(),
});
router.post('/loans/:id/repayments', authenticate, requirePermission('treasury:transactions:manage'), validate(repaySchema), async (req: Request, res: Response) => {
  try {
    const repayment = await repayBusinessLoan({ ...req.body, loanId: Number(req.params.id), userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'finance.loan_repaid', entityType: 'business_loan', entityId: Number(req.params.id), changes: req.body });
    res.status(201).json({ success: true, data: repayment, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to record the repayment');
  }
});

export default router;
