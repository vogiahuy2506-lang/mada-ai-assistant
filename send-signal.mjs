// Signal sender script
const pid = parseInt(process.argv[2] || '23005');
const signal = process.argv[3] || 'SIGUSR1';

try {
  process.kill(pid, signal);
  console.log(`Sent ${signal} to PID ${pid}`);
} catch (e) {
  console.error(`Failed to send ${signal} to PID ${pid}:`, e.message);
}
