import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required (Neon pooled URL)'),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).default('dev-access-secret-change-me-32chars'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-change-me-32ch'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ADMIN_EMAIL_ALLOWLIST: z.string().default(''),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional().default(''),
  STRIPE_PUBLISHABLE_KEY: z.string().optional().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().optional().default(''),
  STRIPE_GRACE_PERIOD_DAYS: z.coerce.number().int().nonnegative().default(3),
  GOOGLE_CLIENT_ID: z.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(''),
  GOOGLE_REDIRECT_URI: z
    .string()
    .optional()
    .default('http://localhost:4000/api/v1/integrations/gmail/callback'),
  GROQ_API_KEY: z.string().optional().default(''),
  GROQ_MODEL: z.string().optional().default('openai/gpt-oss-20b'),
  GOOGLE_PLACES_API_KEY: z.string().optional().default(''),
  GOOGLE_PLACES_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true')
    .default(true),
  META_APP_ID: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  META_EMBEDDED_SIGNUP_CONFIG_ID: z.string().optional().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  META_GRAPH_API_VERSION: z.string().optional().default('v22.0'),
  META_SYSTEM_USER_TOKEN: z.string().optional().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  SENTRY_DSN: z.string().optional().default(''),
  OTEL_ENABLED: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => v === true || v === 'true')
    .default(false),
  DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }
  return parsed.data;
}

export const ENV_KEYS = {
  databaseUrl: 'DATABASE_URL',
  directUrl: 'DIRECT_URL',
  redisUrl: 'REDIS_URL',
  adminAllowlist: 'ADMIN_EMAIL_ALLOWLIST',
} as const;
