#!/usr/bin/env node
/**
 * Dev server: generate Prisma client, rebuild Nest + Prisma on src changes, restart Node.
 * Prisma 7 emits TypeScript under generated/; Node needs compiled JS in dist/generated/.
 */
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const tsc = path.join(root, 'node_modules', '.bin', 'tsc');
const distMain = path.join(root, 'dist', 'main.js');
const srcDir = path.join(root, 'src');

function run(cmd, args) {
  execSync([cmd, ...args].join(' '), { cwd: root, stdio: 'inherit' });
}

function buildAll() {
  run('npx', ['nest', 'build']);
  run(tsc, ['-p', 'tsconfig.prisma.json']);
  run('node', ['scripts/fix-prisma-paths.js']);
}

let server;
function startServer() {
  if (server) {
    server.kill('SIGTERM');
  }
  server = spawn('node', ['dist/main.js'], {
    cwd: root,
    stdio: 'inherit',
  });
  server.on('exit', (code, signal) => {
    if (signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.log(`Server exited (code ${code ?? 'null'}, signal ${signal ?? 'null'})`);
    }
  });
}

console.log('Generating Prisma client…');
run('npx', ['prisma', 'generate']);

console.log('Building…');
buildAll();
startServer();

let debounce;
let building = false;

function scheduleRebuild() {
  clearTimeout(debounce);
  debounce = setTimeout(async () => {
    if (building) return;
    building = true;
    try {
      console.log('\nRebuilding…');
      buildAll();
      startServer();
    } catch (err) {
      console.error('Rebuild failed:', err.message ?? err);
    } finally {
      building = false;
    }
  }, 300);
}

try {
  fs.watch(srcDir, { recursive: true }, (_, file) => {
    if (typeof file === 'string' && file.endsWith('.ts')) {
      scheduleRebuild();
    }
  });
  console.log('Watching src/ for changes…');
} catch {
  console.warn('Recursive watch unavailable; polling dist/main.js instead.');
  let lastMtime = fs.statSync(distMain).mtimeMs;
  setInterval(() => {
    if (!fs.existsSync(distMain)) return;
    const mtime = fs.statSync(distMain).mtimeMs;
    if (mtime !== lastMtime) {
      lastMtime = mtime;
      scheduleRebuild();
    }
  }, 1000);
}

function shutdown() {
  if (server) server.kill('SIGTERM');
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
