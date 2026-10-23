/**
 * Browser-based Python execution runner powered by Pyodide.
 * Part of Person 3's Code Execution Module.
 */

import { formatExecutionResult, type FormattedExecutionResult } from './executionOutput';

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

const PYODIDE_CDN_VERSION = 'v0.26.2';
const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_CDN_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_INDEX_URL}pyodide.js`;

/**
 * Dynamically load the Pyodide runtime script tag if not already loaded in the DOM.
 */
function loadPyodideScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Browser environment required for Pyodide'));
  }

  if ((window as any).loadPyodide) {
    return Promise.resolve();
  }

  const existingScript = document.querySelector(`script[src*="pyodide"]`);
  if (existingScript) {
    return new Promise((resolve, reject) => {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Pyodide script')));
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = PYODIDE_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load Pyodide from ${PYODIDE_SCRIPT_URL}`));
    document.head.appendChild(script);
  });
}

/**
 * Initialize Pyodide singleton instance.
 */
export async function getPyodide(onProgress?: (status: string) => void): Promise<any> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  if (pyodideLoadingPromise) {
    return pyodideLoadingPromise;
  }

  pyodideLoadingPromise = (async () => {
    try {
      onProgress?.('Fetching Pyodide runtime script...');
      await loadPyodideScript();

      if (!(window as any).loadPyodide) {
        throw new Error('window.loadPyodide is not defined after script load');
      }

      onProgress?.('Initializing WebAssembly Python kernel...');
      const pyodide = await (window as any).loadPyodide({
        indexURL: PYODIDE_INDEX_URL,
      });

      // Warm up standard io and traceback modules
      await pyodide.runPythonAsync(`
import sys
import io
import traceback
print("Python runtime initialized successfully.")
`);

      pyodideInstance = pyodide;
      onProgress?.('Python runtime ready.');
      return pyodide;
    } catch (err) {
      pyodideLoadingPromise = null;
      throw err;
    }
  })();

  return pyodideLoadingPromise;
}

/**
 * Check if Pyodide is currently initialized and ready
 */
export function isPyodideReady(): boolean {
  return pyodideInstance !== null;
}

export interface PythonExecutionOptions {
  timeoutMs?: number;
  onProgress?: (status: string) => void;
}

/**
 * Safely execute Python code in the browser with stdout/stderr capture and timeout protection.
 */
export async function executePythonCode(
  code: string,
  options: PythonExecutionOptions = {}
): Promise<FormattedExecutionResult> {
  const { timeoutMs = 15000, onProgress } = options;
  const startTime = performance.now();

  const pyodide = await getPyodide(onProgress);

  // Set code safely into pyodide globals dictionary without string interpolation vulnerabilities
  pyodide.globals.set('__user_code_to_exec__', code);

  const runnerScript = `
import sys
import io
import traceback

__stdout_buffer__ = io.StringIO()
__stderr_buffer__ = io.StringIO()
__error_occurred__ = False

_old_stdout = sys.stdout
_old_stderr = sys.stderr
sys.stdout = __stdout_buffer__
sys.stderr = __stderr_buffer__

try:
    # Run in global namespace
    exec(__user_code_to_exec__, globals())
except Exception:
    __error_occurred__ = True
    traceback.print_exc(file=__stderr_buffer__)
finally:
    sys.stdout = _old_stdout
    sys.stderr = _old_stderr

__captured_stdout__ = __stdout_buffer__.getvalue()
__captured_stderr__ = __stderr_buffer__.getvalue()
`;

  let timeoutId: any = null;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        reject(new Error(`Execution timed out after ${timeoutMs / 1000} seconds.`));
      }, timeoutMs);
    }
  });

  try {
    await Promise.race([pyodide.runPythonAsync(runnerScript), timeoutPromise]);

    const stdout = pyodide.globals.get('__captured_stdout__') || '';
    const stderr = pyodide.globals.get('__captured_stderr__') || '';
    const executionTime = performance.now() - startTime;

    return formatExecutionResult({
      stdout: String(stdout),
      stderr: String(stderr),
      executionTime,
      timeoutOccurred: false,
    });
  } catch (err: any) {
    const executionTime = performance.now() - startTime;

    if (timedOut) {
      return formatExecutionResult({
        stdout: '',
        stderr: `TimeoutError: Execution exceeded limit of ${timeoutMs / 1000}s. Avoid infinite loops or intensive blocking operations in the browser.`,
        executionTime,
        timeoutOccurred: true,
      });
    }

    const message = err?.message || String(err);
    return formatExecutionResult({
      stdout: '',
      stderr: `Runtime Error: ${message}`,
      executionTime,
      timeoutOccurred: false,
    });
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    // Cleanup temporary globals
    try {
      pyodide.runPython(`
for var_name in ['__user_code_to_exec__', '__captured_stdout__', '__captured_stderr__', '__stdout_buffer__', '__stderr_buffer__']:
    if var_name in globals():
        del globals()[var_name]
`);
    } catch {
      // ignore cleanup errors
    }
  }
}
