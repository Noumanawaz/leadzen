/**
 * SWC emits dist/* (no src/ prefix). Adjust Prisma import depths for runtime.
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith('.js')) continue;

    const source = fs.readFileSync(full, 'utf8');
    const updated = source.replace(
      /(\.\.\/)+generated\//g,
      (match) => {
        const parts = match.match(/\.\.\//g) ?? [];
        if (parts.length <= 1) return match;
        return `${parts.slice(1).join('')}generated/`;
      },
    );
    if (updated !== source) {
      fs.writeFileSync(full, updated);
    }
  }
}

const distDir = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distDir)) {
  console.error('dist/ not found');
  process.exit(1);
}
walk(distDir);
