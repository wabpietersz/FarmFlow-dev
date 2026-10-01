import request from 'supertest';
import app from '../app';

// Health checks never touch Firebase; firebase-admin 14 is ESM-only (jose), which Jest's CJS mode can't load
jest.mock('../lib/firebase', () => ({ firebaseAuth: { verifyIdToken: jest.fn() } }));

describe('Health Check', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.ready).toBe('boolean');
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(res.body.checks.hrPayrollSchema).toBeDefined();
    expect(res.body.version).toBe('1.0.0');
    expect(res.body.timestamp).toBeDefined();
  });

  it('GET /api/health should return 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.ready).toBe('boolean');
  });

  it('GET /api/health?readiness=true should return 200 or 503 with health payload', async () => {
    const res = await request(app).get('/api/health?readiness=true');
    expect([200, 503]).toContain(res.status);
    expect(res.body.status).toBeDefined();
    expect(typeof res.body.ready).toBe('boolean');
    expect(res.body.checks).toBeDefined();
  });

  it('GET /nonexistent should return 404', async () => {
    const res = await request(app).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});
