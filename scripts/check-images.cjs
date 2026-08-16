// Script check tất cả ảnh trong seed-products.ts
const https = require('https');
const http = require('http');
const fs = require('fs');

const IMAGE_PATTERNS = /https?:\/\/cdn\.at\.mada\.org\.qa[^\s'"]+\.(png|jpg|jpeg|gif|webp)/g;

const fileContent = fs.readFileSync('./server/lib/data/seed-products.ts', 'utf8');
const images = [...new Set(fileContent.match(IMAGE_PATTERNS) || [])];

console.log(`Checking ${images.length} images...\n`);

let broken = [];

function checkImage(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 10000 }, (res) => {
      resolve({ url, status: res.statusCode, ok: res.statusCode === 200 });
    });
    req.on('error', (e) => {
      resolve({ url, status: 'ERROR', ok: false, error: e.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ url, status: 'TIMEOUT', ok: false });
    });
  });
}

async function main() {
  for (const url of images) {
    const result = await checkImage(url);
    const status = result.ok ? '✅ OK' : '❌ BROKEN';
    console.log(`${status} ${result.status} - ${url}`);
    if (!result.ok) {
      broken.push({ url, status: result.status });
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total: ${images.length}`);
  console.log(`Working: ${images.length - broken.length}`);
  console.log(`Broken: ${broken.length}`);

  if (broken.length > 0) {
    console.log(`\n=== BROKEN IMAGES ===`);
    broken.forEach(b => {
      console.log(`  ${b.url}`);
    });

    // Extract broken URLs for fixing
    console.log(`\n=== URLs TO FIX ===`);
    broken.forEach(b => {
      console.log(`"${b.url}",`);
    });
  }
}

main().catch(console.error);
