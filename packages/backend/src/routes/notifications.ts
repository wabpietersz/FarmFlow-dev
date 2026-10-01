import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import logger from '../lib/logger';
import { generateNotifications, listNotifications, markRead } from '../lib/notifications';

/** The bell: your notifications, newest first. Mounted at /notifications. */
const router = Router();
const now = () => new Date().toISOString();
const fail = (res: Response, error: unknown, message: string) => {
  logger.error(message, { error });
  res.status(500).json({ success: false, error: message, code: 'NOTIFICATIONS_FAILED', statusCode: 500, timestamp: now() });
};

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await listNotifications(req.user!.id), timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to load notifications');
  }
});

router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    await markRead(req.user!.id);
    res.json({ success: true, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to mark notifications read');
  }
});

router.post('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    await markRead(req.user!.id, Number(req.params.id));
    res.json({ success: true, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to mark notification read');
  }
});

/** Check now instead of waiting for the half-hourly run. */
router.post('/refresh', authenticate, requirePermission('system:read'), async (_req: Request, res: Response) => {
  try {
    res.json({ success: true, data: { created: await generateNotifications() }, timestamp: now() });
  } catch (error) {
    fail(res, error, 'Failed to refresh notifications');
  }
});

export default router;
