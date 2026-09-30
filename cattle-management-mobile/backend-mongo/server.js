require('dotenv').config();

const { createApp } = require('./app');
const db = require('./db');
const { ensurePriceHistory } = require('./utils/pricing');
const { bootstrapOwner } = require('./routes/auth');

const PORT = process.env.PORT || 8080;

const MODELS = [
  require('./models/Cattle'),
  require('./models/MilkProduction'),
  require('./models/Feeding'),
  require('./models/Expense'),
  require('./models/Revenue'),
  require('./models/Settings'),
  require('./models/MilkPrice'),
  require('./models/User'),
];

async function start() {
  // Not `required` — the API still boots and serves /api/health when the
  // database is unreachable, which makes misconfiguration obvious instead of
  // producing a crash loop.
  const connected = await db.connect(process.env.MONGODB_URI);

  if (connected) {
    await db.syncIndexes(MODELS);

    // One-off, idempotent: pin today's price on records saved before prices
    // were stored, so the first price change cannot revalue them.
    const priced = await ensurePriceHistory().catch((error) => {
      console.error('Price history migration failed:', error.message);
      return 0;
    });
    if (priced > 0) console.log(`💰  Stored the milk price on ${priced} existing records`);

    await bootstrapOwner({
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD,
    }).catch((error) => console.error('Owner bootstrap failed:', error.message));
  }

  if (process.env.AUTH_REQUIRED === 'true' && !process.env.AUTH_SECRET) {
    console.error('⚠️  AUTH_REQUIRED=true but AUTH_SECRET is not set: every request will fail.');
  }

  const app = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🚀  Server listening on port ${PORT}`);
    console.log(`    Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`    Health:      http://localhost:${PORT}/api/health`);
  });

  // Finish in-flight requests and close the DB connection before exiting, so
  // deploys and Ctrl+C do not sever active writes.
  const shutdown = async (signal) => {
    console.log(`\n${signal} received, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      console.error('Shutdown timed out, forcing exit.');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    server.close(async () => {
      await db.disconnect();
      console.log('Shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
