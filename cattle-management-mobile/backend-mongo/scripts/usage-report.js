/**
 * Prints the farm's activity summary (counts and dates only). Read-only.
 * Usage: MONGODB_URI=… node scripts/usage-report.js
 * Runs from GitHub Actions ("Usage report") and at the end of every backup.
 */
require('dotenv').config();

const db = require('../db');
const { usageSummary, printUsageSummary } = require('../utils/usageSummary');

async function main() {
  const connected = await db.connect(process.env.MONGODB_URI, { required: true });
  if (!connected) throw new Error('Could not connect.');
  printUsageSummary(await usageSummary());
}

main()
  .then(() => db.disconnect())
  .catch(async (error) => {
    console.error(`Usage report failed: ${error.message}`);
    await db.disconnect();
    process.exit(1);
  });
