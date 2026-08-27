/**
 * Verifies the configured MongoDB connection without printing credentials.
 * Usage: node scripts/check-connection.js
 */
require('dotenv').config();

const db = require('../db');

/** Maps common Atlas failures to the actual fix. */
function explain(message) {
  if (/bad auth|authentication failed/i.test(message)) {
    return [
      'The URI is well-formed but Atlas rejected the username or password.',
      '',
      'In Atlas -> Database Access:',
      '  1. Confirm a user with that exact username exists.',
      '  2. Edit -> Edit Password -> Autogenerate -> Update User.',
      '  3. Put the new password in .env.',
      '',
      'Note: the password shown while creating a cluster is not always saved',
      'as a database user. Creating the user explicitly is the reliable path.',
      '',
      'If the password contains @ : / ? # or %, it must be URL-encoded.',
    ].join('\n');
  }

  if (/ENOTFOUND|querySrv|getaddrinfo/i.test(message)) {
    return 'The cluster hostname could not be resolved. Check it is copied correctly and that you are online.';
  }

  if (/timed out|ETIMEDOUT|ServerSelection/i.test(message)) {
    return [
      'Reached the network but no server responded in time. Usually the IP allowlist.',
      'Atlas -> Network Access -> Add IP Address -> Allow Access from Anywhere.',
    ].join('\n');
  }

  return null;
}

async function main() {
  const uri = process.env.MONGODB_URI;

  if (db.isUnusableUri(uri)) {
    console.error('MONGODB_URI is not set (or still has a placeholder).\n');
    console.error('In backend-mongo/.env there must be a line starting with');
    console.error('MONGODB_URI= and it must NOT begin with a # comment marker.\n');
    console.error('Check with:  grep -c \'^MONGODB_URI=\' .env    # expect 1');
    process.exit(1);
  }

  console.log('MONGODB_URI is set. Connecting...');

  await db.connect(uri, { required: true });
  console.log('\n✅  Connected');
  console.log('database:', db.mongoose.connection.name);

  const collections = await db.mongoose.connection.db.listCollections().toArray();
  console.log('collections:', collections.map((c) => c.name).join(', ') || '(none)');

  for (const { name } of collections) {
    const count = await db.mongoose.connection.db.collection(name).countDocuments();
    console.log(`  ${name}: ${count} docs`);
  }

  await db.disconnect();
}

main().catch(async (error) => {
  console.error(`\n❌  Connection failed: ${error.message}\n`);

  const advice = explain(error.message);
  if (advice) console.error(advice);

  console.error(
    '\nTo work on the app without Atlas in the meantime: npm run dev:local'
  );

  await db.disconnect().catch(() => {});
  process.exit(1);
});
