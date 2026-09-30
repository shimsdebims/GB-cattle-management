/**
 * Exports every collection to one encrypted file.
 *
 * Usage:  MONGODB_URI=… BACKUP_PASSPHRASE=… node scripts/backup.js [out-dir]
 * Output: <out-dir>/gb-backup-YYYY-MM-DDTHH-MM.json.enc  (default out-dir: ./backups)
 *
 * Read-only against the database. Runs nightly from GitHub Actions
 * (.github/workflows/backup.yml); restore with scripts/restore.js.
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const db = require('../db');
const { encrypt } = require('../utils/backupCrypto');

async function main() {
  const passphrase = process.env.BACKUP_PASSPHRASE;
  if (!passphrase) throw new Error('BACKUP_PASSPHRASE is not set.');

  const connected = await db.connect(process.env.MONGODB_URI, { required: true });
  if (!connected) throw new Error('Could not connect.');

  const database = mongoose.connection.db;
  const collections = (await database.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort();

  const dump = {
    format: 'gb-backup/1',
    database: database.databaseName,
    created_at: new Date().toISOString(),
    collections: {},
  };
  const counts = {};
  for (const name of collections) {
    const docs = await database.collection(name).find({}).toArray();
    dump.collections[name] = docs;
    counts[name] = docs.length;
  }

  // EJSON keeps ObjectIds and Dates exact, so a restore is byte-faithful.
  const file = encrypt(EJSON.stringify(dump, { relaxed: false }), passphrase);

  const outDir = path.resolve(process.argv[2] || 'backups');
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = dump.created_at.slice(0, 16).replace(/:/g, '-');
  const outFile = path.join(outDir, `gb-backup-${stamp}.json.enc`);
  fs.writeFileSync(outFile, file);

  console.log(`Backup written: ${outFile} (${file.length} bytes)`);
  console.table(counts);
}

main()
  .then(() => db.disconnect())
  .catch(async (error) => {
    console.error(`Backup failed: ${error.message}`);
    await db.disconnect();
    process.exit(1);
  });
