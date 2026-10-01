import { Router, type Request, type Response } from 'express';
import { sendPasswordResetEmail, sendPasswordResetResendEmail } from '../lib/mailer';
import { UserRole } from '@farmflow/shared';
import { firebaseAuth } from '../lib/firebase';
import { authenticate, requirePermission } from '../middleware/auth';
import { validate, registerSchema, loginSchema, setAccessLevelSchema } from '../validators/auth';
import { getAccessMatrix, getUserPermissions, setAccessLevel } from '../lib/permissions';
import { createAuditLog } from '../lib/audit';
import type { AccessModuleKey } from '@farmflow/shared';
import { db } from '../db';
import { users, sites } from '../db/schema';
import { eq, sql } from 'drizzle-orm';
import logger from '../lib/logger';
import { z } from 'zod';

/** The display name used everywhere else in FarmFlow. */
function joinName(firstName: string, lastName: string) {
  return [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

const router = Router();

// POST /api/auth/register — admin-only user creation
router.post(
  '/register',
  authenticate,
  requirePermission('users:create'),
  validate(registerSchema),
  async (req: Request, res: Response) => {
    try {
      const { email, firstName, lastName, userRole, siteId } = req.body;
      const fullName = joinName(firstName, lastName);

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
          firstName,
          lastName,
          fullName,
          userRole,
          siteId: siteId || null,
        })
        .returning();

      // Generate the set-password link and email it from our mail server (if configured).
      const resetLink = await firebaseAuth.generatePasswordResetLink(email);
      const emailSent = await sendPasswordResetEmail(email, fullName, resetLink);

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
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            fullName: newUser.fullName,
            userRole: newUser.userRole,
            siteId: newUser.siteId,
            isActive: newUser.isActive,
            createdAt: newUser.createdAt,
          },
          passwordResetLink: resetLink,
          emailSent,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('Failed to create user', { error });
      const firebaseError = error as { code?: string; message?: string };
      let errorMessage = 'Failed to create user';
      let statusCode = 500;
      if (firebaseError.code === 'auth/email-already-exists') {
        errorMessage = 'A Firebase account with this email already exists';
        statusCode = 409;
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
        statusCode = 400;
      }
      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: 'CREATE_USER_FAILED',
        statusCode,
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
          firstName: user.firstName,
          lastName: user.lastName,
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
  requirePermission('users:read'),
  async (_req: Request, res: Response) => {
    try {
      const allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
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

// PUT /api/auth/users/:id — admin-only update user
const updateUserSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(120).optional(),
  lastName: z.string().trim().min(1, 'Last name is required').max(120).optional(),
  userRole: z.nativeEnum(UserRole).optional(),
  siteId: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});

router.put(
  '/users/:id',
  authenticate,
  requirePermission('users:update'),
  validate(updateUserSchema),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id as string, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Find existing user
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!existing) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { firstName, lastName, userRole, siteId, isActive } = req.body;
      const nameChanged = firstName !== undefined || lastName !== undefined;
      const fullName = nameChanged ? joinName(firstName ?? existing.firstName, lastName ?? existing.lastName) : undefined;

      // Build update object
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (fullName !== undefined) updateData.fullName = fullName;
      if (userRole !== undefined) updateData.userRole = userRole;
      if (siteId !== undefined) updateData.siteId = siteId;
      if (isActive !== undefined) updateData.isActive = isActive;

      // Update our DB
      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      // Sync Firebase custom claims if role or site changed
      if (userRole !== undefined || siteId !== undefined) {
        try {
          await firebaseAuth.setCustomUserClaims(existing.firebaseUid, {
            role: userRole || existing.userRole,
            siteId: siteId !== undefined ? siteId : existing.siteId,
          });
        } catch (fbErr) {
          logger.error('Failed to update Firebase claims', { error: fbErr, userId });
        }
      }

      // Update Firebase display name if fullName changed
      if (fullName !== undefined) {
        try {
          await firebaseAuth.updateUser(existing.firebaseUid, {
            displayName: fullName,
          });
        } catch (fbErr) {
          logger.error('Failed to update Firebase display name', { error: fbErr, userId });
        }
      }

      // Disable/enable Firebase account if isActive changed
      if (isActive !== undefined) {
        try {
          await firebaseAuth.updateUser(existing.firebaseUid, {
            disabled: !isActive,
          });
        } catch (fbErr) {
          logger.error('Failed to update Firebase account status', { error: fbErr, userId });
        }
      }

      logger.info('User updated', {
        updatedBy: req.user!.id,
        userId,
        changes: req.body,
      });

      res.json({
        success: true,
        data: {
          id: updated.id,
          email: updated.email,
          firstName: updated.firstName,
          lastName: updated.lastName,
          fullName: updated.fullName,
          userRole: updated.userRole,
          siteId: updated.siteId,
          isActive: updated.isActive,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to update user', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to update user',
        code: 'UPDATE_USER_FAILED',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      });
    }
  },
);

// POST /api/auth/users/:id/reset-password — resend password reset link
router.post(
  '/users/:id/reset-password',
  authenticate,
  requirePermission('users:update'),
  async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id as string, 10);
      if (isNaN(userId)) {
        res.status(400).json({
          success: false,
          error: 'Invalid user ID',
          statusCode: 400,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND',
          statusCode: 404,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const resetLink = await firebaseAuth.generatePasswordResetLink(user.email);
      const emailSent = await sendPasswordResetResendEmail(user.email, user.fullName, resetLink);

      logger.info('Password reset link resent', {
        requestedBy: req.user!.id,
        userId,
        email: user.email,
      });

      res.json({
        success: true,
        data: {
          passwordResetLink: resetLink,
          emailSent,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to generate reset link', { error });
      const code = (error as { code?: string })?.code;
      if (code === 'auth/user-not-found') {
        res.status(404).json({ success: false, error: 'This user has no sign-in account in Firebase. Remove and re-create the user.', code: 'FIREBASE_USER_MISSING', statusCode: 404, timestamp: new Date().toISOString() });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to generate password reset link',
        code: 'RESET_LINK_FAILED',
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
        firstName: user.firstName,
        lastName: user.lastName,
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

// ─── Access levels: what each role can do in each module ─────────────────────

router.get('/access', authenticate, requirePermission('system:read'), (_req: Request, res: Response) => {
  res.json({ success: true, data: getAccessMatrix(), timestamp: new Date().toISOString() });
});

router.put('/access', authenticate, requirePermission('users:update'), validate(setAccessLevelSchema), async (req: Request, res: Response) => {
  try {
    const before = getAccessMatrix().roles.find((r) => r.role === req.body.role)?.levels[req.body.moduleKey as AccessModuleKey];
    const matrix = await setAccessLevel({ ...req.body, userId: req.user!.id });
    createAuditLog({
      userId: req.user!.id,
      action: 'access_level_changed',
      entityType: 'role_access',
      changes: { role: req.body.role, module: req.body.moduleKey, from: before, to: req.body.level },
    });
    res.json({ success: true, data: matrix, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message, code: 'ACCESS_UPDATE_REJECTED', statusCode: 400, timestamp: new Date().toISOString() });
  }
});

export default router;
