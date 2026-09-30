/**
 * AES-256-GCM encryption for backup files.
 *
 * Format: "GBBK1" | salt(16) | iv(12) | tag(16) | ciphertext
 * The key is derived from BACKUP_PASSPHRASE with scrypt, so the passphrase can
 * be any length and the file is useless without it.
 */
const crypto = require('crypto');

const MAGIC = Buffer.from('GBBK1');

function deriveKey(passphrase, salt) {
  if (!passphrase || passphrase.length < 16) {
    throw new Error('BACKUP_PASSPHRASE must be at least 16 characters.');
  }
  return crypto.scryptSync(passphrase, salt, 32);
}

function encrypt(plaintext, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

function decrypt(file, passphrase) {
  if (!file.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error('Not a GB backup file.');
  }
  let offset = MAGIC.length;
  const salt = file.subarray(offset, (offset += 16));
  const iv = file.subarray(offset, (offset += 12));
  const tag = file.subarray(offset, (offset += 16));
  const body = file.subarray(offset);

  const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Wrong passphrase or damaged backup file.');
  }
}

module.exports = { encrypt, decrypt };
