/**
 * Restores an encrypted backup into a database.
 *
 * Usage:
 *   RESTORE_URI=… BACKUP_PASSPHRASE=… node scripts/restore.js <file.json.enc>           # dry run
 *   RESTORE_URI=… BACKUP_PASSPHRASE=… node scripts/restore.js <file.json.enc> --apply   # write
 *
 * Safety:
 *   - Uses RESTORE_URI, never MONGODB_URI, so restoring is a deliberate act.
 *   - Refuses a target that already holds data unless --replace is given, in
 *     which case each restored collection is emptied first.
 *   - Without --apply it only prints what it would do.
 */
require('dotenv').config();

const fs = require('fs');
const mongoose = require('mongoose');
const { EJSON } = mongoose.mongo.BSON;

const db = require('../db');
const { decrypt } = require('../utils/backupCrypto');

async function main() {
  const [file, ...flags] = process.argv.slice(2);
  const apply = flags.includes('--apply');
  const replace = flags.includes('--replace');
  if (!file) throw new Error('Pass the backup file to restore.');
  if (!process.env.RESTORE_URI) throw new Error('RESTORE_URI is not set.');

  const dump = EJSON.parse(decrypt(fs.readFileSync(file), process.env.BACKUP_PASSPHRASE), {
    relaxed: false,
  });
  if (dump.format !== 'gb-backup/1') throw new Error(`Unknown backup format: ${dump.format}`);

  console.log(`Backup of "${dump.database}" taken ${dump.created_at}`);
  const names = Object.keys(dump.collections);
  names.forEach((n) => console.log(`  ${n}: ${dump.collections[n].length} documents`));

  await db.connect(process.env.RESTORE_URI, { required: true });
  const database = mongoose.connection.db;

  const existing = {};
  for (const name of names) {
    existing[name] = await database.collection(name).estimatedDocumentCount();
  }
  const occupied = names.filter((n) => existing[n] > 0);
  if (occupied.length > 0 && !replace) {
    throw new Error(
      `Target "${database.databaseName}" already has data in: ${occupied.join(', ')}. ` +
        'Restore into an empty database, or pass --replace to overwrite those collections.'
    );
  }

  if (!apply) {
    console.log(`\nDry run: nothing written to "${database.databaseName}". Add --apply to restore.`);
    return;
  }

  for (const name of names) {
    const docs = dump.collections[name];
    if (replace) await database.collection(name).deleteMany({});
    if (docs.length > 0) await database.collection(name).insertMany(docs, { ordered: true });
    console.log(`  restored ${name}: ${docs.length}`);
  }
  console.log(`\nRestore complete into "${database.databaseName}". Restart the API to rebuild indexes.`);
}

main()
  .then(() => db.disconnect())
  .catch(async (error) => {
    console.error(`Restore failed: ${error.message}`);
    await db.disconnect();
    process.exit(1);
  });
