import React, { useState, useEffect } from 'react';
import { Sparkles, Bug, Check, Eye, Loader2, AlertCircle, Cpu } from 'lucide-react';
import { aiDebuggerApi } from '../services/aiDebuggerApi';
import { AIDebugResponse, WorkspaceFile } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface AIDebuggerPanelProps {
  activeFile: WorkspaceFile | null;
  initialError: string;
  onApplyFixToEditor: (newCode: string) => void;
}

export const AIDebuggerPanel: React.FC<AIDebuggerPanelProps> = ({
  activeFile,
  initialError,
  onApplyFixToEditor,
}) => {
  const [errorContext, setErrorContext] = useState(initialError);
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<AIDebugResponse | null>(null);
  const [showInlineDiff, setShowInlineDiff] = useState(true);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (initialError) {
      setErrorContext(initialError);
    }
  }, [initialError]);

  const handleRunDiagnosis = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFile) return;

    setIsLoading(true);
    setRequestError(null);

    try {
      const response = await aiDebuggerApi.analyzeAndDebug({
        code: activeFile.content,
        language: activeFile.language,
        error: errorContext.trim() || 'Inspect code for bugs and runtime issues.',
        filePath: activeFile.path,
      });
      setDiagnosis(response);
      setShowInlineDiff(true);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : 'Failed to reach AI Debugger endpoint.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!activeFile) {
    return (
      <div className="flex h-full items-center justify-center theme-bg-root text-xs theme-text-secondary">
        Open a file in the editor to launch AI Diagnostics & Diff Review.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col theme-bg-root theme-text-primary overflow-hidden transition-colors">
      {/* Professional Diagnosis Header */}
      <div className="flex items-center justify-between border-b theme-border theme-bg-surface-1 px-3.5 py-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-[#FF7057]" />
          <span className="text-[11px] font-semibold uppercase tracking-wider theme-text-secondary">
            AI Debugger & Diff Guard
          </span>
          <span className="rounded border theme-border theme-bg-surface-2 px-2 py-0.5 text-[10px] font-mono theme-text-primary">
            {activeFile.path}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        <form onSubmit={(e) => void handleRunDiagnosis(e)} className="flex gap-2">
          <input
            type="text"
            value={errorContext}
            onChange={(e) => setErrorContext(e.target.value)}
            placeholder="Paste stack trace / stderr or describe unexpected behavior..."
            className="flex-1 rounded-lg border theme-border theme-bg-surface-2 px-3.5 py-1.5 text-xs theme-text-primary placeholder:text-muted focus:border-[#FF7057] focus:outline-none font-mono"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition shrink-0 cursor-pointer neu-button"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Bug className="h-3.5 w-3.5" />
            )}
            <span>{isLoading ? 'Evaluating AST...' : 'Diagnose Error'}</span>
          </button>
        </form>

        {/* Animated Shimmer Loading Bar */}
        {isLoading && (
          <div className="flex items-center gap-3 rounded-xl border border-[#FF7057]/30 p-3.5 animate-shimmer">
            <Cpu className="h-4 w-4 text-[#FF7057] animate-spin" />
            <span className="text-xs font-medium text-[#FF7057]">
              Analyzing stack trace, syntax tree, and generating minimal diff patch...
            </span>
          </div>
        )}

        {requestError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{requestError}</span>
          </div>
        )}

        {diagnosis && (
          <div className="space-y-3.5 rounded-xl border theme-border theme-bg-surface-1 p-3.5 text-xs neu-card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Card 1: Technical Diagnosis */}
              <div className="rounded-xl border theme-border theme-bg-surface-2 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF7057] mb-1.5">
                  Diagnosis & Root Cause
                </div>
                <p className="theme-text-primary leading-relaxed">{diagnosis.explanation}</p>
              </div>

              {/* Card 2: Probable Explanation */}
              <div className="rounded-xl border theme-border theme-bg-surface-2 p-3.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1.5">
                  Probable Explanation
                </div>
                <p className="theme-text-primary leading-relaxed">{diagnosis.probableCause}</p>
              </div>
            </div>

            {/* Diff Preview Toggle & Apply CTA */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => setShowInlineDiff((prev) => !prev)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[#FF7057] hover:underline cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                <span>{showInlineDiff ? 'Hide Side-by-Side Diff' : 'Show Side-by-Side Diff'}</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#FF7057] hover:bg-[#F26049] px-3.5 py-1.5 text-xs font-semibold text-white transition cursor-pointer neu-button"
              >
                <Check className="h-3.5 w-3.5" />
                <span>✓ Review & Apply Fix to Shared Document</span>
              </button>
            </div>

            {showInlineDiff && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 rounded-xl border theme-border theme-bg-root p-3 font-mono text-[11px]">
                <div className="overflow-x-auto rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase text-rose-500">
                    − Original ({activeFile.path})
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-rose-600 dark:text-rose-300 leading-relaxed">
                    {activeFile.content}
                  </pre>
                </div>
                <div className="overflow-x-auto rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5">
                  <div className="mb-1.5 text-[10px] font-bold uppercase text-emerald-500">
                    + Suggested Fix
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-emerald-600 dark:text-emerald-300 leading-relaxed">
                    {diagnosis.suggestedFix}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory Confirmation Modal before modifying shared Yjs/Monaco Document */}
      {diagnosis && (
        <ConfirmModal
          isOpen={isConfirmModalOpen}
          title="Apply AI Suggested Fix to Shared Document"
          description="Applying this fix will atomically update the collaborative Yjs document for all connected participants in real time. Verify the side-by-side diff below before confirming."
          confirmLabel="Apply Fix to Shared Document"
          cancelLabel="Cancel"
          variant="primary"
          diffPreview={{
            originalCode: activeFile.content,
            suggestedCode: diagnosis.suggestedFix,
            filePath: activeFile.path,
          }}
          onConfirm={() => {
            onApplyFixToEditor(diagnosis.suggestedFix);
            setIsConfirmModalOpen(false);
          }}
          onCancel={() => setIsConfirmModalOpen(false)}
        />
      )}
    </div>
  );
};
