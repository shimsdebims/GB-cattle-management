const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const User = require('../models/User');
const { LIMITS } = require('../constants/domain');
const { hashPassword, verifyPassword, issueToken } = require('../utils/auth');
const { ok, asyncHandler, ApiError } = require('../middleware');

// Slow down password guessing. Disabled in tests.
const loginLimiter =
  process.env.NODE_ENV === 'test'
    ? (req, res, next) => next()
    : rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
          success: false,
          error: 'Too Many Requests',
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many login attempts. Wait 15 minutes and try again.',
        },
      });

const invalidLogin = () => {
  const error = new ApiError(401, 'Unauthorized', 'Wrong username or password.');
  error.code = 'LOGIN_INVALID';
  return error;
};

/** POST /api/auth/login — { username, password } → { token, user } */
router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!username || !password) throw invalidLogin();

    const user = await User.findOne({ username });
    // Same message whether the user exists or not, so usernames can't be probed.
    if (!user || !verifyPassword(password, user.password_hash)) throw invalidLogin();

    return ok(res, { token: issueToken(user), user: user.toJSON() });
  })
);

/** GET /api/auth/me — who the token belongs to. Mounted behind the auth guard. */
const me = asyncHandler(async (req, res) => {
  if (!req.user) {
    return ok(res, { user: null, auth_required: false });
  }
  return ok(res, { user: req.user, auth_required: true });
});

/** POST /api/auth/change-password — logs out every other device. */
const changePassword = asyncHandler(async (req, res) => {
  if (!req.user) throw new ApiError(401, 'Unauthorized', 'Please log in.');

  const current = String(req.body?.current_password || '');
  const next = String(req.body?.new_password || '');
  if (next.length < LIMITS.PASSWORD_MIN) {
    throw new ApiError(
      400,
      'Bad Request',
      `The new password must be at least ${LIMITS.PASSWORD_MIN} characters.`
    );
  }

  const user = await User.findById(req.user._id);
  if (!user || !verifyPassword(current, user.password_hash)) throw invalidLogin();

  user.password_hash = hashPassword(next);
  user.token_version = (user.token_version || 0) + 1;
  await user.save();

  return ok(res, { token: issueToken(user), user: user.toJSON() }, 'Password changed');
});

/**
 * Creates the owner account from ADMIN_USERNAME / ADMIN_PASSWORD on first boot
 * when no user exists yet. Does nothing afterwards, so changing the env later
 * never resets a password.
 */
async function bootstrapOwner({ username, password }) {
  if (!username || !password) return false;
  if ((await User.estimatedDocumentCount()) > 0) return false;
  if (password.length < LIMITS.PASSWORD_MIN) {
    console.error(`ADMIN_PASSWORD must be at least ${LIMITS.PASSWORD_MIN} characters; owner not created.`);
    return false;
  }
  await User.create({ username, password_hash: hashPassword(password), role: 'owner' });
  console.log(`👤  Created owner account "${username.toLowerCase()}"`);
  return true;
}

module.exports = { router, me, changePassword, bootstrapOwner };
