const mongoose = require('mongoose');

// Mongoose 7 already defaults strictQuery to false; set it explicitly so the
// behaviour does not depend on the installed minor version.
mongoose.set('strictQuery', false);

const PLACEHOLDER_MARKERS = ['<YOUR_MONGODB_URI>', '<NEW_ROTATED_PASSWORD>', '<'];

/** True when the URI is missing or still contains a template placeholder. */
function isUnusableUri(uri) {
  if (!uri) return true;
  return PLACEHOLDER_MARKERS.some((marker) => uri.includes(marker));
}

/**
 * Connects to MongoDB.
 *
 * @param {string} uri
 * @param {{ required?: boolean }} options  When `required` is false the process
 *        stays alive on failure so the API can still serve /api/health and
 *        return clear errors instead of refusing to boot.
 */
async function connect(uri, { required = false } = {}) {
  if (isUnusableUri(uri)) {
    const message =
      'MONGODB_URI is not set or still contains a placeholder. ' +
      'Copy .env.example to .env and set a real connection string.';
    if (required) throw new Error(message);
    console.error(`\n⚠️  ${message}\n`);
    return false;
  }

  mongoose.connection.on('connected', () => console.log('✅  MongoDB connected'));
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected'));
  mongoose.connection.on('error', (err) => console.error('MongoDB error:', err.message));

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    return true;
  } catch (error) {
    if (required) throw error;
    console.error(`❌  MongoDB connection failed (server still running): ${error.message}`);
    return false;
  }
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Creates indexes declared in the schemas.
 *
 * Mongoose autocreates them in the background, but calling this explicitly at
 * startup surfaces conflicts (e.g. duplicate milk records blocking the new
 * unique index) as a loud error instead of a silent failure.
 */
async function syncIndexes(models) {
  const results = await Promise.allSettled(models.map((model) => model.syncIndexes()));

  results.forEach((result, i) => {
    if (result.status === 'rejected') {
      console.error(
        `⚠️  Could not build indexes for ${models[i].modelName}: ${result.reason.message}`
      );
    }
  });
}

module.exports = { connect, disconnect, syncIndexes, isUnusableUri, mongoose };
