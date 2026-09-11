/**
 * Worker process cho scraping - chạy riêng để tránh lỗi ESM
 */
import { spawn } from 'child_process';

// __dirname is available globally in CJS

async function runScraper(script: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [script, ...args], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Process exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}

// CLI interface
const script = process.argv[2];
const args = process.argv.slice(3);

if (script && args.length > 0) {
  runScraper(script, args)
    .then(console.log)
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}

export { runScraper };
