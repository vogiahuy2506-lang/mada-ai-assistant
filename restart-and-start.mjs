// Kill and restart server
import { execSync, spawn } from 'child_process';

console.log('Step 1: Killing all node processes related to server...');
try {
  execSync('lsof -ti :3002 | xargs kill -9 2>/dev/null', { stdio: 'ignore' });
  console.log('Killed processes on port 3002');
} catch {
  console.log('Port kill failed');
}

console.log('Step 2: Waiting for port to be released...');
execSync('sleep 2');

console.log('Step 3: Starting server...');
const server = spawn('npm', ['run', 'server'], {
  cwd: '/Users/vohuy/Downloads/MADA AI ASSISTANT/mada-ai-assistant',
  detached: true,
  stdio: 'inherit'
});

server.unref();
console.log('Server started in background');
