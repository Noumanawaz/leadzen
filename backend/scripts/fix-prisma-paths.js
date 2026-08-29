/**
 * SWC emits dist/* (no src/ prefix) but keeps import depths from src/.
 * Rewrite every require/import of generated/ to the correct path from each file
 * to dist/generated/ (idempotent — safe to run after every build).
 */
const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const generatedDir = path.join(distDir, 'generated');

function prefixToGenerated(fromFile) {
  let rel = path.relative(path.dirname(fromFile), generatedDir);
  rel = rel.split(path.sep).join('/');
  if (!rel.startsWith('.')) {
    rel = `./${rel}`;
  }
  return rel.endsWith('/') ? rel : `${rel}/`;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    const prefix = prefixToGenerated(full);
    const source = fs.readFileSync(full, 'utf8');
    const updated = source.replace(
      /(\.\.\/|\.\/)+generated\//g,
      prefix,
    );
    if (updated !== source) {
      fs.writeFileSync(full, updated);
    }
  }
}

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found');
  process.exit(1);
}
if (!fs.existsSync(generatedDir)) {
  console.error('dist/generated/ not found — run tsc -p tsconfig.prisma.json first');
  process.exit(1);
}
walk(distDir);
