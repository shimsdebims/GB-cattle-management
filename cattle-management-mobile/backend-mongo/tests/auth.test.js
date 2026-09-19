const request = require('supertest');

const { createApp } = require('../app');

describe('API authentication', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKey = process.env.API_KEY;
  const originalAllowedOrigins = process.env.ALLOWED_ORIGINS;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.API_KEY = originalApiKey;
    process.env.ALLOWED_ORIGINS = originalAllowedOrigins;
  });

  test('rejects unauthenticated requests in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.API_KEY = 'test-secret';
    process.env.ALLOWED_ORIGINS = 'http://localhost:19006';

    const app = createApp({ enableLogging: false });
    const response = await request(app).get('/api/cattle');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Unauthorized');
  });
});
