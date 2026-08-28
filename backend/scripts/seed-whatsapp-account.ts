/**
 * One-off dev bootstrap: store tenant WhatsApp credentials in connected_accounts.
 * Usage: npx tsx scripts/seed-whatsapp-account.ts [organizationId]
 */
import 'dotenv/config';
import { createCipheriv, randomBytes } from 'crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const PHONE_NUMBER_ID = process.env.WA_SEED_PHONE_NUMBER_ID;
const WABA_ID = process.env.WA_SEED_WABA_ID;
const ACCESS_TOKEN = process.env.WA_SEED_ACCESS_TOKEN;
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY;

function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = Buffer.from(keyBase64, 'base64');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

async function fetchPhoneProfile(phoneNumberId: string, accessToken: string) {
  const version = process.env.META_GRAPH_API_VERSION || 'v22.0';
  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}?fields=display_phone_number,verified_name`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) {
    return { displayPhoneNumber: undefined, verifiedName: 'Leadzen WhatsApp' };
  }
  const data = (await res.json()) as {
    display_phone_number?: string;
    verified_name?: string;
  };
  return {
    displayPhoneNumber: data.display_phone_number,
    verifiedName: data.verified_name || 'Leadzen WhatsApp',
  };
}

async function main() {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN || !ENCRYPTION_KEY) {
    console.error(
      'Set WA_SEED_PHONE_NUMBER_ID, WA_SEED_ACCESS_TOKEN, and TOKEN_ENCRYPTION_KEY',
    );
    process.exit(1);
  }

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  try {
    let organizationId: string | undefined = process.argv[2];
    if (!organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { user: { email: 'demo@leads.test' } },
        select: { organizationId: true },
      });
      organizationId =
        membership?.organizationId ??
        (
          await prisma.membership.findFirst({
            select: { organizationId: true },
          })
        )?.organizationId;
    }
    if (!organizationId) {
      console.error('No organization found');
      process.exit(1);
    }

    const profile = await fetchPhoneProfile(PHONE_NUMBER_ID, ACCESS_TOKEN);
    const credentials = {
      accessToken: ACCESS_TOKEN,
      phoneNumberId: PHONE_NUMBER_ID,
    };
    const metadata = {
      wabaId: WABA_ID || undefined,
      phoneNumber: profile.displayPhoneNumber,
      displayName: profile.verifiedName,
      graphApiVersion: process.env.META_GRAPH_API_VERSION || 'v22.0',
      connectedAt: new Date().toISOString(),
    };
    const encrypted = encryptSecret(JSON.stringify(credentials), ENCRYPTION_KEY);
    const label =
      profile.verifiedName || profile.displayPhoneNumber || 'WhatsApp';

    const existing = await prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: 'meta_whatsapp',
      },
    });

    const account = existing
      ? await prisma.connectedAccount.update({
          where: { id: existing.id },
          data: {
            label,
            externalAccountId: PHONE_NUMBER_ID,
            encryptedCredentials: encrypted,
            metadata,
            status: 'active',
          },
        })
      : await prisma.connectedAccount.create({
          data: {
            organizationId,
            provider: 'meta_whatsapp',
            label,
            externalAccountId: PHONE_NUMBER_ID,
            encryptedCredentials: encrypted,
            metadata,
            status: 'active',
          },
        });

    console.log(
      `WhatsApp connected for org ${organizationId} (account ${account.id})`,
    );
    console.log(`Phone: ${metadata.phoneNumber ?? PHONE_NUMBER_ID}`);
    console.log(`Display name: ${metadata.displayName}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
