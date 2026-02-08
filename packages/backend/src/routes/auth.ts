import { Router, type Request, type Response } from 'express';
import { UserRole } from '@farmflow/shared';
import { firebaseAuth } from '../lib/firebase';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, registerSchema, loginSchema } from '../validators/auth';
import { getUserPermissions } from '../lib/permissions';
import { db } from '../db';
import { users, sites } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../lib/logger';

const router = Router();

// POST /api/auth/register — admin-only user creation
router.post(
  '/register',
  authenticate,
  requireRole(UserRole.SystemAdmin),
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, fullName, userRole, siteId } = req.body;

      // Check if user already exists in our DB
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existing) {
        res.status(409).json({
          success: false,
          error: 'User with this email already exists',
          code: 'USER_EXISTS',
          statusCode: 409,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Create Firebase user
      const firebaseUser = await firebaseAuth.createUser({
        email,
        displayName: fullName,
      });

      // Set custom claims
      await firebaseAuth.setCustomUserClaims(firebaseUser.uid, {
        role: userRole,
        siteId: siteId || null,
      });

      // Insert into our users table
      const [newUser] = await db
        .insert(users)
        .values({
          firebaseUid: firebaseUser.uid,
          email,
          fullName,
          userRole,
          siteId: siteId || null,
        })
        .returning();

      // Generate password reset link (Firebase sends the email)
      const resetLink = await firebaseAuth.generatePasswordResetLink(email);

      logger.info('User created', {
        createdBy: req.user!.id,
        newUserId: newUser.id,
        email,
        role: userRole,
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            fullName: newUser.fullName,
            userRole: newUser.userRole,
            siteId: newUser.siteId,
            isActive: newUser.isActive,
            createdAt: newUser.createdAt,
          },
          passwordResetLink: resetLink,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to create user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to create user',
        code: 'CREATE_USER_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /api/auth/login — verify Firebase ID token and sync user
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    // Verify the Firebase ID token
    const decoded = await firebaseAuth.verifyIdToken(idToken);

    // Find user in our DB
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.firebaseUid, decoded.uid))
      .limit(1);

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found. Contact your administrator.',
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

    // Update last login
    await db
      .update(users)
      .set({ lastLogin: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id));

    const permissions = getUserPermissions(user.userRole as UserRole);

    logger.info('User logged in', { userId: user.id, email: user.email });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          userRole: user.userRole,
          siteId: user.siteId,
          isActive: user.isActive,
          lastLogin: new Date(),
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        permissions,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Login failed', { error });
    res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }
});

// POST /api/auth/logout — revoke refresh tokens
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await firebaseAuth.revokeRefreshTokens(req.user!.firebaseUid);

    logger.info('User logged out', { userId: req.user!.id });

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Logout failed', { error });
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_FAILED',
      statusCode: 500,
      timestamp: new Date().toISOString(),
    });
  }
});

// GET /api/auth/users — admin-only list all users
router.get(
  '/users',
  authenticate,
  requireRole(UserRole.SystemAdmin),
  async (_req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          userRole: users.userRole,
          siteId: users.siteId,
          siteName: sql<string | null>`${sites.siteName}`,
          isActive: users.isActive,
          lastLogin: users.lastLogin,
          createdAt: users.createdAt,
        })
        .from(users)
        .leftJoin(sites, eq(users.siteId, sites.id))
        .orderBy(users.fullName);

      res.json({
        success: true,
        data: allUsers,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to fetch users', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch users',
        code: 'FETCH_USERS_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// GET /api/auth/me — get current user profile
router.get('/me', authenticate, (req: Request, res: Response) => {
  const user = req.user!;
  const permissions = getUserPermissions(user.userRole);

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        userRole: user.userRole,
        siteId: user.siteId,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      permissions,
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
