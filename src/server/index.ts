import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting Collaborative IDE servers...\n');

const yjsServer = spawn('npx', ['tsx', path.join(__dirname, 'server/yjs-server.ts')], {
  stdio: 'inherit',
  env: { ...process.env, Y_WEBSOCKET_PORT: '1234' },
});

const apiServer = spawn('npx', ['tsx', path.join(__dirname, 'server/api-server.ts')], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '3001' },
});

const viteDev = spawn('npx', ['vite'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
});

function shutdown() {
  console.log('\nShutting down servers...');
  yjsServer.kill();
  apiServer.kill();
  viteDev.kill();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

yjsServer.on('error', (err) => console.error('Yjs server error:', err));
apiServer.on('error', (err) => console.error('API server error:', err));
viteDev.on('error', (err) => console.error('Vite error:', err));

console.log('Servers starting...');
console.log('  Yjs WebSocket: ws://localhost:1234');
console.log('  API Server:    http://localhost:3001');
console.log('  Frontend:      http://localhost:5173\n');