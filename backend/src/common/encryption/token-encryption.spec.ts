import { encryptSecret, decryptSecret, sha256 } from './token-encryption';

describe('token-encryption', () => {
  const key = Buffer.alloc(32, 7).toString('base64');

  it('round-trips secrets', () => {
    const encrypted = encryptSecret('refresh-token-value', key);
    expect(decryptSecret(encrypted, key)).toBe('refresh-token-value');
  });

  it('hashes consistently', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abcd'));
  });
});
