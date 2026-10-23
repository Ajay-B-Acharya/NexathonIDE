import React from 'react';
import { Play, Zap, Trash2, Clock, CheckCircle2, XCircle, Terminal } from 'lucide-react';
import { ExecutionResult } from '../types';

interface OutputPanelProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  onClearOutput: () => void;
  onSendErrorToAI: (errorText: string) => void;
}

export const OutputPanel: React.FC<OutputPanelProps> = ({
  result,
  isRunning,
  onClearOutput,
  onSendErrorToAI,
}) => {
  return (
    <div className="flex h-full flex-col bg-[#090a0f] text-slate-200 font-mono text-xs overflow-hidden">
      {/* Benchmark Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0f121d] px-3.5 py-1.5 font-sans">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Terminal className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
              WASM Sandbox (Pyodide & QuickJS)
            </span>
          </div>

          {result && (
            <div className="flex items-center gap-2 text-[11px]">
              {result.exitCode === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/50 px-2.5 py-0.5 font-medium text-emerald-300">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span>● Exit 0 (Success)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/50 px-2.5 py-0.5 font-medium text-rose-300">
                  <XCircle className="h-3 w-3 text-rose-400" />
                  <span>● Exit {result.exitCode} (Failed)</span>
                </span>
              )}

              <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#141824] px-2.5 py-0.5 font-mono text-[11px] text-slate-300">
                <Clock className="h-3 w-3 text-indigo-400" />
                <span>⏱️ {result.executionTimeMs}ms</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {result && result.stderr && (
            <button
              type="button"
              onClick={() => onSendErrorToAI(result.stderr)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-purple-400/40 bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1 text-[11px] font-semibold text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] hover:from-purple-500 hover:to-indigo-500 transition cursor-pointer"
            >
              <Zap className="h-3.5 w-3.5 fill-current text-amber-300" />
              <span>⚡ Send Error to AI Debugger</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClearOutput}
            title="Clear Output"
            className="rounded-md border border-white/10 bg-[#141824] p-1 text-slate-400 hover:bg-[#1c2234] hover:text-white transition cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Output Stream Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {isRunning && (
          <div className="flex items-center gap-2.5 rounded-xl border border-indigo-500/30 bg-[#141824]/80 p-3 text-indigo-300 animate-shimmer">
            <Play className="h-4 w-4 animate-pulse text-indigo-400" />
            <span>Executing code in isolated WebAssembly runtime...</span>
          </div>
        )}

        {!isRunning && !result && (
          <div className="flex h-full items-center justify-center text-slate-500 font-sans text-xs">
            <span>
              Press{' '}
              <kbd className="rounded border border-white/10 bg-[#141824] px-1.5 py-0.5 font-mono text-slate-300">
                Ctrl+Enter
              </kbd>{' '}
              or click <strong className="text-emerald-400">Run Code</strong> to execute Python or JavaScript/TypeScript in-browser.
            </span>
          </div>
        )}

        {result && (
          <>
            {result.stdout && (
              <div className="rounded-xl border border-white/10 bg-[#0f121d] overflow-hidden">
                <div className="border-b border-white/5 bg-[#141824] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Standard Output (stdout)
                </div>
                <pre className="whitespace-pre-wrap break-words p-3 text-slate-100 leading-relaxed">
                  {result.stdout}
                </pre>
              </div>
            )}

            {result.stderr && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 overflow-hidden">
                <div className="border-b border-rose-500/20 bg-rose-950/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-rose-300">
                  Standard Error / Traceback (stderr)
                </div>
                <pre className="whitespace-pre-wrap break-words p-3 text-rose-200 leading-relaxed">
                  {result.stderr}
                </pre>
              </div>
            )}

            {!result.stdout && !result.stderr && (
              <div className="rounded-xl border border-white/5 bg-[#0f121d] p-3 text-slate-400 italic">
                Process finished with exit code 0 and no console output.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
