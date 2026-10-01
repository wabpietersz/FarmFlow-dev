import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { requireSiteAccess, siteOf } from '../lib/site-scope';
import { validate } from '../validators/auth';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { isFinanceTagError, sendFinanceTagError } from '../lib/finance-tags';
import { getStatutoryRates, setStatutoryRates } from '../lib/payroll-calc';
import {
  issueStaffLoan,
  listStaffLoans,
  payPeriod,
  payrollRegister,
  PayrollRuleError,
  remitStatutory,
  repayStaffLoan,
  statutoryReturn,
  writeOffStaffLoan,
} from '../lib/staff-payroll';

/** Advances & loans, paying a month, register/payslips, EPF/ETF. Mounted at /payroll before the main payroll router. */
const router = Router();
const now = () => new Date().toISOString();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const period = z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Pay period must be YYYY-MM');

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof PayrollRuleError) {
    const status = error.code === 'NOT_FOUND' ? 404 : 400;
    res.status(status).json({ success: false, error: error.message, code: error.code, statusCode: status, timestamp: now() });
    return;
  }
  if (isFinanceTagError(error)) { sendFinanceTagError(res, error); return; }
  if (error instanceof Error && /closed period|finance account not found|cheque/i.test(error.message)) {
    res.status(400).json({ success: false, error: error.message, code: 'PAYROLL_RULE', statusCode: 400, timestamp: now() });
    return;
  }
  logger.error(fallback, { error });
  res.status(500).json({ success: false, error: fallback, code: 'PAYROLL_FAILED', statusCode: 500, timestamp: now() });
}

// --- EPF/ETF rates ---------------------------------------------------------

router.get('/settings/statutory', authenticate, requirePermission('payroll:read'), async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getStatutoryRates(), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load EPF/ETF rates');
  }
});

const ratesSchema = z.object({
  epfEmployeeRate: z.number().min(0).max(100),
  epfEmployerRate: z.number().min(0).max(100),
  etfEmployerRate: z.number().min(0).max(100),
});
router.put('/settings/statutory', authenticate, requirePermission('payroll:approve'), validate(ratesSchema), async (req: Request, res: Response) => {
  try {
    const before = await getStatutoryRates();
    await setStatutoryRates(req.body, req.user!.id);
    createAuditLog({ userId: req.user!.id, action: 'payroll.statutory_rates_changed', entityType: 'system_config', changes: { before, after: req.body } });
    res.json({ success: true, data: req.body, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to save EPF/ETF rates');
  }
});

// --- Advances & loans ------------------------------------------------------

router.get('/loans', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined;
    const employeeId = req.query.employeeId ? Number(req.query.employeeId) : undefined;
    res.json({ success: true, data: await listStaffLoans({ status, employeeId, siteId: req.user!.siteId ?? null }), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load advances and loans');
  }
});

const loanSchema = z.object({
  employeeId: z.number().int().positive('Employee is required'),
  loanType: z.enum(['advance', 'loan']),
  principal: z.number().positive('Amount must be positive'),
  installmentAmount: z.number().positive().optional(),
  issuedDate: isoDate,
  firstRecoveryPeriod: period,
  financeAccountId: z.number().int().positive('Choose the account it is paid from'),
  paymentMethod: z.enum(['cash', 'bank_transfer']).default('cash'),
  notes: z.string().max(1000).nullable().optional(),
});
router.post('/loans', authenticate, requireSiteAccess(siteOf.bodyEmployee()), requirePermission('payroll:create'), validate(loanSchema), async (req: Request, res: Response) => {
  try {
    const loan = await issueStaffLoan({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'payroll.loan_issued', entityType: 'staff_loan', entityId: loan.id, changes: req.body });
    res.status(201).json({ success: true, data: loan, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to pay out the advance');
  }
});

const repaySchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  date: isoDate,
  financeAccountId: z.number().int().positive('Choose the account it was paid into'),
  notes: z.string().max(1000).nullable().optional(),
});
router.post('/loans/:id/repayments', authenticate, requirePermission('payroll:create'), validate(repaySchema), async (req: Request, res: Response) => {
  try {
    const recovery = await repayStaffLoan({ ...req.body, loanId: Number(req.params.id), userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'payroll.loan_repaid', entityType: 'staff_loan', entityId: Number(req.params.id), changes: req.body });
    res.status(201).json({ success: true, data: recovery, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to record the repayment');
  }
});

router.post('/loans/:id/write-off', authenticate, requirePermission('payroll:approve'), validate(z.object({ reason: z.string().trim().min(3, 'Give a reason') })), async (req: Request, res: Response) => {
  try {
    const loan = await writeOffStaffLoan(Number(req.params.id), req.body.reason);
    createAuditLog({ userId: req.user!.id, action: 'payroll.loan_written_off', entityType: 'staff_loan', entityId: loan.id, changes: req.body });
    res.json({ success: true, data: loan, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to write off');
  }
});

// --- Paying, register, EPF/ETF ---------------------------------------------

const payPeriodSchema = z.object({
  payPeriod: period,
  financeAccountId: z.number().int().positive('Choose the account to pay from'),
  paymentMethod: z.enum(['cash', 'bank_transfer']).default('bank_transfer'),
  payDate: isoDate.optional(),
});
router.post('/pay-period', authenticate, requirePermission('payroll:update'), validate(payPeriodSchema), async (req: Request, res: Response) => {
  try {
    const result = await payPeriod({ ...req.body, siteId: req.user!.siteId ?? null, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'payroll.period_paid', entityType: 'payroll', changes: { ...req.body, ...result } });
    res.json({ success: true, data: result, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to pay the month');
  }
});

router.get('/register', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await payrollRegister(String(req.query.period ?? ''), req.user!.siteId ?? null), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build the payroll register');
  }
});

router.get('/statutory', authenticate, requirePermission('payroll:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await statutoryReturn(String(req.query.period ?? '')), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build the EPF/ETF return');
  }
});

const remitSchema = z.object({
  payPeriod: period,
  financeAccountId: z.number().int().positive('Choose the account to pay from'),
  paidDate: isoDate,
  epfReference: z.string().max(100).nullable().optional(),
  etfReference: z.string().max(100).nullable().optional(),
});
router.post('/statutory/remit', authenticate, requirePermission('payroll:update'), validate(remitSchema), async (req: Request, res: Response) => {
  try {
    const remittance = await remitStatutory({ ...req.body, userId: req.user!.id });
    createAuditLog({ userId: req.user!.id, action: 'payroll.statutory_remitted', entityType: 'statutory_remittance', entityId: remittance.id, changes: req.body });
    res.status(201).json({ success: true, data: remittance, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to pay EPF/ETF');
  }
});

export default router;
