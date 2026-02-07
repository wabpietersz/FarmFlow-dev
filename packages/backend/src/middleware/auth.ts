import { type Request, type Response, type NextFunction } from 'express';
import { type UserRole } from '@farmflow/shared';
import { firebaseAuth } from '../lib/firebase';
import { hasPermission } from '../lib/permissions';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import logger from '../lib/logger';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'UNAUTHORIZED',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await firebaseAuth.verifyIdToken(token);

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, decoded.uid))
      .limit(1);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        error: 'Account is deactivated',
        code: 'ACCOUNT_DEACTIVATED',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    req.user = {
      id: user.id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      fullName: user.fullName,
      userRole: user.userRole as UserRole,
      siteId: user.siteId,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    next();
  } catch (error) {
    logger.error('Token verification failed', { error });
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!roles.includes(req.user.userRole)) {
      logger.warn('Access denied — insufficient role', {
        userId: req.user.id,
        userRole: req.user.userRole,
        requiredRoles: roles,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!hasPermission(req.user.userRole, permission)) {
      logger.warn('Access denied — missing permission', {
        userId: req.user.id,
        userRole: req.user.userRole,
        requiredPermission: permission,
        path: req.path,
      });
      res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    next();
  };
}
