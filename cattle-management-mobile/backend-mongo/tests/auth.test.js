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
});
