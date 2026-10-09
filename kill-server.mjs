// Kill script for server restart
import { execSync } from 'child_process';

try {
  // Try to kill by port using lsof
  execSync('lsof -ti :3009 | xargs kill -9 2>/dev/null', { stdio: 'ignore' });
  console.log('Killed server on port 3009');
} catch (e) {
  console.log('Port kill failed, trying PID...');
}

try {
  // Try direct PID kill
  execSync('kill -9 75835 2>/dev/null', { stdio: 'ignore' });
  console.log('Killed PID 75835');
} catch (e) {
  console.log('PID kill failed');
}

console.log('Done');
