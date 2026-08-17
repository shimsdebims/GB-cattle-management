/**
 * Verifies the configured MongoDB connection without printing credentials.
 * Usage: node scripts/check-connection.js
 */
require('dotenv').config();

const db = require('../db');

async function main() {
  const uri = process.env.MONGODB_URI;
  const testUri = process.env.MONGODB_TEST_URI;

  console.log('MONGODB_URI usable:     ', !db.isUnusableUri(uri));
  console.log('MONGODB_TEST_URI usable:', !db.isUnusableUri(testUri));

  if (db.isUnusableUri(uri)) {
    console.error('\nSet MONGODB_URI in backend-mongo/.env before continuing.');
    process.exit(1);
  }

  const connected = await db.connect(uri, { required: true });
  console.log('connected:', connected);
  console.log('database: ', db.mongoose.connection.name);

  const collections = await db.mongoose.connection.db.listCollections().toArray();
  console.log('collections:', collections.map((c) => c.name).join(', ') || '(none)');

  for (const { name } of collections) {
    const count = await db.mongoose.connection.db.collection(name).countDocuments();
    console.log(`  ${name}: ${count} docs`);
  }

  await db.disconnect();
}

main().catch((error) => {
  console.error('Connection check failed:', error.message);
  process.exit(1);
});
