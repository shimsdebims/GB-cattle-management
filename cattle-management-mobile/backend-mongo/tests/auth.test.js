const request = require('supertest');

const { createApp } = require('../app');

describe('API authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;
  const originalEnableApiAuth = process.env.ENABLE_API_AUTH;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.API_KEY = originalApiKey;
    process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
    process.env.ENABLE_API_AUTH = originalEnableApiAuth;
  });

  test('allows unauthenticated requests by default so the app works in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY = 'test-secret';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    delete process.env.ENABLE_API_AUTH;

    const app = createApp({ enableLogging: false });
    const response = await request(app).get('/api/cattle');

    expect(response.status).not.toBe(401);
  });

  test('can enforce auth when ENABLE_API_AUTH=true', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY = 'test-secret';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    process.env.ENABLE_API_AUTH = 'true';

    const app = createApp({ enableLogging: false });
    const response = await request(app).get('/api/cattle');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Unauthorized');
  });

  test('allows production Vercel origins through CORS preflight', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    delete process.env.ENABLE_API_AUTH;

    const app = createApp({ enableLogging: false });
    const response = await request(app)
      .options('/api/cattle')
      .set('Origin', 'https://gb-cattle-management.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://gb-cattle-management.vercel.app');

    const deploymentResponse = await request(app)
      .options('/api/cattle')
      .set('Origin', 'https://gb-cattle-management-k5nur9e06-shimsdebims.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,authorization');

    expect(deploymentResponse.status).toBe(204);
    expect(deploymentResponse.headers['access-control-allow-origin']).toBe('https://gb-cattle-management-k5nur9e06-shimsdebims.vercel.app');

    // A later deploy gets a new hash and must keep working without a code change.
    const nextDeploy = 'https://gb-cattle-management-a1b2c3d4e-shimsdebims.vercel.app';
    const nextResponse = await request(app)
      .options('/api/cattle')
      .set('Origin', nextDeploy)
      .set('Access-Control-Request-Method', 'POST');
    expect(nextResponse.status).toBe(204);
    expect(nextResponse.headers['access-control-allow-origin']).toBe(nextDeploy);
  });

  test('does not grant CORS to unrelated origins, and does not 500', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    delete process.env.ENABLE_API_AUTH;

    const app = createApp({ enableLogging: false });
    for (const origin of [
      'https://evil.example.com',
      'https://gb-cattle-management.vercel.app.evil.com',
      'https://other-project-abc123-shimsdebims.vercel.app',
      'https://gb-cattle-management-abc123-someoneelse.vercel.app',
    ]) {
      const response = await request(app)
        .options('/api/cattle')
        .set('Origin', origin)
        .set('Access-Control-Request-Method', 'POST');
      expect(response.status).toBeLessThan(500);
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    }
  });

  test('accepts proxied requests behind Render without x-forwarded-for errors', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY = 'test-secret';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';
    delete process.env.ENABLE_API_AUTH;

    const app = createApp({ enableLogging: false });
    const response = await request(app)
      .get('/api/cattle')
      .set('X-Forwarded-For', '203.0.113.42');

    expect(response.status).not.toBe(400);
  });
});
