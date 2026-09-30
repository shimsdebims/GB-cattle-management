/**
 * Creates a user, or resets an existing user's password (which also logs out
 * every device that user was signed in on).
 *
 * Usage:  node scripts/create-user.js <username> <password>
 */
require('dotenv').config();

const db = require('../db');
const User = require('../models/User');
const { LIMITS } = require('../constants/domain');
const { hashPassword } = require('../utils/auth');

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) throw new Error('Usage: node scripts/create-user.js <username> <password>');
  if (password.length < LIMITS.PASSWORD_MIN) {
    throw new Error(`Password must be at least ${LIMITS.PASSWORD_MIN} characters.`);
  }

  await db.connect(process.env.MONGODB_URI, { required: true });

  const name = username.trim().toLowerCase();
  const existing = await User.findOne({ username: name });
  if (existing) {
    existing.password_hash = hashPassword(password);
    existing.token_version = (existing.token_version || 0) + 1;
    await existing.save();
    console.log(`Password reset for "${name}"; existing sessions are logged out.`);
  } else {
    await User.create({ username: name, password_hash: hashPassword(password), role: 'owner' });
    console.log(`Created user "${name}".`);
  }
}

main()
  .then(() => db.disconnect())
  .catch(async (error) => {
    console.error(error.message);
    await db.disconnect();
    process.exit(1);
  });
