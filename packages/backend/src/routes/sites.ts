import { Router, type Request, type Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../db';
import { sites } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../lib/logger';

const router = Router();

router.get('/list', authenticate, async (_req: Request, res: Response) => {
  try {
    const allSites = await db
      .select({
        id: sites.id,
        siteName: sites.siteName,
        location: sites.location,
      })
      .from(sites)
      .where(eq(sites.status, 'active'));

    res.json({
      success: true,
      data: allSites,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to fetch sites list', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sites list',
      code: 'SITES_LIST_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
