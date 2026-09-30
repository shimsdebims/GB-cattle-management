const User = require('../models/User');
const { readToken } = require('../utils/auth');

const unauthorized = (res, message = 'Please log in.') =>
  res.status(401).json({
    success: false,
    error: 'Unauthorized',
    code: 'AUTH_REQUIRED',
    message,
    timestamp: new Date().toISOString(),
  });

/**
 * Guards every data route when `required` is true.
 *
 * `required` comes from AUTH_REQUIRED so login can be switched on only after
 * both apps ship a login screen; switching it on earlier would lock out the
 * versions already installed.
 */
const authMiddleware = ({ required }) => async (req, res, next) => {
  if (!required) return next();

  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return unauthorized(res);

  let payload;
  try {
    payload = readToken(token);
  } catch (error) {
    if (error.code === 'AUTH_MISCONFIGURED') {
      console.error(error.message);
      return res.status(500).json({
        success: false,
        error: 'Server Misconfiguration',
        message: 'Authentication is not configured.',
        timestamp: new Date().toISOString(),
      });
    }
    throw error;
  }
  if (!payload) return unauthorized(res, 'Your session has expired. Please log in again.');

  try {
    const user = await User.findById(payload.sub).lean();
    if (!user || (user.token_version || 0) !== payload.v) {
      return unauthorized(res, 'Your session has expired. Please log in again.');
    }
    req.user = { _id: String(user._id), username: user.username, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authMiddleware };
