import { URL } from 'url';

/**
 * Validates endpoint URLs for SSRF protection and security boundary enforcement.
 * Enforces HTTPS for remote services while allowing http://localhost or http://127.0.0.1
 * for local development runners (like Ollama, LocalAI, vLLM).
 */
export function validateCustomEndpoint(endpointUrl: string): { valid: boolean; error?: string; cleanUrl?: string } {
  if (!endpointUrl || typeof endpointUrl !== 'string') {
    return { valid: false, error: 'Endpoint URL is required' };
  }

  const trimmed = endpointUrl.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL: Must be a valid absolute HTTP or HTTPS URL' };
  }

  const protocol = parsed.protocol.toLowerCase();
  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port ? parseInt(parsed.port, 10) : (protocol === 'https:' ? 443 : 80);

  const isLocalhost =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]';

  // Remote endpoints MUST use HTTPS
  if (!isLocalhost && protocol !== 'https:') {
    return {
      valid: false,
      error: 'Security Policy: Remote endpoints must use HTTPS. Plain HTTP is only permitted for localhost/127.0.0.1',
    };
  }

  // Block Cloud Metadata Endpoints (AWS, GCP, Azure, OpenStack)
  const forbiddenHostnames = [
    '169.254.169.254',
    'metadata.google.internal',
    'metadata',
    'instance-data',
    '100.100.100.200', // Alibaba metadata
  ];

  if (forbiddenHostnames.includes(hostname) || hostname.startsWith('169.254.')) {
    return {
      valid: false,
      error: 'Security Policy: Access to cloud infrastructure metadata endpoints is strictly prohibited',
    };
  }

  // Block Private IP Ranges for non-localhost hosts
  if (!isLocalhost) {
    if (
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      isPrivate172(hostname)
    ) {
      return {
        valid: false,
        error: 'Security Policy: Direct access to private internal network IP ranges is prohibited',
      };
    }
  }

  // Block sensitive internal service ports
  const prohibitedPorts = [21, 22, 23, 25, 53, 110, 143, 3306, 5432, 6379, 9200, 11211, 27017];
  if (prohibitedPorts.includes(port)) {
    return {
      valid: false,
      error: `Security Policy: Access to internal service port ${port} is prohibited`,
    };
  }

  // Normalize: remove trailing slash
  const cleanUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '');
  return { valid: true, cleanUrl };
}

function isPrivate172(host: string): boolean {
  const parts = host.split('.');
  if (parts.length === 4 && parts[0] === '172') {
    const second = parseInt(parts[1], 10);
    return !isNaN(second) && second >= 16 && second <= 31;
  }
  return false;
}
