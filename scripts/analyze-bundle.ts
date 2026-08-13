/**
 * MADA AI - Bundle Size Analyzer
 *
 * Analyze bundle size and generate report
 * Run: npx tsx scripts/analyze-bundle.ts
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BUILD_DIR = path.join(process.cwd(), 'dist');
const REPORT_FILE = path.join(process.cwd(), 'bundle-report.md');

interface BundleFile {
  name: string;
  size: number;
  sizeFormatted: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function analyzeChunks(dir: string): BundleFile[] {
  const files: BundleFile[] = [];

  if (!fs.existsSync(dir)) {
    console.error('Build directory not found. Run "npm run build" first.');
    process.exit(1);
  }

  function walkDirectory(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (entry.isFile() && /\.(js|css)$/.test(entry.name)) {
        const stats = fs.statSync(fullPath);
        const relativePath = path.relative(process.cwd(), fullPath);

        files.push({
          name: relativePath,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
        });
      }
    }
  }

  walkDirectory(dir);
  return files.sort((a, b) => b.size - a.size);
}

function generateReport(files: BundleFile[]): string {
  const totalSize = files.reduce((acc, f) => acc + f.size, 0);
  const jsFiles = files.filter(f => f.name.endsWith('.js'));
  const cssFiles = files.filter(f => f.name.endsWith('.css'));

  const jsTotal = jsFiles.reduce((acc, f) => acc + f.size, 0);
  const cssTotal = cssFiles.reduce((acc, f) => acc + f.size, 0);

  let report = `# Bundle Size Report\n\n`;
  report += `Generated: ${new Date().toISOString()}\n\n`;

  report += `## Summary\n\n`;
  report += `| Metric | Value |\n`;
  report += `|--------|-------|\n`;
  report += `| Total Files | ${files.length} |\n`;
  report += `| Total Size | ${formatBytes(totalSize)} |\n`;
  report += `| JS Files | ${jsFiles.length} (${formatBytes(jsTotal)}) |\n`;
  report += `| CSS Files | ${cssFiles.length} (${formatBytes(cssTotal)}) |\n\n`;

  // Performance thresholds
  const thresholds = {
    js: 500 * 1024, // 500KB
    css: 100 * 1024, // 100KB
    total: 1024 * 1024, // 1MB
  };

  report += `## Performance Thresholds\n\n`;
  report += `| Asset | Threshold | Actual | Status |\n`;
  report += `|-------|----------|--------|--------|\n`;
  report += `| Total JS | ${formatBytes(thresholds.js)} | ${formatBytes(jsTotal)} | ${jsTotal <= thresholds.js ? '✅ Pass' : '❌ Fail'} |\n`;
  report += `| Total CSS | ${formatBytes(thresholds.css)} | ${formatBytes(cssTotal)} | ${cssTotal <= thresholds.css ? '✅ Pass' : '❌ Fail'} |\n`;
  report += `| Total | ${formatBytes(thresholds.total)} | ${formatBytes(totalSize)} | ${totalSize <= thresholds.total ? '✅ Pass' : '❌ Fail'} |\n\n`;

  report += `## Top 20 Largest Files\n\n`;
  report += `| # | File | Size |\n`;
  report += `|---|------|------|\n`;

  files.slice(0, 20).forEach((f, i) => {
    report += `| ${i + 1} | \`${f.name}\` | ${f.sizeFormatted} |\n`;
  });

  report += `\n## Recommendations\n\n`;

  if (jsTotal > thresholds.js) {
    report += `- ⚠️ JS bundle is larger than recommended. Consider:\n`;
    report += `  - Code splitting for routes\n`;
    report += `  - Lazy loading heavy components\n`;
    report += `  - Tree-shaking unused code\n`;
  } else {
    report += `- ✅ JS bundle size is acceptable\n`;
  }

  if (cssTotal > thresholds.css) {
    report += `- ⚠️ CSS bundle is larger than recommended. Consider:\n`;
    report += `  - Purging unused Tailwind classes\n`;
    report += `  - Splitting CSS by route\n`;
  } else {
    report += `- ✅ CSS bundle size is acceptable\n`;
  }

  return report;
}

async function main() {
  console.log('\n📊 MADA AI - Bundle Size Analyzer\n');
  console.log('🔨 Running build...\n');

  try {
    execSync('npm run build', { stdio: 'inherit' });
  } catch (error) {
    console.error('Build failed. Please fix errors before analyzing.');
    process.exit(1);
  }

  console.log('\n📦 Analyzing bundle...\n');

  const files = analyzeChunks(BUILD_DIR);
  const report = generateReport(files);

  console.log(report);

  // Save report
  fs.writeFileSync(REPORT_FILE, report);
  console.log(`\n📄 Report saved to: ${REPORT_FILE}\n`);
}

main();
