/**
 * Centralized, Environment-Aware Network & Endpoint Configuration
 *
 * Resolves API, WebSocket, and collaboration endpoints dynamically based on the current
 * runtime context (Local development, LAN testing, Reverse Proxy, or Public Deployment).
 */

export interface EndpointConfig {
  apiBaseUrl: string;
  yjsWsUrl: string;
  terminalWsUrl: string;
  origin: string;
  hostname: string;
  isSecure: boolean;
  isLocalhost: boolean;
  isLan: boolean;
}

/**
 * Determines whether a given hostname represents a local loopback interface.
 */
export function isLoopbackAddress(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.startsWith('127.')
  );
}

/**
 * Determines whether a given hostname represents a private local area network (LAN) address.
 */
export function isLanAddress(hostname: string): boolean {
  return (
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/**
 * Derives the active API base URL.
 * Prefers explicitly configured non-localhost VITE_API_URL if provided.
 * In browser environments, defaults to same-origin relative `/api` to route
 * seamlessly through Vite dev proxy or production reverse proxies without CORS issues.
 */
export function getApiBaseUrl(): string {
  const envApiUrl = import.meta.env.VITE_API_URL as string | undefined;

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isRemoteClient = !isLoopbackAddress(hostname);

    // If an environment variable is set to literal localhost but client is accessing from a remote device,
    // we must not try to connect to the remote device's own localhost.
    if (envApiUrl && (!isRemoteClient || !envApiUrl.includes('localhost'))) {
      return envApiUrl.endsWith('/api') ? envApiUrl : `${envApiUrl.replace(/\/+$/, '')}/api`;
    }

    // Default: use relative /api which Vite dev proxy and reverse proxies handle cleanly
    return '/api';
  }

  // Fallback for SSR or Node.js test environments
  return envApiUrl || 'http://localhost:3001/api';
}

/**
 * Derives the active Yjs WebSocket URL for collaboration sessions.
 * 
 * Supports:
 * 1. Dedicated remote WebSocket endpoint via VITE_YJS_WS_URL.
 * 2. LAN / Cross-device connections via host address (e.g. `ws://192.168.1.104:1234`).
 * 3. Proxied WebSocket path through frontend port (e.g. `ws://hostname:5173/yjs` or `wss://domain.com/yjs`).
 */
export function getYjsWsUrl(preferDirectPort: boolean = true): string {
  const envWsUrl = import.meta.env.VITE_YJS_WS_URL as string | undefined;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, host } = window.location;
    const isSecure = protocol === 'https:';
    const wsProto = isSecure ? 'wss:' : 'ws:';
    const isRemote = !isLoopbackAddress(hostname);

    // If explicit env URL was provided and is not a trap for remote clients:
    if (envWsUrl && (!isRemote || !envWsUrl.includes('localhost'))) {
      return envWsUrl.replace(/\/+$/, '');
    }

    // Direct port connection: connect to the host computer's port 1234
    if (preferDirectPort) {
      return `${wsProto}//${hostname}:1234`;
    }

    // Proxied connection through frontend web server (e.g. Vite proxy or Nginx)
    return `${wsProto}//${host}/yjs`;
  }

  return envWsUrl || 'ws://localhost:1234';
}

/**
 * Derives the collaborative Terminal WebSocket URL.
 */
export function getTerminalWsUrl(): string {
  const envTerminalUrl = import.meta.env.VITE_TERMINAL_WS_URL as string | undefined;

  if (typeof window !== 'undefined') {
    const { protocol, hostname, host } = window.location;
    const isSecure = protocol === 'https:';
    const wsProto = isSecure ? 'wss:' : 'ws:';
    const isRemote = !isLoopbackAddress(hostname);

    if (envTerminalUrl && (!isRemote || !envTerminalUrl.includes('localhost'))) {
      return envTerminalUrl;
    }

    // Prefer same-origin proxied /ws/terminal via Vite or reverse proxy
    return `${wsProto}//${host}/ws/terminal`;
  }

  return envTerminalUrl || 'ws://localhost:3001/ws/terminal';
}

/**
 * Returns a comprehensive diagnostics snapshot of resolved network endpoints.
 */
export function getEndpointDiagnostics(): EndpointConfig {
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : 'localhost';
  const origin = isBrowser ? window.location.origin : 'http://localhost:5173';
  const isSecure = isBrowser ? window.location.protocol === 'https:' : false;

  return {
    apiBaseUrl: getApiBaseUrl(),
    yjsWsUrl: getYjsWsUrl(),
    terminalWsUrl: getTerminalWsUrl(),
    origin,
    hostname,
    isSecure,
    isLocalhost: isLoopbackAddress(hostname),
    isLan: isLanAddress(hostname),
  };
}
