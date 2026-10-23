/**
 * Docker Container Runner & Host Shell Fallback.
 * Part of Person 3's Terminal & Code Execution Module.
 * 
 * Provides isolated container execution when Docker is available,
 * and gracefully falls back to host pseudo-terminal (node-pty) with clear telemetry.
 */

import { execSync } from 'child_process';
import pty from 'node-pty';
import path from 'path';

export interface TerminalSpawnOptions {
  roomId: string;
  cols?: number;
  rows?: number;
  cwd?: string;
}

export interface TerminalProcess {
  pty: pty.IPty;
  isIsolated: boolean;
  shellType: string;
  cleanup?: () => void;
}

// Global flag to cache Docker availability check
let isDockerAvailableCache: boolean | null = null;

/**
 * Check if Docker daemon is installed and actively responsive
 */
export function checkDockerAvailability(): boolean {
  if (isDockerAvailableCache !== null) {
    return isDockerAvailableCache;
  }

  try {
    // Quick probe with short timeout
    execSync('docker info', { stdio: 'ignore', timeout: 3000 });
    isDockerAvailableCache = true;
    console.log('[DockerRunner] Docker daemon is available and running. Container isolation enabled.');
  } catch {
    isDockerAvailableCache = false;
    console.log('[DockerRunner] Docker daemon is not available. Falling back to host shell pty.');
  }

  return isDockerAvailableCache;
}

/**
 * Spawns an isolated terminal process using Docker or host shell fallback
 */
export function spawnTerminalProcess(options: TerminalSpawnOptions): TerminalProcess {
  const { roomId, cols = 80, rows = 24, cwd } = options;
  const useDocker = process.env.ENABLE_DOCKER_ISOLATION === 'true' && checkDockerAvailability();

  if (useDocker) {
    return spawnDockerContainer(roomId, cols, rows);
  } else {
    return spawnHostShell(cols, rows, cwd);
  }
}

/**
 * Spawns a host shell using node-pty
 */
function spawnHostShell(cols: number, rows: number, customCwd?: string): TerminalProcess {
  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : (process.env.SHELL || 'bash');
  const workingDir = customCwd || process.env.HOME || process.env.USERPROFILE || process.cwd();

  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  return {
    pty: ptyProcess,
    isIsolated: false,
    shellType: isWindows ? 'PowerShell (Host)' : `${path.basename(shell)} (Host)`,
  };
}

/**
 * Spawns a Docker container isolated shell using node-pty attaching to `docker run`
 */
function spawnDockerContainer(roomId: string, cols: number, rows: number): TerminalProcess {
  const containerName = `term_${roomId.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now()}`;
  const dockerImage = process.env.TERMINAL_DOCKER_IMAGE || 'alpine:latest';
  const memoryLimit = process.env.TERMINAL_MEMORY_LIMIT || '512m';
  const cpuLimit = process.env.TERMINAL_CPU_LIMIT || '1.0';

  // Command to run an isolated container with resource limits and interactive shell
  const dockerArgs = [
    'run',
    '--rm',
    '-it',
    '--name', containerName,
    '--memory', memoryLimit,
    '--cpus', cpuLimit,
    '--pids-limit', '64',
    '-e', 'TERM=xterm-256color',
    dockerImage,
    '/bin/sh',
  ];

  const ptyProcess = pty.spawn('docker', dockerArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.cwd(),
    env: {
      ...process.env,
      TERM: 'xterm-256color',
    },
  });

  const cleanup = () => {
    try {
      execSync(`docker rm -f ${containerName}`, { stdio: 'ignore', timeout: 3000 });
    } catch {
      // Ignore if container is already stopped/removed
    }
  };

  return {
    pty: ptyProcess,
    isIsolated: true,
    shellType: `Docker Container (${dockerImage})`,
    cleanup,
  };
}
