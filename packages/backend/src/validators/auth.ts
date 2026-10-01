import { z } from 'zod';
import { UserRole } from '@farmflow/shared';
import { type Request, type Response, type NextFunction } from 'express';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().trim().min(1, 'First name is required').max(120),
  lastName: z.string().trim().min(1, 'Last name is required').max(120),
  userRole: z.nativeEnum(UserRole, { errorMap: () => ({ message: 'Invalid user role' }) }),
  siteId: z.number().int().positive().optional(),
});

export const loginSchema = z.object({
  idToken: z.string().min(1, 'ID token is required'),
});

export function validate(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        statusCode: 400,
        details: result.error.flatten().fieldErrors,
        timestamp: new Date().toISOString(),
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const setAccessLevelSchema = z.object({
  role: z.string().min(1),
  moduleKey: z.enum(['farms', 'feed_mill', 'stock', 'sales', 'money', 'people', 'attendance', 'payroll', 'reports', 'administration']),
  level: z.enum(['none', 'user', 'admin']),
});
