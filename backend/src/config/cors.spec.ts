import { isAllowedCorsOrigin, parseCsvOrigins } from './cors';

describe('cors', () => {
  it('allows configured frontend URL', () => {
    const allowed = ['https://frontend-gray-two-sxhyv0kdcz.vercel.app'];
    expect(
      isAllowedCorsOrigin(
        'https://frontend-gray-two-sxhyv0kdcz.vercel.app',
        allowed,
      ),
    ).toBe(true);
  });

  it('allows Vercel preview deployments', () => {
    expect(
      isAllowedCorsOrigin(
        'https://frontend-git-main-noumanawazs-projects.vercel.app',
        [],
      ),
    ).toBe(true);
  });

  it('allows localhost during local dev', () => {
    expect(isAllowedCorsOrigin('http://localhost:3000', [])).toBe(true);
  });

  it('rejects unknown origins', () => {
    expect(isAllowedCorsOrigin('https://evil.example.com', [])).toBe(false);
  });

  it('parses comma-separated extra origins', () => {
    expect(
      parseCsvOrigins(
        'https://a.vercel.app, https://b.example.com ,',
      ),
    ).toEqual(['https://a.vercel.app', 'https://b.example.com']);
  });
});
