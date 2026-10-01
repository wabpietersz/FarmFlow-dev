import { Router, type Request, type Response } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate } from '../validators/auth';
import { createBookingSchema, updateBookingSchema } from '../validators/sales';
import { createAuditLog } from '../lib/audit';
import logger from '../lib/logger';
import { buyerStatement, createBooking, listBookings, receivablesAgeing, SalesRuleError, updateBooking } from '../lib/sales-ops';

const router = Router();
const now = () => new Date().toISOString();
const isoDate = (value: unknown) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined);

function sendError(res: Response, error: unknown, fallback: string) {
  if (error instanceof SalesRuleError) {
    const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : 400;
    res.status(status).json({ success: false, error: error.message, code: error.code, statusCode: status, timestamp: now() });
    return;
  }
  logger.error(fallback, { error });
  res.status(500).json({ success: false, error: fallback, code: 'SALES_OPS_FAILED', statusCode: 500, timestamp: now() });
}

// GET /api/sale-bookings — bookings, soonest catch date first
router.get('/', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const data = await listBookings({
      status: typeof req.query.status === 'string' && req.query.status !== 'all' ? req.query.status : undefined,
      siteId: req.user!.siteId ?? null,
      from: isoDate(req.query.from),
      to: isoDate(req.query.to),
    });
    res.json({ success: true, data, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to load bookings');
  }
});

// POST /api/sale-bookings — book birds for a buyer before catching
router.post('/', authenticate, requirePermission('sales:create'), validate(createBookingSchema), async (req: Request, res: Response) => {
  try {
    const booking = await createBooking(req.body, req.user!.id, req.user!.siteId ?? null);
    createAuditLog({ userId: req.user!.id, action: 'sale_booking_created', entityType: 'sale_booking', entityId: booking.id, changes: req.body });
    res.status(201).json({ success: true, data: booking, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to create booking');
  }
});

// PUT /api/sale-bookings/:id — change or cancel a booking
router.put('/:id', authenticate, requirePermission('sales:create'), validate(updateBookingSchema), async (req: Request, res: Response) => {
  try {
    const booking = await updateBooking(Number(req.params.id), req.body, req.user!.siteId ?? null);
    createAuditLog({ userId: req.user!.id, action: req.body.status === 'cancelled' ? 'sale_booking_cancelled' : 'sale_booking_updated', entityType: 'sale_booking', entityId: booking.id, changes: req.body });
    res.json({ success: true, data: booking, timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to update booking');
  }
});

export const receivablesRouter = Router();

// GET /api/receivables/ageing?asOf=YYYY-MM-DD — who owes what, by how late
receivablesRouter.get('/ageing', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await receivablesAgeing(isoDate(req.query.asOf)), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build receivables ageing');
  }
});

// GET /api/receivables/statement/:buyerId?from&to — buyer statement for a period
receivablesRouter.get('/statement/:buyerId', authenticate, requirePermission('sales:read'), async (req: Request, res: Response) => {
  try {
    const to = isoDate(req.query.to) ?? new Date().toISOString().slice(0, 10);
    const from = isoDate(req.query.from) ?? `${to.slice(0, 8)}01`;
    if (from > to) {
      res.status(400).json({ success: false, error: 'From date must be before To date', code: 'BAD_RANGE', statusCode: 400, timestamp: now() });
      return;
    }
    res.json({ success: true, data: await buyerStatement(Number(req.params.buyerId), from, to), timestamp: now() });
  } catch (error) {
    sendError(res, error, 'Failed to build buyer statement');
  }
});

export default router;
