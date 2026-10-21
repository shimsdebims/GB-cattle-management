const { isAuthRequired } = require('../../utils/auth');
const { createApp } = require('../../app');
const request = require('supertest');

describe('login fails closed', () => {
  test('only an explicit "false" turns login off', () => {
    expect(isAuthRequired('false')).toBe(false);
    expect(isAuthRequired(' FALSE ')).toBe(false);
    expect(isAuthRequired('true')).toBe(true);
    expect(isAuthRequired(undefined)).toBe(true);
    expect(isAuthRequired('')).toBe(true);
    expect(isAuthRequired('flase')).toBe(true);
    expect(isAuthRequired('0')).toBe(true);
  });

  test('with AUTH_REQUIRED unset, data routes need a login', async () => {
    const saved = process.env.AUTH_REQUIRED;
    delete process.env.AUTH_REQUIRED;
    try {
      const res = await request(createApp({ enableLogging: false })).get('/api/cattle');
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('AUTH_REQUIRED');
    } finally {
      if (saved !== undefined) process.env.AUTH_REQUIRED = saved;
    }
  });

  test('the health check stays public (the app uses it to detect the server)', async () => {
    const saved = process.env.AUTH_REQUIRED;
    delete process.env.AUTH_REQUIRED;
    try {
      const res = await request(createApp({ enableLogging: false })).get('/api/health');
      expect(res.status).toBe(200);
    } finally {
      if (saved !== undefined) process.env.AUTH_REQUIRED = saved;
    }
  });
});
