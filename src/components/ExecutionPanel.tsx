import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Terminal, Loader2, CheckCircle2, AlertCircle, Copy, Check, Clock, Trash2 } from 'lucide-react';
import type { ExecutionResult } from '../types';
import { executePythonCode, getPyodide, isPyodideReady } from '../execution/pythonRunner';
import { formatExecutionResult } from '../execution/executionOutput';

interface ExecutionPanelProps {
  file: { path: string; content: string; language: string } | null;
  onExecutionComplete?: (result: ExecutionResult) => void;
}

export function ExecutionPanel({ file, onExecutionComplete }: ExecutionPanelProps) {
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [pyodideStatus, setPyodideStatus] = useState<string>('idle');
  const [copied, setCopied] = useState(false);
  const quickJSRef = useRef<any>(null);

  // Pre-load runtimes
  useEffect(() => {
    // Warm up Pyodide in background
    getPyodide((status) => setPyodideStatus(status))
      .then(() => setPyodideStatus('ready'))
      .catch((err) => {
        console.warn('Pyodide preload notice:', err);
        setPyodideStatus('ready'); // will retry on click
      });

    // Warm up QuickJS for JavaScript/TypeScript execution
    const initQuickJS = async () => {
      try {
        const QuickJS = await import('quickjs-emscripten');
        const module = await QuickJS.newQuickJSAsyncWASMModule();
        quickJSRef.current = module;
      } catch (err) {
        console.warn('QuickJS failed to load:', err);
      }
    };

    initQuickJS();
  }, []);

  // QuickJS JavaScript executor
  const executeJavaScript = useCallback(async (code: string): Promise<ExecutionResult> => {
    if (!quickJSRef.current) {
      throw new Error('QuickJS JavaScript engine is initializing, please try again in a moment.');
    }

    const module = quickJSRef.current;
    let stdout = '';
    let stderr = '';
    const startTime = performance.now();

    const consoleLog = module.newFunction((...args: any[]) => {
      stdout += args.map(a => String(a)).join(' ') + '\n';
    });

    const consoleError = module.newFunction((...args: any[]) => {
      stderr += args.map(a => String(a)).join(' ') + '\n';
    });

    const global = module.global;
    global.setProp('console', module.newObject({
      log: consoleLog,
      error: consoleError,
      warn: consoleLog,
      info: consoleLog,
    }));

    try {
      module.evalCode(code);
    } catch (err) {
      stderr += String(err) + '\n';
    } finally {
      consoleLog.dispose();
      consoleError.dispose();
    }

    const duration = performance.now() - startTime;
    const formatted = formatExecutionResult({
      stdout,
      stderr: stderr || undefined,
      executionTime: duration,
    });

    return {
      output: formatted.output,
      error: formatted.error,
      executionTime: formatted.executionTime,
    };
  }, []);

  const handleExecute = async () => {
    if (!file || running) return;

    setRunning(true);
    setOutput('');
    setError(null);

    try {
      let result: ExecutionResult;

      if (file.language === 'python') {
        const res = await executePythonCode(file.content, {
          timeoutMs: 15000,
          onProgress: (msg) => setPyodideStatus(msg),
        });
        result = {
          output: res.output,
          error: res.error,
          executionTime: res.executionTime,
        };
      } else if (file.language === 'javascript' || file.language === 'typescript') {
        result = await executeJavaScript(file.content);
      } else {
        throw new Error(`In-browser execution is supported for Python, JavaScript, and TypeScript. For ${file.language}, use the Shared Terminal.`);
      }

      setOutput(result.output);
      setError(result.error || null);
      setExecutionTime(result.executionTime);
      onExecutionComplete?.(result);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Execution failed';
      setError(errorMsg);
      onExecutionComplete?.({ output: '', error: errorMsg, executionTime: 0 });
    } finally {
      setRunning(false);
    }
  };

  const handleStop = () => {
    setRunning(false);
  };

  const handleClear = () => {
    setOutput('');
    setError(null);
    setExecutionTime(0);
  };

  const handleCopy = () => {
    const textToCopy = output || error || '';
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getLanguageLabel = () => {
    switch (file?.language) {
      case 'python': return 'Python 3.12 (Pyodide WebAssembly)';
      case 'javascript': return 'JavaScript (QuickJS Engine)';
      case 'typescript': return 'TypeScript (QuickJS Engine)';
      default: return file?.language || 'Plain Text';
    }
  };

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#181818', color: '#71717a' }}>
        <div style={{ padding: '8px 14px', borderBottom: '1px solid #2e2e32', background: '#1f1f23' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, color: '#f4f4f5' }}>
            <Terminal size={14} style={{ color: '#38bdf8' }} /> Code Execution
          </h3>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ fontSize: 13 }}>Select or open a file to execute</p>
        </div>
      </div>
    );
  }

  const canExecute = file.language === 'python' || file.language === 'javascript' || file.language === 'typescript';

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#181818', height: '100%' }}>
      {/* Top Action Bar */}
      <div style={{
        padding: '8px 14px',
        borderBottom: '1px solid #2e2e32',
        background: '#1f1f23',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={handleExecute}
            disabled={running || !canExecute}
            style={{
              padding: '5px 12px',
              background: running ? '#27272a' : '#0284c7',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              cursor: running || !canExecute ? 'not-allowed' : 'pointer',
              fontSize: 12,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: running || !canExecute ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {running ? <Loader2 size={13} className="spin" /> : <Play size={13} fill="currentColor" />}
            {running ? 'Running...' : 'Run Code'}
          </button>

          {running && (
            <button
              onClick={handleStop}
              style={{
                padding: '5px 10px',
                background: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <Square size={13} /> Stop
            </button>
          )}

          <span style={{ fontSize: 11, color: '#a1a1aa' }}>
            {getLanguageLabel()}
          </span>
        </div>

        {/* Right Status / Telemetry */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {executionTime > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a1a1aa' }}>
              <Clock size={12} />
              <span>{executionTime.toFixed(1)} ms</span>
            </div>
          )}

          {error && (
            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500 }}>
              <AlertCircle size={13} /> Runtime Error
            </span>
          )}

          {!error && output && (
            <span style={{ color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500 }}>
              <CheckCircle2 size={13} /> Completed
            </span>
          )}

          {(output || error) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button
                onClick={handleCopy}
                title="Copy Output"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {copied ? <Check size={13} style={{ color: '#4ade80' }} /> : <Copy size={13} />}
              </button>

              <button
                onClick={handleClear}
                title="Clear Output"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#a1a1aa',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Output Console Screen */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px 16px',
        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
        fontSize: 12.5,
        lineHeight: 1.6,
        background: '#141414',
      }}>
        {output && (
          <pre style={{ margin: 0, color: '#f4f4f5', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {output}
          </pre>
        )}

        {error && (
          <pre style={{
            margin: output ? '10px 0 0 0' : 0,
            padding: '8px 12px',
            background: 'rgba(239, 68, 68, 0.1)',
            borderLeft: '3px solid #ef4444',
            borderRadius: 3,
            color: '#fca5a5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {error}
          </pre>
        )}

        {!output && !error && !running && (
          <div style={{ color: '#52525b', textAlign: 'center', padding: '48px 20px' }}>
            <Terminal size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ margin: 0 }}>Click <strong>Run Code</strong> to execute {file.path} in the browser kernel</p>
          </div>
        )}
      </div>
    </div>
  );
}