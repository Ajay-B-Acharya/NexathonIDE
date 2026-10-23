import { ExecutionResult, SupportedLanguage } from '../types';

interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (options: { batched: (msg: string) => void }) => void;
  setStderr: (options: { batched: (msg: string) => void }) => void;
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

class InBrowserExecutionClient {
  private pyodidePromise: Promise<PyodideInterface> | null = null;

  private async getPyodide(): Promise<PyodideInterface> {
    if (this.pyodidePromise) {
      return this.pyodidePromise;
    }

    this.pyodidePromise = new Promise<PyodideInterface>((resolve, reject) => {
      const initRuntime = async () => {
        try {
          if (!window.loadPyodide) {
            throw new Error('Pyodide script failed to initialize.');
          }
          const pyodide = await window.loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
          });
          resolve(pyodide);
        } catch (err) {
          this.pyodidePromise = null;
          reject(err);
        }
      };

      if (window.loadPyodide) {
        void initRuntime();
        return;
      }

      const existingScript = document.querySelector('script[data-pyodide]');
      if (existingScript) {
        existingScript.addEventListener('load', () => void initRuntime());
        existingScript.addEventListener('error', () =>
          reject(new Error('Failed to load Pyodide runtime from CDN'))
        );
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
      script.async = true;
      script.setAttribute('data-pyodide', 'true');
      script.onload = () => void initRuntime();
      script.onerror = () => {
        this.pyodidePromise = null;
        reject(new Error('Failed to load Pyodide runtime script.'));
      };
      document.head.appendChild(script);
    });

    return this.pyodidePromise;
  }

  public async executeCode(
    code: string,
    language: SupportedLanguage
  ): Promise<ExecutionResult> {
    const startTime = performance.now();

    if (language === 'python') {
      return this.runPython(code, startTime);
    }

    if (language === 'javascript' || language === 'typescript') {
      return this.runQuickJSOrSandbox(code, language, startTime);
    }

    return {
      stdout: '',
      stderr: `In-browser execution is supported for Python (Pyodide) and JavaScript/TypeScript (QuickJS sandbox). Current file language: "${language}".`,
      exitCode: 1,
      executionTimeMs: Math.round(performance.now() - startTime),
      language,
      timestamp: new Date().toISOString(),
    };
  }

  private async runPython(code: string, startTime: number): Promise<ExecutionResult> {
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];

    try {
      const pyodide = await this.getPyodide();
      pyodide.setStdout({ batched: (str: string) => stdoutLines.push(str) });
      pyodide.setStderr({ batched: (str: string) => stderrLines.push(str) });

      const result = await pyodide.runPythonAsync(code);
      if (result !== undefined && result !== null && stdoutLines.length === 0) {
        stdoutLines.push(String(result));
      }

      return {
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n'),
        exitCode: stderrLines.length > 0 ? 1 : 0,
        executionTimeMs: Math.round(performance.now() - startTime),
        language: 'python',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      stderrLines.push(errMsg);
      return {
        stdout: stdoutLines.join('\n'),
        stderr: stderrLines.join('\n'),
        exitCode: 1,
        executionTimeMs: Math.round(performance.now() - startTime),
        language: 'python',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Runs JS/TS in an isolated Worker sandbox (QuickJS-compatible isolated runtime)
   * with console capture and execution timeout protection.
   */
  private async runQuickJSOrSandbox(
    code: string,
    language: SupportedLanguage,
    startTime: number
  ): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const workerScript = `
        self.onmessage = async function(e) {
          const { code } = e.data;
          const stdout = [];
          const stderr = [];

          const formatArg = (arg) => {
            if (typeof arg === 'object' && arg !== null) {
              try { return JSON.stringify(arg, null, 2); } catch { return String(arg); }
            }
            return String(arg);
          };

          const customConsole = {
            log: (...args) => stdout.push(args.map(formatArg).join(' ')),
            info: (...args) => stdout.push(args.map(formatArg).join(' ')),
            warn: (...args) => stdout.push('[WARN] ' + args.map(formatArg).join(' ')),
            error: (...args) => stderr.push(args.map(formatArg).join(' ')),
          };

          try {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = new AsyncFunction('console', code);
            const returnVal = await fn(customConsole);
            if (returnVal !== undefined && stdout.length === 0) {
              stdout.push(formatArg(returnVal));
            }
            self.postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n'), exitCode: stderr.length > 0 ? 1 : 0 });
          } catch (err) {
            const message = err && err.stack ? err.stack : String(err);
            stderr.push(message);
            self.postMessage({ stdout: stdout.join('\\n'), stderr: stderr.join('\\n'), exitCode: 1 });
          }
        };
      `;

      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const timeoutId = window.setTimeout(() => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          stdout: '',
          stderr: 'ExecutionTimedOutError: Code execution exceeded 10,000ms limit.',
          exitCode: 124,
          executionTimeMs: Math.round(performance.now() - startTime),
          language,
          timestamp: new Date().toISOString(),
        });
      }, 10000);

      worker.onmessage = (
        event: MessageEvent<{ stdout: string; stderr: string; exitCode: number }>
      ) => {
        window.clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          stdout: event.data.stdout,
          stderr: event.data.stderr,
          exitCode: event.data.exitCode,
          executionTimeMs: Math.round(performance.now() - startTime),
          language,
          timestamp: new Date().toISOString(),
        });
      };

      worker.onerror = (err) => {
        window.clearTimeout(timeoutId);
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve({
          stdout: '',
          stderr: err.message || 'Worker runtime error',
          exitCode: 1,
          executionTimeMs: Math.round(performance.now() - startTime),
          language,
          timestamp: new Date().toISOString(),
        });
      };

      worker.postMessage({ code });
    });
  }
}

export const executionClient = new InBrowserExecutionClient();

