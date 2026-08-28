import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const base = {
    DATABASE_URL: 'postgresql://user:pass@ep-test.neon.tech/neondb?sslmode=require',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('accepts a valid Neon-style configuration', () => {
    const env = validateEnv(base);
    expect(env.PORT).toBe(4000);
    expect(env.DATABASE_URL).toContain('neon.tech');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
  });
});
