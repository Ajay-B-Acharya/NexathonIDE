import React, { useState } from 'react';
import {
  AlertTriangle,
  FolderOpen,
  FileText,
  Copy,
  ArrowRight,
  X,
  ShieldAlert,
  Edit3,
} from 'lucide-react';

export interface FileConflictModalProps {
  isOpen: boolean;
  type: 'file' | 'folder';
  itemName: string;
  parentPath?: string;
  suggestedCopyName: string;
  hasUnsavedDraft?: boolean;
  draftSnippet?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onOpenExisting: () => void;
  onCreateCopy: (copyName: string) => Promise<void>;
  onChooseName: (customName: string) => Promise<void>;
  onCancel: () => void;
}

export const FileConflictModal: React.FC<FileConflictModalProps> = ({
  isOpen,
  type,
  itemName,
  parentPath = '',
  suggestedCopyName,
  hasUnsavedDraft = false,
  draftSnippet,
  errorMessage,
  isSubmitting = false,
  onOpenExisting,
  onCreateCopy,
  onChooseName,
  onCancel,
}) => {
  const [customName, setCustomName] = useState(suggestedCopyName || '');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [prevSuggested, setPrevSuggested] = useState(suggestedCopyName);

  if (suggestedCopyName !== prevSuggested) {
    setPrevSuggested(suggestedCopyName);
    setCustomName(suggestedCopyName);
    setValidationError(null);
  }

  if (!isOpen) return null;

  const isFolder = type === 'folder';
  const title = isFolder ? 'Folder Already Exists' : 'File Already Exists';

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) {
      setValidationError('Please enter a valid name');
      return;
    }
    if (trimmed.includes('/') || trimmed.includes('\\')) {
      setValidationError('Name cannot contain directory separators (/ or \\)');
      return;
    }
    if (trimmed.toLowerCase() === itemName.toLowerCase()) {
      setValidationError(`"${trimmed}" is the conflicting name. Please choose a different name.`);
      return;
    }
    setValidationError(null);
    await onChooseName(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 transition-colors"
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
    >
      <div className="w-full max-w-lg rounded-2xl border theme-border theme-bg-surface-1 theme-text-primary neu-card overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b theme-border px-5 py-4 theme-bg-surface-2">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 id="conflict-dialog-title" className="text-sm font-bold theme-text-primary">
                {title}
              </h3>
              <p className="text-[11px] font-mono theme-text-muted">
                {parentPath ? `${parentPath}/` : ''}
                <span className="text-[#FF7057] font-semibold">{itemName}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 theme-text-secondary hover:theme-bg-surface-1 hover:theme-text-primary transition cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-xs sm:text-sm theme-text-secondary leading-relaxed">
            <span className="font-semibold theme-text-primary">
              {parentPath ? `${parentPath}/` : ''}
              {itemName}
            </span>{' '}
            was created by another collaborator while you were working. Choose how you would like to proceed.
          </p>

          {/* Draft Preservation Banner */}
          {hasUnsavedDraft && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Your work is preserved
                </p>
                <p className="text-[11px] leading-relaxed text-amber-800/80 dark:text-amber-300/80">
                  Opening the existing shared file will not overwrite or auto-merge your draft content.
                  If you choose to create a copy, your draft will be transferred to the new file.
                </p>
                {draftSnippet && (
                  <pre className="mt-1.5 p-2 rounded bg-black/10 dark:bg-black/30 text-[10px] font-mono overflow-x-auto max-h-16 text-zinc-700 dark:text-zinc-300">
                    {draftSnippet}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* Error Message if re-try also conflicts */}
          {(errorMessage || validationError) && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{validationError || errorMessage}</span>
            </div>
          )}

          {/* Action Options */}
          <div className="space-y-2.5 pt-1">
            {/* Action A: Open Existing */}
            <button
              type="button"
              onClick={onOpenExisting}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between p-3 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057]/40 hover:theme-bg-surface-1 transition-all text-left cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500 shrink-0">
                  {isFolder ? <FolderOpen className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-xs font-bold theme-text-primary group-hover:text-[#FF7057] transition-colors">
                    {isFolder ? 'Open Existing Folder' : 'Open Existing File'}
                  </div>
                  <div className="text-[11px] theme-text-muted">
                    Join the shared {isFolder ? 'folder' : 'document'} without creating a duplicate.
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 theme-text-muted group-hover:translate-x-1 group-hover:text-[#FF7057] transition-all" />
            </button>

            {/* Action B: Create a Copy */}
            <button
              type="button"
              onClick={() => void onCreateCopy(suggestedCopyName)}
              disabled={isSubmitting}
              className="w-full flex items-center justify-between p-3 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057]/40 hover:theme-bg-surface-1 transition-all text-left cursor-pointer group disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
                  <Copy className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold theme-text-primary group-hover:text-[#FF7057] transition-colors">
                    Create Copy: <span className="font-mono text-[#FF7057]">{suggestedCopyName}</span>
                  </div>
                  <div className="text-[11px] theme-text-muted">
                    Keep your intended content in a separate {isFolder ? 'folder' : 'file'}.
                  </div>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 theme-text-muted group-hover:translate-x-1 group-hover:text-[#FF7057] transition-all" />
            </button>

            {/* Action C: Choose Another Name */}
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                disabled={isSubmitting}
                className="w-full flex items-center justify-between p-3 rounded-xl border theme-border theme-bg-surface-2 hover:border-[#FF7057]/40 hover:theme-bg-surface-1 transition-all text-left cursor-pointer group disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500 shrink-0">
                    <Edit3 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold theme-text-primary group-hover:text-[#FF7057] transition-colors">
                      Choose Another Name
                    </div>
                    <div className="text-[11px] theme-text-muted">
                      Specify a custom non-conflicting filename.
                    </div>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 theme-text-muted group-hover:translate-x-1 group-hover:text-[#FF7057] transition-all" />
              </button>
            ) : (
              <form onSubmit={handleCustomSubmit} className="p-3 rounded-xl border border-[#FF7057]/40 theme-bg-surface-2 space-y-2.5">
                <label className="block text-[11px] font-semibold theme-text-secondary">
                  Enter alternative name:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      setValidationError(null);
                    }}
                    autoFocus
                    placeholder={suggestedCopyName}
                    disabled={isSubmitting}
                    className="flex-1 rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs font-mono theme-text-primary focus:outline-none focus:ring-1 focus:ring-[#FF7057]"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || !customName.trim()}
                    className="rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white px-3 py-1.5 text-xs font-semibold neu-button disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? 'Checking...' : 'Create'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(false)}
                    disabled={isSubmitting}
                    className="rounded-lg border theme-border px-2 py-1.5 text-xs theme-text-secondary hover:theme-text-primary cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Footer / Action D: Cancel */}
        <div className="border-t theme-border px-5 py-3.5 theme-bg-surface-2 flex items-center justify-between">
          <span className="text-[11px] theme-text-muted">
            Draft content remains saved locally.
          </span>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="rounded-xl border theme-border hover:theme-bg-surface-1 px-4 py-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
