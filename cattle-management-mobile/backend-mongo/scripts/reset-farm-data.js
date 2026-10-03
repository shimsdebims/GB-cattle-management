/**
 * Clears test data before go-live (see utils/resetFarmData.js for what goes).
 *
 * Usage:
 *   MONGODB_URI=… node scripts/reset-farm-data.js                 # dry run: counts only
 *   MONGODB_URI=… RESET_CONFIRM="DELETE ALL FARM DATA" \
 *     node scripts/reset-farm-data.js --apply                     # deletes
 *
 * Normally run from GitHub Actions ("Reset farm data"), which takes an
 * encrypted backup first so the reset can be undone with scripts/restore.js.
 */
require('dotenv').config();

const db = require('../db');
const { countFarmData, resetFarmData } = require('../utils/resetFarmData');

const PHRASE = 'DELETE ALL FARM DATA';

async function main() {
  const connected = await db.connect(process.env.MONGODB_URI, { required: true });
  if (!connected) throw new Error('Could not connect.');

  const name = db.mongoose.connection.name;
  console.log(`Database: ${name}`);
  console.table(await countFarmData());

  const apply = process.argv.includes('--apply');
  if (!apply || process.env.RESET_CONFIRM !== PHRASE) {
    console.log(`\nDry run: nothing deleted. To delete, run with --apply and RESET_CONFIRM="${PHRASE}".`);
    return;
  }

  const removed = await resetFarmData();
  console.log(`\nDeleted from "${name}":`);
  console.table(removed);
  console.log('Kept: user accounts and settings. Set the current milk price in the app.');
}

main()
  .then(() => db.disconnect())
  .catch(async (error) => {
    console.error(`Reset failed: ${error.message}`);
    await db.disconnect();
    process.exit(1);
  });
