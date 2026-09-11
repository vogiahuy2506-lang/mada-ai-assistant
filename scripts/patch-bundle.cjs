/**
 * Post-build patch for server.mjs
 * Fixes cheerio's ESM wrapper dynamic require error in Node.js ESM context
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'dist', 'server.cjs');
const content = fs.readFileSync(filePath, 'utf8');

let patched = content;

// Patch cheerio's ESM wrapper error (exact format from cheerio 1.2.0)
// Original: throw Error('Dynamic require of "'+n+'" is not supported')
const pattern = /throw Error\('Dynamic require of "'\+n\+'"\s*is not supported'\)/g;
if (pattern.test(patched)) {
  patched = patched.replace(pattern, "console.warn('[cheerio] Dynamic require:', n); return null;");
  console.log('✅ Patched cheerio ESM wrapper');
}

if (patched !== content) {
  fs.writeFileSync(filePath, patched);
  console.log('✅ Bundle patched and saved');
} else {
  console.log('ℹ️ No patch needed');
}
