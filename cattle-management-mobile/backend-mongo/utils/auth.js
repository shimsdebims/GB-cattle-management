/**
 * Password hashing and session tokens on Node's built-in crypto.
 *
 * Tokens are HMAC-SHA256 signed: base64url(payload).base64url(signature).
 * The payload holds the user id, the user's token_version and an expiry, so a
 * password change (which bumps token_version) logs out every device.
 */
const crypto = require('crypto');

const SCRYPT_KEYLEN = 64;
const TOKEN_TTL_DAYS = 90; // one farmer on his own phone; re-login every quarter

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, hashHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const b64url = (buf) => Buffer.from(buf).toString('base64url');

function getSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    const error = new Error('AUTH_SECRET must be set to at least 32 characters.');
    error.code = 'AUTH_MISCONFIGURED';
    throw error;
  }
  return secret;
}

function sign(payloadB64) {
  return b64url(crypto.createHmac('sha256', getSecret()).update(payloadB64).digest());
}

function issueToken(user, { now = Date.now() } = {}) {
  const payload = {
    sub: String(user._id),
    v: user.token_version || 0,
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + TOKEN_TTL_DAYS * 24 * 3600,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/** Returns the payload, or null for anything malformed, forged or expired. */
function readToken(token, { now = Date.now() } = {}) {
  if (typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  TOKEN_TTL_DAYS,
  hashPassword,
  verifyPassword,
  issueToken,
  readToken,
};
