/**
 * Test database lifecycle.
 *
 * Tests run against an ephemeral in-memory MongoDB. Nothing here can reach a
 * real cluster, which matters because these tests call deleteMany() between
 * cases — the previous suite fell back to MONGODB_URI and could have wiped
 * production data.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Importing the models registers them on the mongoose instance, which is what
// makes `mongoose.models` populated for the index build below.
require('../models/Cattle');
require('../models/MilkProduction');
require('../models/Feeding');
require('../models/Expense');
require('../models/Revenue');
require('../models/Settings');

let memoryServer;

/** Refuse to run against anything that looks like a real deployment. */
function assertNotRealDatabase(uri) {
  const isLocal =
    uri.includes('127.0.0.1') || uri.includes('localhost') || uri.includes('0.0.0.0');

  if (!isLocal || uri.includes('mongodb+srv')) {
    throw new Error(
      'Refusing to run tests against a non-local database. ' +
        'Tests use an in-memory MongoDB only.'
    );
  }
}

beforeAll(async () => {
  memoryServer = await MongoMemoryServer.create();
  const uri = memoryServer.getUri();

  assertNotRealDatabase(uri);
  await mongoose.connect(uri);

  // Build the real indexes (including the unique milk-per-day index) so tests
  // exercise the same constraints as production.
  await Promise.all(
    Object.values(mongoose.models).map((model) => model.createIndexes())
  );
}, 120000);

afterEach(async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((collection) => collection.deleteMany({}))
  );
});

afterAll(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});
