import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

try {
  process.loadEnvFile();
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('Starting Collaborative IDE servers...\n');

const yjsServer = spawn(`npx tsx "${path.join(__dirname, 'yjs-server.ts')}"`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, Y_WEBSOCKET_PORT: process.env.Y_WEBSOCKET_PORT || '1234' },
});

const apiServer = spawn(`npx tsx "${path.join(__dirname, 'api-server.ts')}"`, {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: process.env.PORT || '3001' },
});

const viteDev = spawn('npx vite', {
  stdio: 'inherit',
  shell: true,
  cwd: rootDir,
});

function shutdown() {
  console.log('\nShutting down servers...');
  try { yjsServer.kill(); } catch {}
  try { apiServer.kill(); } catch {}
  try { viteDev.kill(); } catch {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

yjsServer.on('error', (err) => console.error('Yjs server error:', err));
apiServer.on('error', (err) => console.error('API server error:', err));
viteDev.on('error', (err) => console.error('Vite error:', err));

console.log('Servers starting...');
console.log(`  Yjs WebSocket: ws://localhost:${process.env.Y_WEBSOCKET_PORT || '1234'}`);
console.log(`  API Server:    http://localhost:${process.env.PORT || '3001'}`);
console.log('  Frontend:      http://localhost:5173\n');
