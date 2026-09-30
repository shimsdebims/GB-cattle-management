const { encrypt, decrypt } = require('../../utils/backupCrypto');
const { resolvePrice } = require('../../utils/pricing');

describe('backup encryption', () => {
  const pass = 'a long enough passphrase';

  test('round-trips and hides the content', () => {
    const file = encrypt('{"cattle":[{"name":"Bessie"}]}', pass);
    expect(file.toString('latin1')).not.toContain('Bessie');
    expect(decrypt(file, pass)).toBe('{"cattle":[{"name":"Bessie"}]}');
  });

  test('rejects a wrong passphrase and a damaged file', () => {
    const file = encrypt('secret', pass);
    expect(() => decrypt(file, 'another long passphrase')).toThrow(/Wrong passphrase/);

    const damaged = Buffer.from(file);
    damaged[damaged.length - 1] ^= 0xff;
    expect(() => decrypt(damaged, pass)).toThrow(/Wrong passphrase or damaged/);
    expect(() => decrypt(Buffer.from('nope'), pass)).toThrow(/Not a GB backup/);
  });

  test('refuses a short passphrase', () => {
    expect(() => encrypt('x', 'short')).toThrow(/at least 16/);
  });
});

describe('price lookup', () => {
  test('uses the entry in force on the day', () => {
    const prices = [
      { effective_from: '1970-01-01', price_per_liter: 1700 },
      { effective_from: '2026-10-15', price_per_liter: 1800 },
    ];
    expect(resolvePrice(prices, '2026-10-14', 0)).toBe(1700);
    expect(resolvePrice(prices, '2026-10-15', 0)).toBe(1800);
  });
});
