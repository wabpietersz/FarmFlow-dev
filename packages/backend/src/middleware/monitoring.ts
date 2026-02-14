/**
 * Monitoring & alerting middleware for FarmFlow backend.
 * Provides:
 * - Request metrics collection (count, latency, error rate)
 * - Health check with dependency status
 * - Alert threshold checking
 */
import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';
import logger from '../lib/logger';

// ==================== In-Memory Metrics ====================

interface RequestMetrics {
  totalRequests: number;
  errorCount: number;
  latencySum: number;
  latencyMax: number;
  statusCodes: Record<number, number>;
  startTime: number;
  windowRequests: number[]; // Timestamps for rate calculation
}

const metrics: RequestMetrics = {
  totalRequests: 0,
  errorCount: 0,
  latencySum: 0,
  latencyMax: 0,
  statusCodes: {},
  startTime: Date.now(),
  windowRequests: [],
};

const WINDOW_SIZE = 60000; // 1-minute window for rate calculation
const REQUIRED_HR_PAYROLL_TABLES = [
  'employee_compensation',
  'employee_compensation_revisions',
  'employee_compensation_components',
  'compensation_templates',
  'payroll',
  'payroll_deductions',
  'payroll_allowances',
] as const;

/**
 * Middleware to collect request metrics.
 */
export function metricsCollector(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const now = Date.now();

    metrics.totalRequests++;
    metrics.latencySum += duration;
    if (duration > metrics.latencyMax) {
      metrics.latencyMax = duration;
    }

    // Track status codes
    const status = res.statusCode;
    metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

    if (status >= 500) {
      metrics.errorCount++;
    }

    // Sliding window for request rate
    metrics.windowRequests.push(now);
    // Clean old entries
    metrics.windowRequests = metrics.windowRequests.filter(
      (t) => now - t < WINDOW_SIZE,
    );

    // Alert on high latency
    if (duration > 5000) {
      logger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: status,
      });
    }

    // Alert on high error rate (>5% in the last minute)
    const recentErrors = Object.entries(metrics.statusCodes)
      .filter(([code]) => parseInt(code) >= 500)
      .reduce((sum, [, count]) => sum + count, 0);
    const errorRate = metrics.totalRequests > 0 ? (recentErrors / metrics.totalRequests) * 100 : 0;
    if (errorRate > 5 && metrics.totalRequests > 10) {
      logger.error('High error rate alert', {
        errorRate: errorRate.toFixed(2),
        totalRequests: metrics.totalRequests,
        errorCount: recentErrors,
      });
    }
  });

  next();
}

/**
 * Get current metrics snapshot.
 */
export function getMetrics() {
  const uptime = Date.now() - metrics.startTime;
  const avgLatency = metrics.totalRequests > 0
    ? metrics.latencySum / metrics.totalRequests
    : 0;
  const requestsPerMinute = metrics.windowRequests.length;
  const errorRate = metrics.totalRequests > 0
    ? (metrics.errorCount / metrics.totalRequests) * 100
    : 0;

  return {
    uptime: Math.floor(uptime / 1000),
    totalRequests: metrics.totalRequests,
    requestsPerMinute,
    averageLatency: Math.round(avgLatency),
    maxLatency: metrics.latencyMax,
    errorCount: metrics.errorCount,
    errorRate: parseFloat(errorRate.toFixed(2)),
    statusCodes: { ...metrics.statusCodes },
    memoryUsage: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  };
}

/**
 * Health check handler with dependency status.
 */
export async function healthCheckHandler(_req: Request, res: Response) {
  const readinessRequested = _req.query.readiness === 'true';

  let databaseConnected = false;
  let missingHrPayrollTables: string[] = [];
  let dbError: string | undefined;

  try {
    await db.execute(sql`select 1`);
    databaseConnected = true;

    const checks = await Promise.all(
      REQUIRED_HR_PAYROLL_TABLES.map(async (tableName) => {
        const result = await db.execute(sql`
          select to_regclass(${`public.${tableName}`}) as table_name
        `);
        const row = Array.isArray(result) ? (result[0] as { table_name?: string | null } | undefined) : undefined;
        return { tableName, exists: !!row?.table_name };
      }),
    );

    missingHrPayrollTables = checks.filter((item) => !item.exists).map((item) => item.tableName);
  } catch (error) {
    dbError = error instanceof Error ? error.message : 'Unknown database error';
    logger.warn('Health check database probe failed', { error });
  }

  const hrPayrollSchemaReady = databaseConnected && missingHrPayrollTables.length === 0;
  const ready = databaseConnected && hrPayrollSchemaReady;

  const health: Record<string, unknown> = {
    status: 'ok',
    ready,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: Math.floor((Date.now() - metrics.startTime) / 1000),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
    },
    checks: {
      database: {
        status: databaseConnected ? 'ok' : 'error',
        error: dbError,
      },
      hrPayrollSchema: {
        status: hrPayrollSchemaReady ? 'ok' : 'error',
        missingTables: missingHrPayrollTables,
      },
    },
  };

  if (readinessRequested && !ready) {
    res.status(503).json({
      ...health,
      status: 'degraded',
    });
    return;
  }

  res.json(health);
}

/**
 * Detailed metrics endpoint (protected, admin only).
 */
export function metricsHandler(_req: Request, res: Response) {
  res.json({
    success: true,
    data: getMetrics(),
    timestamp: new Date().toISOString(),
  });
}
