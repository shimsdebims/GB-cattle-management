const request = require('supertest');

const { createApp } = require('../../app');

/**
 * CORS and proxy behaviour. None of these touch the database, so they also run
 * with the no-DB config (`npm run test:unit`).
 */
describe('CORS and proxy', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  const preflight = (app, origin) =>
    request(app)
      .options('/api/cattle')
      .set('Origin', origin)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

  test('allows the stable Vercel origin and any deploy of this project', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    const app = createApp({ enableLogging: false });

    for (const origin of [
      'https://gb-cattle-management.vercel.app',
      'https://gb-cattle-management-k5nur9e06-shimsdebims.vercel.app',
      'https://gb-cattle-management-a1b2c3d4e-shimsdebims.vercel.app',
    ]) {
      const res = await preflight(app, origin);
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  test('refuses unrelated origins without a 500', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    const app = createApp({ enableLogging: false });

    for (const origin of [
      'https://evil.example.com',
      'https://gb-cattle-management.vercel.app.evil.com',
      'https://other-project-abc123-shimsdebims.vercel.app',
      'https://gb-cattle-management-abc123-someoneelse.vercel.app',
    ]) {
      const res = await preflight(app, origin);
      expect(res.status).toBeLessThan(500);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  test('accepts proxied requests behind Render without x-forwarded-for errors', async () => {
    process.env.NODE_ENV = 'production';
    const app = createApp({ enableLogging: false });

    const res = await request(app).get('/api/health').set('X-Forwarded-For', '203.0.113.42');
    expect(res.status).toBe(200);
  });

  test('keeps the health check public even when login is required', async () => {
    const app = createApp({ enableLogging: false, requireAuth: true });
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('rejects a data request without a token when login is required', async () => {
    process.env.AUTH_SECRET = 'x'.repeat(40);
    const app = createApp({ enableLogging: false, requireAuth: true });

    const res = await request(app).get('/api/cattle');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_REQUIRED');
  });

  test('rejects a forged token before touching the database', async () => {
    process.env.AUTH_SECRET = 'x'.repeat(40);
    const app = createApp({ enableLogging: false, requireAuth: true });

    const res = await request(app)
      .get('/api/cattle')
      .set('Authorization', 'Bearer eyJzdWIiOiIxIn0.forged');
    expect(res.status).toBe(401);
  });
});
