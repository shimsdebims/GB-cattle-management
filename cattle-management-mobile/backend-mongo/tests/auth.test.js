const request = require('supertest');

const { createApp } = require('../app');
const User = require('../models/User');
const { hashPassword, verifyPassword, issueToken, readToken } = require('../utils/auth');
const { bootstrapOwner } = require('../routes/auth');

const SECRET = 's'.repeat(48);

describe('password hashing and tokens (unit)', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  test('verifies the right password and rejects a wrong one', () => {
    const stored = hashPassword('correct horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('correct horse');
    expect(verifyPassword('correct horse', stored)).toBe(true);
    expect(verifyPassword('wrong horse', stored)).toBe(false);
    expect(verifyPassword('x', 'garbage')).toBe(false);
  });

  test('round-trips a token and rejects tampering and expiry', () => {
    const user = { _id: 'abc123', token_version: 2 };
    const token = issueToken(user);
    expect(readToken(token)).toMatchObject({ sub: 'abc123', v: 2 });

    const [body, sig] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'other', v: 2, exp: 9e9 })).toString('base64url');
    expect(readToken(`${forged}.${sig}`)).toBeNull();
    expect(readToken(`${body}.${sig}x`)).toBeNull();

    const old = issueToken(user, { now: Date.now() - 200 * 24 * 3600 * 1000 });
    expect(readToken(old)).toBeNull();
  });

  test('refuses to sign with a missing or short secret', () => {
    process.env.AUTH_SECRET = 'short';
    expect(() => issueToken({ _id: '1' })).toThrow(/AUTH_SECRET/);
    process.env.AUTH_SECRET = SECRET;
  });
});

describe('login flow', () => {
  let app;

  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
    app = createApp({ enableLogging: false, requireAuth: true });
  });

  beforeEach(async () => {
    await User.create({ username: 'fermier', password_hash: hashPassword('vaches-2026') });
  });

  const login = (username, password) =>
    request(app).post('/api/auth/login').send({ username, password });

  test('logs in, and the token opens the data routes', async () => {
    const res = await login('Fermier', 'vaches-2026');
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('fermier');
    expect(res.body.data.user.password_hash).toBeUndefined();

    const list = await request(app)
      .get('/api/cattle')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(list.status).toBe(200);

    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${res.body.data.token}`);
    expect(me.body.data.user.username).toBe('fermier');
  });

  test('gives the same answer for a wrong password and an unknown user', async () => {
    const wrong = await login('fermier', 'nope-nope');
    const unknown = await login('personne', 'vaches-2026');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    expect(wrong.body.code).toBe('LOGIN_INVALID');
  });

  test('blocks every data route without a token', async () => {
    for (const path of ['/api/cattle', '/api/milk', '/api/financial/expenses', '/api/settings']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  test('a password change logs out old tokens', async () => {
    const first = (await login('fermier', 'vaches-2026')).body.data.token;

    const changed = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${first}`)
      .send({ current_password: 'vaches-2026', new_password: 'nouveau-2026' });
    expect(changed.status).toBe(200);

    const stale = await request(app).get('/api/cattle').set('Authorization', `Bearer ${first}`);
    expect(stale.status).toBe(401);

    const fresh = await request(app)
      .get('/api/cattle')
      .set('Authorization', `Bearer ${changed.body.data.token}`);
    expect(fresh.status).toBe(200);
  });

  test('rejects a too-short new password', async () => {
    const token = (await login('fermier', 'vaches-2026')).body.data.token;
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ current_password: 'vaches-2026', new_password: 'short' });
    expect(res.status).toBe(400);
  });
});

describe('owner bootstrap', () => {
  test('creates the owner once and never overwrites it', async () => {
    expect(await bootstrapOwner({ username: 'Fermier', password: 'premier-mdp' })).toBe(true);
    expect(await bootstrapOwner({ username: 'fermier', password: 'autre-mdp-2' })).toBe(false);

    const user = await User.findOne({ username: 'fermier' });
    expect(verifyPassword('premier-mdp', user.password_hash)).toBe(true);
  });

  test('does nothing without both variables', async () => {
    expect(await bootstrapOwner({ username: 'fermier' })).toBe(false);
    expect(await User.countDocuments()).toBe(0);
  });
});

describe('login off (default until both apps ship a login screen)', () => {
  test('data routes stay open', async () => {
    const open = createApp({ enableLogging: false, requireAuth: false });
    const res = await request(open).get('/api/cattle');
    expect(res.status).toBe(200);
  });
});
