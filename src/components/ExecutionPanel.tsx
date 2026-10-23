import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Terminal, Loader2, CheckCircle, AlertCircle, Download } from 'lucide-react';
import type { ExecutionResult } from '../types';

interface ExecutionPanelProps {
  file: { path: string; content: string; language: string } | null;
  onExecutionComplete?: (result: ExecutionResult) => void;
}

declare global {
  interface Window {
    pyodide: any;
    loadPyodide: any;
  }
}

export function ExecutionPanel({ file, onExecutionComplete }: ExecutionPanelProps) {
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [pyodideReady, setPyodideReady] = useState(false);
  const pyodideRef = useRef<any>(null);
  const quickJSRef = useRef<any>(null);

  useEffect(() => {
    const initPyodide = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).loadPyodide) {
          const pyodide = await (window as any).loadPyodide({
            indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
          });
          pyodideRef.current = pyodide;
          setPyodideReady(true);
        }
      } catch (err) {
        console.warn('Pyodide failed to load:', err);
      }
    };
    
    initPyodide();
    
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

  const executePython = useCallback(async (code: string): Promise<ExecutionResult> => {
    if (!pyodideRef.current) {
      throw new Error('Pyodide not initialized');
    }
    
    const pyodide = pyodideRef.current;
    let output = '';
    let error: string | null = null;
    const startTime = performance.now();
    
    pyodide.runPython(`
import sys
import io
import contextlib

stdout_capture = io.StringIO()
stderr_capture = io.StringIO()

try:
    with contextlib.redirect_stdout(stdout_capture):
        with contextlib.redirect_stderr(stderr_capture):
            exec("""${code.replace(/"""/g, '\\"\\"\\"')}""")
except Exception as e:
    print(f"Error: {e}", file=stderr_capture)
`);
    
    output = pyodide.runPython('stdout_capture.getvalue()');
    error = pyodide.runPython('stderr_capture.getvalue()');
    
    const executionTime = performance.now() - startTime;
    
    return {
      output: output || '',
      error: error || undefined,
      executionTime,
    };
  }, []);

  const executeJavaScript = useCallback(async (code: string): Promise<ExecutionResult> => {
    if (!quickJSRef.current) {
      throw new Error('QuickJS not initialized');
    }
    
    const module = quickJSRef.current;
    let output = '';
    let error: string | null = null;
    const startTime = performance.now();
    
    const consoleLog = module.newFunction((...args: any[]) => {
      output += args.map(a => String(a)).join(' ') + '\n';
    });
    
    const consoleError = module.newFunction((...args: any[]) => {
      error = (error || '') + args.map(a => String(a)).join(' ') + '\n';
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
      error = String(err);
    }
    
    consoleLog.dispose();
    consoleError.dispose();
    
    const executionTime = performance.now() - startTime;
    
    return {
      output,
      error: error || undefined,
      executionTime,
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
        result = await executePython(file.content);
      } else if (file.language === 'javascript' || file.language === 'typescript') {
        result = await executeJavaScript(file.content);
      } else {
        throw new Error(`Execution not supported for ${file.language}`);
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

  const getLanguageLabel = () => {
    switch (file?.language) {
      case 'python': return 'Python (Pyodide)';
      case 'javascript': return 'JavaScript (QuickJS)';
      case 'typescript': return 'TypeScript (QuickJS)';
      default: return file?.language || 'Unknown';
    }
  };

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} /> Execution
          </h3>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
          <p>Select a file to execute</p>
        </div>
      </div>
    );
  }

  const canExecute = file.language === 'python' || file.language === 'javascript' || file.language === 'typescript';
  const runtimeReady = (file.language === 'python' && pyodideReady) || (file.language === 'javascript' || file.language === 'typescript');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={16} /> Execution
          </h3>
          <span style={{ fontSize: 11, color: '#888' }}>{getLanguageLabel()}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleExecute}
            disabled={running || !canExecute || !runtimeReady}
            style={{
              padding: '6px 12px',
              background: running ? '#333' : '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: running || !canExecute || !runtimeReady ? 'not-allowed' : 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: running || !canExecute || !runtimeReady ? 0.7 : 1,
            }}
          >
            {running ? <Loader2 size={14} className="spin" /> : <Play size={14} />}
            {running ? 'Running...' : 'Run'}
          </button>
          {running && (
            <button
              onClick={handleStop}
              style={{
                padding: '6px 12px',
                background: '#c42e2e',
                color: '#fff',
                border: 'none',
                borderRadius: 3,
                cursor: 'pointer',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Square size={14} /> Stop
            </button>
          )}
          {!canExecute && (
            <span style={{ fontSize: 11, color: '#888', alignSelf: 'center' }}>
              Execution not supported for {file.language}
            </span>
          )}
          {!runtimeReady && canExecute && (
            <span style={{ fontSize: 11, color: '#cca700', alignSelf: 'center' }}>
              <Loader2 size={12} className="spin" /> Loading runtime...
            </span>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          padding: '8px 12px',
          background: '#252526',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
        }}>
          <span>OUTPUT</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {error && (
              <span style={{ color: '#f44747', display: 'flex', alignItems: 'center', gap: 4 }}>
                <AlertCircle size={12} /> Error
              </span>
            )}
            {!error && output && (
              <span style={{ color: '#4ec9b0', display: 'flex', alignItems: 'center', gap: 4 }}>
                <CheckCircle size={12} /> Success
              </span>
            )}
            {executionTime > 0 && (
              <span style={{ color: '#888' }}>{executionTime.toFixed(1)}ms</span>
            )}
            {output && (
              <button
                onClick={() => navigator.clipboard.writeText(output)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Copy output"
              >
                <Download size={12} />
              </button>
            )}
          </div>
        </div>
        
        <div style={{ flex: 1, overflow: 'auto', padding: '12px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}>
          {output && (
            <pre style={{ margin: 0, color: '#d4d4d4', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {output}
            </pre>
          )}
          {error && (
            <pre style={{ margin: 0, color: '#f44747', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {error}
            </pre>
          )}
          {!output && !error && !running && (
            <div style={{ color: '#666', textAlign: 'center', padding: '40px 20px' }}>
              <Terminal size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
              <p>Click Run to execute your code</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}