import React from 'react';
import { AlertTriangle, Sparkles, X, Check } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
  diffPreview?: {
    originalCode: string;
    suggestedCode: string;
    filePath: string;
  };
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  diffPreview,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-colors"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${
          diffPreview ? 'max-w-5xl' : 'max-w-md'
        } rounded-2xl border theme-border theme-bg-surface-1 theme-text-primary theme-shadow overflow-hidden`}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b theme-border px-5 py-4 theme-bg-surface-2">
          <div className="flex items-center gap-2.5">
            {variant === 'danger' ? (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30">
                <AlertTriangle className="h-4 w-4" />
              </div>
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/30">
                <Sparkles className="h-4 w-4" />
              </div>
            )}
            <h3 className="text-sm font-bold theme-text-primary">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="rounded-lg p-1 theme-text-secondary hover:theme-bg-surface-1 hover:theme-text-primary transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          <p className="text-xs theme-text-secondary leading-relaxed">{description}</p>

          {diffPreview && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs theme-text-secondary font-mono">
                <span>Target Document: <strong className="text-indigo-500 dark:text-indigo-300">{diffPreview.filePath}</strong></span>
                <span className="rounded-full border theme-border theme-bg-surface-2 px-2.5 py-0.5 text-[10px]">
                  Side-by-Side CRDT Diff Verification
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto rounded-xl border theme-border theme-bg-root p-3.5 font-mono text-xs">
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 overflow-x-auto">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-rose-500">
                    − Current Shared Buffer
                  </div>
                  <pre className="text-rose-600 dark:text-rose-300 whitespace-pre-wrap break-words leading-relaxed">
                    {diffPreview.originalCode}
                  </pre>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 overflow-x-auto">
                  <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    + Proposed AI Fix
                  </div>
                  <pre className="text-emerald-600 dark:text-emerald-300 whitespace-pre-wrap break-words leading-relaxed">
                    {diffPreview.suggestedCode}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t theme-border theme-bg-surface-2 px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border theme-border theme-bg-surface-1 px-4 py-1.5 text-xs font-medium theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer shadow-xs"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white transition cursor-pointer ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.35)]'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-[0_0_15px_rgba(168,85,247,0.35)]'
            }`}
          >
            <Check className="h-3.5 w-3.5" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
