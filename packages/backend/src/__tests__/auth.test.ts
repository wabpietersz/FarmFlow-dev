import request from 'supertest';
import app from '../app';

// Mock Firebase Admin SDK
jest.mock('../lib/firebase', () => ({
  firebaseAuth: {
    verifyIdToken: jest.fn(),
    createUser: jest.fn(),
    setCustomUserClaims: jest.fn(),
    generatePasswordResetLink: jest.fn(),
    revokeRefreshTokens: jest.fn(),
  },
}));

// Mock database
jest.mock('../db', () => {
  const mockSelect = jest.fn();
  const mockInsert = jest.fn();
  const mockUpdate = jest.fn();

  return {
    db: {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    },
  };
});

import { firebaseAuth } from '../lib/firebase';
import { db } from '../db';

const mockVerifyIdToken = firebaseAuth.verifyIdToken as jest.Mock;
const mockCreateUser = firebaseAuth.createUser as jest.Mock;
const mockSetCustomUserClaims = firebaseAuth.setCustomUserClaims as jest.Mock;
const mockGeneratePasswordResetLink = firebaseAuth.generatePasswordResetLink as jest.Mock;
const mockRevokeRefreshTokens = firebaseAuth.revokeRefreshTokens as jest.Mock;

const mockUser = {
  id: 1,
  firebaseUid: 'firebase-uid-123',
  email: 'admin@farmflow.com',
  fullName: 'Test Admin',
  userRole: 'system_admin',
  siteId: null,
  isActive: true,
  lastLogin: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Helper to set up the DB mock chain for select queries
function mockDbSelect(result: unknown[]) {
  const chain = {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue(result),
      }),
    }),
  };
  (db.select as jest.Mock).mockReturnValue(chain);
  return chain;
}

// Helper to set up the DB mock chain for insert queries
function mockDbInsert(result: unknown[]) {
  const chain = {
    values: jest.fn().mockReturnValue({
      returning: jest.fn().mockResolvedValue(result),
    }),
  };
  (db.insert as jest.Mock).mockReturnValue(chain);
  return chain;
}

// Helper to set up the DB mock chain for update queries
function mockDbUpdate() {
  const chain = {
    set: jest.fn().mockReturnValue({
      where: jest.fn().mockResolvedValue(undefined),
    }),
  };
  (db.update as jest.Mock).mockReturnValue(chain);
  return chain;
}

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 400 if idToken is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return user data for valid token', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([mockUser]);
      mockDbUpdate();

      const res = await request(app).post('/api/auth/login').send({ idToken: 'valid-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('admin@farmflow.com');
      expect(res.body.data.permissions).toBeDefined();
      expect(Array.isArray(res.body.data.permissions)).toBe(true);
    });

    it('should return 401 for user not found in DB', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'unknown-uid' });
      mockDbSelect([]);

      const res = await request(app).post('/api/auth/login').send({ idToken: 'valid-token' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('USER_NOT_FOUND');
    });

    it('should return 403 for deactivated user', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([{ ...mockUser, isActive: false }]);

      const res = await request(app).post('/api/auth/login').send({ idToken: 'valid-token' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');
    });

    it('should return 401 for invalid token', async () => {
      mockVerifyIdToken.mockRejectedValue(new Error('Token expired'));

      const res = await request(app).post('/api/auth/login').send({ idToken: 'invalid-token' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without auth header', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should return current user for authenticated request', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([mockUser]);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('admin@farmflow.com');
      expect(res.body.data.permissions).toBeDefined();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(401);
    });

    it('should revoke tokens and return success', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([mockUser]);
      mockRevokeRefreshTokens.mockResolvedValue(undefined);

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('firebase-uid-123');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should return 401 without auth', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'new@farmflow.com',
        fullName: 'New User',
        userRole: 'farm_worker',
      });
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const nonAdmin = { ...mockUser, userRole: 'farm_worker' };
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([nonAdmin]);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'new@farmflow.com',
          fullName: 'New User',
          userRole: 'farm_worker',
        });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should create user when called by system_admin', async () => {
      // First call: authenticate middleware looks up the admin user
      // Second call: register handler checks if email already exists
      const selectChain = {
        from: jest.fn().mockReturnValue({
          where: jest.fn()
            .mockReturnValueOnce({ limit: jest.fn().mockResolvedValue([mockUser]) })
            .mockReturnValueOnce({ limit: jest.fn().mockResolvedValue([]) }),
        }),
      };
      (db.select as jest.Mock).mockReturnValue(selectChain);

      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockCreateUser.mockResolvedValue({ uid: 'new-firebase-uid' });
      mockSetCustomUserClaims.mockResolvedValue(undefined);
      mockGeneratePasswordResetLink.mockResolvedValue('https://reset-link');

      const newUser = {
        id: 2,
        firebaseUid: 'new-firebase-uid',
        email: 'worker@farmflow.com',
        fullName: 'Farm Worker',
        userRole: 'farm_worker',
        siteId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDbInsert([newUser]);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'worker@farmflow.com',
          fullName: 'Farm Worker',
          userRole: 'farm_worker',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('worker@farmflow.com');
      expect(mockCreateUser).toHaveBeenCalledWith({
        email: 'worker@farmflow.com',
        displayName: 'Farm Worker',
      });
    });

    it('should return 400 for invalid role', async () => {
      mockVerifyIdToken.mockResolvedValue({ uid: 'firebase-uid-123' });
      mockDbSelect([mockUser]);

      const res = await request(app)
        .post('/api/auth/register')
        .set('Authorization', 'Bearer valid-token')
        .send({
          email: 'new@farmflow.com',
          fullName: 'New User',
          userRole: 'invalid_role',
        });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
