#!/usr/bin/env node
/**
 * Production start: run migrations (with Neon cold-start retries), then boot API.
 */
const { spawn, execSync } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const maxAttempts = 8;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertDatabaseEnv() {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL || '';
  if (!url) {
    console.error(
      'DATABASE_URL (and DIRECT_URL for Neon migrations) must be set.',
    );
    process.exit(1);
  }
  if (url.includes('ep-xxxx.') || url.includes('USER:PASSWORD')) {
    console.error(
      'Database URL looks like a placeholder. Set real Neon credentials in Render env vars.',
    );
    process.exit(1);
  }
}

async function migrateDeploy() {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Running prisma migrate deploy (attempt ${attempt}/${maxAttempts})…`);
      execSync('npx prisma migrate deploy', {
        cwd: root,
        stdio: 'inherit',
        env: process.env,
      });
      console.log('Migrations applied.');
      return;
    } catch {
      if (attempt === maxAttempts) {
        console.error('Migration failed after all retries.');
        process.exit(1);
      }
      const delayMs = Math.min(attempt * 3000, 15000);
      console.warn(`Database not reachable yet, retrying in ${delayMs / 1000}s…`);
      await sleep(delayMs);
    }
  }
}

async function main() {
  assertDatabaseEnv();
  await migrateDeploy();

  const server = spawn('node', ['dist/main.js'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });

  server.on('exit', (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });

  process.on('SIGTERM', () => server.kill('SIGTERM'));
  process.on('SIGINT', () => server.kill('SIGINT'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
