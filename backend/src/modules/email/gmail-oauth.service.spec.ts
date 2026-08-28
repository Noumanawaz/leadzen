import { JwtService } from '@nestjs/jwt';
import { GmailOAuthService } from './gmail-oauth.service';

describe('GmailOAuthService state', () => {
  const jwt = new JwtService({ secret: 'test-secret-at-least-32-characters!!' });
  const config = {
    get: (key: string) => {
      if (key === 'JWT_ACCESS_SECRET') {
        return 'test-secret-at-least-32-characters!!';
      }
      if (key === 'GOOGLE_CLIENT_ID') return 'cid';
      if (key === 'GOOGLE_CLIENT_SECRET') return 'sec';
      if (key === 'GOOGLE_REDIRECT_URI') {
        return 'http://localhost:4000/api/v1/integrations/gmail/callback';
      }
      return undefined;
    },
  };

  const service = new GmailOAuthService(config as never, jwt);

  it('rejects state without gmail_oauth purpose', async () => {
    const bad = await jwt.signAsync(
      { organizationId: 'o1', userId: 'u1', purpose: 'other' },
      { secret: 'test-secret-at-least-32-characters!!', expiresIn: '5m' },
    );
    await expect(service.verifyState(bad)).rejects.toThrow(/Invalid OAuth state/);
  });

  it('accepts signed gmail_oauth state', async () => {
    const good = await jwt.signAsync(
      { organizationId: 'o1', userId: 'u1', purpose: 'gmail_oauth' },
      { secret: 'test-secret-at-least-32-characters!!', expiresIn: '5m' },
    );
    await expect(service.verifyState(good)).resolves.toEqual({
      organizationId: 'o1',
      userId: 'u1',
    });
  });
});
