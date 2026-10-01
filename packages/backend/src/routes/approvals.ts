import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { hasPermission } from '../lib/permissions';
import { notifyDecision } from '../lib/notifications';
import { ApprovalError, approvalInbox, canDecide, decideApproval, getApprovalLimits, listApprovalRequests, setApprovalLimits } from '../lib/approvals';

/** Approval limits, over-limit requests and the inbox of everything waiting. Mounted at /approvals. */
const router = Router();
const now = () => new Date().toISOString();

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof ApprovalError) {
    res.status(error.status).json({ success: false, error: error.message, code: error.code, statusCode: error.status, timestamp: now() });
    return;
  }
  if (error instanceof Error && /closed period/i.test(error.message)) {
    res.status(400).json({ success: false, error: error.message, code: 'PERIOD_LOCKED', statusCode: 400, timestamp: now() });
    return;
  }
  logger.error(fallback, { error });
  res.status(500).json({ success: false, error: fallback, code: 'APPROVALS_FAILED', statusCode: 500, timestamp: now() });
}

router.get('/inbox', authenticate, async (req: Request, res: Response) => {
  try {
    const role = req.user!.userRole;
    const data = await approvalInbox((permission) => role === 'system_admin' || hasPermission(role, permission), role);
    res.json({ success: true, data: { ...data, canDecide: canDecide(role) }, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load approvals');
  }
});

router.get('/requests', authenticate, async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
    res.json({ success: true, data: await listApprovalRequests(status), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load approval requests');
  }
});

const decideSchema = z.object({ decision: z.enum(['approved', 'rejected']), note: z.string().max(500).nullable().optional() });
router.post('/requests/:id/decide', authenticate, validate(decideSchema), async (req: Request, res: Response) => {
  try {
    const decided = await decideApproval({ requestId: Number(req.params.id), decision: req.body.decision, note: req.body.note, userId: req.user!.id, role: req.user!.userRole });
    void notifyDecision(decided).catch((error) => logger.error('Failed to notify approval decision', { error }));
    createAuditLog({ userId: req.user!.id, action: `approval.${req.body.decision}`, entityType: decided.entityType, entityId: decided.entityId, changes: { requestId: decided.id, note: req.body.note ?? null } });
    res.json({ success: true, data: decided, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to record the decision');
  }
});

router.get('/limits', authenticate, async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await getApprovalLimits(), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load approval limits');
  }
});

const limitsSchema = z.object({ purchaseOrder: z.number().positive().nullable(), moneyOut: z.number().positive().nullable() });
router.put('/limits', authenticate, requirePermission('system:update'), validate(limitsSchema), async (req: Request, res: Response) => {
  try {
    const before = await getApprovalLimits();
    await setApprovalLimits(req.body, req.user!.id);
    createAuditLog({ userId: req.user!.id, action: 'approvals.limits_changed', entityType: 'system_config', changes: { before, after: req.body } });
    res.json({ success: true, data: req.body, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to save approval limits');
  }
});

export default router;
