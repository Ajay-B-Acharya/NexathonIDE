import { spawn, type ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

try {
  process.loadEnvFile();
} catch {}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Root directory of the NexathonIDE project (two levels up from src/server)
const projectRoot = path.resolve(__dirname, '../..');

console.log('Starting Collaborative IDE servers...\n');

const isWindows = process.platform === 'win32';
const npxCmd = isWindows ? 'npx.cmd' : 'npx';
const nodeBin = process.execPath;
const localTsx = path.resolve(projectRoot, 'node_modules/tsx/dist/cli.mjs');
const localVite = path.resolve(projectRoot, 'node_modules/vite/bin/vite.js');

const yjsScript = path.resolve(projectRoot, 'collaboration-backend/server.ts');
const apiScript = path.resolve(__dirname, 'api-server.ts');

function spawnProcess(
  title: string,
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv
): ChildProcess {
  // Use direct Node execution of local CLI when available to avoid Windows cmd/shell issues
  const proc = spawn(command, args, {
    stdio: 'inherit',
    cwd,
    env,
    shell: !fs.existsSync(command) && isWindows,
  });

  proc.on('error', (err) => {
    console.error(`[Orchestrator] ${title} process error:`, err.message);
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.warn(`[Orchestrator] ${title} exited with code ${code}`);
    }
  });

  return proc;
}

// 1. Yjs Collaboration Server
const yjsCmd = fs.existsSync(localTsx) ? nodeBin : npxCmd;
const yjsArgs = fs.existsSync(localTsx) ? [localTsx, yjsScript] : ['tsx', yjsScript];
const yjsServer = spawnProcess(
  'Yjs Server',
  yjsCmd,
  yjsArgs,
  projectRoot,
  { ...process.env, Y_WEBSOCKET_PORT: process.env.Y_WEBSOCKET_PORT || '1234' }
);

// 2. API Server
const apiCmd = fs.existsSync(localTsx) ? nodeBin : npxCmd;
const apiArgs = fs.existsSync(localTsx) ? [localTsx, apiScript] : ['tsx', apiScript];
const apiServer = spawnProcess(
  'API Server',
  apiCmd,
  apiArgs,
  projectRoot,
  { ...process.env, PORT: process.env.PORT || '3001' }
);

// 3. Vite Frontend Dev Server
const viteCmd = fs.existsSync(localVite) ? nodeBin : npxCmd;
const viteArgs = fs.existsSync(localVite) ? [localVite] : ['vite'];
const viteDev = spawnProcess(
  'Vite Frontend',
  viteCmd,
  viteArgs,
  projectRoot,
  process.env
);

let isShuttingDown = false;
function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n[Orchestrator] Shutting down servers...');

  try { yjsServer.kill('SIGINT'); } catch {}
  try { apiServer.kill('SIGINT'); } catch {}
  try { viteDev.kill('SIGINT'); } catch {}

  setTimeout(() => {
    process.exit(0);
  }, 500);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('Servers starting...');
console.log(`  Yjs WebSocket: ws://localhost:${process.env.Y_WEBSOCKET_PORT || '1234'}`);
console.log(`  API Server:    http://localhost:${process.env.PORT || '3001'}`);
console.log('  Frontend:      http://localhost:5173\n');
