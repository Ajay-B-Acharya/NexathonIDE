import React, { useState, useMemo } from 'react';
import {
  Check,
  X,
  FileCode,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { ProposedPatch } from '../types';

interface AIDiffViewerProps {
  patch: ProposedPatch;
  currentFileContent?: string;
  onApply: (patch: ProposedPatch) => Promise<void>;
  onReject: (patch: ProposedPatch) => void;
  onViewInEditor?: (filePath: string) => void;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  text: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/**
 * Computes a clean line-by-line diff between original and patched contents.
 */
function computeDiff(original: string, patched: string): DiffLine[] {
  const origLines = original ? original.split('\n') : [];
  const patchLines = patched ? patched.split('\n') : [];

  const diff: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < origLines.length || j < patchLines.length) {
    if (i < origLines.length && j < patchLines.length && origLines[i] === patchLines[j]) {
      diff.push({
        type: 'unchanged',
        text: origLines[i],
        oldLineNumber: i + 1,
        newLineNumber: j + 1,
      });
      i++;
      j++;
    } else {
      // Collect removed lines
      const removedBuffer: string[] = [];
      while (i < origLines.length && (j >= patchLines.length || origLines[i] !== patchLines[j])) {
        // Lookahead check to avoid greedy removals
        if (patchLines.slice(j, j + 4).includes(origLines[i])) {
          break;
        }
        removedBuffer.push(origLines[i]);
        i++;
      }

      // Collect added lines
      const addedBuffer: string[] = [];
      while (j < patchLines.length && (i >= origLines.length || origLines[i] !== patchLines[j])) {
        addedBuffer.push(patchLines[j]);
        j++;
      }

      for (const line of removedBuffer) {
        diff.push({ type: 'removed', text: line });
      }
      for (const line of addedBuffer) {
        diff.push({ type: 'added', text: line });
      }

      if (removedBuffer.length === 0 && addedBuffer.length === 0) {
        if (i < origLines.length) {
          diff.push({ type: 'removed', text: origLines[i++] });
        }
        if (j < patchLines.length) {
          diff.push({ type: 'added', text: patchLines[j++] });
        }
      }
    }
  }

  return diff;
}

export const AIDiffViewer: React.FC<AIDiffViewerProps> = ({
  patch,
  currentFileContent,
  onApply,
  onReject,
  onViewInEditor,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Check if current file has been modified by someone else since patch generation
  const isStale = useMemo(() => {
    if (currentFileContent === undefined) return false;
    // Compare baseline content
    return currentFileContent.trim() !== patch.originalContent.trim();
  }, [currentFileContent, patch.originalContent]);

  const diffLines = useMemo(() => {
    return computeDiff(patch.originalContent, patch.patchedContent);
  }, [patch.originalContent, patch.patchedContent]);

  const additionsCount = diffLines.filter((l) => l.type === 'added').length;
  const deletionsCount = diffLines.filter((l) => l.type === 'removed').length;

  const handleApplyClick = async () => {
    setIsApplying(true);
    setApplyError(null);
    try {
      await onApply(patch);
    } catch (err: any) {
      setApplyError(err?.message || 'Failed to apply patch');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="rounded-xl border theme-border overflow-hidden my-3 theme-bg-surface-1 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 theme-bg-surface-2 border-b theme-border select-none">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-1 rounded bg-[#FF7057]/15 text-[#FF7057]">
            <FileCode className="h-4 w-4" />
          </div>
          <span className="font-mono text-xs font-bold theme-text-primary truncate" title={patch.filePath}>
            {patch.filePath}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px] ml-1 shrink-0">
            <span className="text-emerald-500 font-semibold">+{additionsCount}</span>
            <span className="text-rose-500 font-semibold">-{deletionsCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onViewInEditor && (
            <button
              type="button"
              onClick={() => onViewInEditor(patch.filePath)}
              title="Open file in editor"
              className="p-1 rounded hover:theme-bg-surface-1 theme-text-secondary hover:theme-text-primary transition cursor-pointer"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse Diff' : 'Expand Diff'}
            className="p-1 rounded hover:theme-bg-surface-1 theme-text-secondary hover:theme-text-primary transition cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Explanation pill */}
      {patch.explanation && (
        <div className="px-3.5 py-1.5 bg-black/[0.02] dark:bg-white/[0.02] border-b theme-border text-xs theme-text-secondary flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-[#FF7057] shrink-0" />
          <span>{patch.explanation}</span>
        </div>
      )}

      {/* Stale Warning Notification */}
      {isStale && patch.status === 'pending' && (
        <div className="px-3.5 py-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <strong>Stale Patch Notice:</strong> This file was edited by a collaborator since this patch was generated. Review carefully before applying.
          </span>
        </div>
      )}

      {/* Error Message */}
      {applyError && (
        <div className="px-3.5 py-2 bg-rose-500/10 border-b border-rose-500/30 text-xs text-rose-500">
          {applyError}
        </div>
      )}

      {/* Diff Code View */}
      {isExpanded && (
        <div className="max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed select-text theme-bg-root">
          {diffLines.length === 0 ? (
            <div className="p-4 text-center theme-text-muted text-xs">No line changes detected</div>
          ) : (
            diffLines.map((line, idx) => {
              const isAdded = line.type === 'added';
              const isRemoved = line.type === 'removed';

              return (
                <div
                  key={idx}
                  className={`flex px-2 py-0.5 border-l-2 transition-colors ${
                    isAdded
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                      : isRemoved
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500'
                      : 'border-transparent theme-text-secondary hover:bg-black/5 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="w-5 shrink-0 select-none text-center font-bold opacity-75">
                    {isAdded ? '+' : isRemoved ? '-' : ' '}
                  </span>
                  <pre className="whitespace-pre overflow-x-auto font-mono">{line.text || ' '}</pre>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Action Controls Bar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 theme-bg-surface-2 border-t theme-border text-xs">
        <span className="font-mono text-[11px] theme-text-muted">
          {patch.status === 'applied' && (
            <span className="text-emerald-500 font-semibold flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Applied to Shared Workspace
            </span>
          )}
          {patch.status === 'rejected' && (
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <X className="h-3.5 w-3.5" /> Patch Rejected
            </span>
          )}
          {patch.status === 'pending' && (
            <span className="theme-text-secondary">Requires developer approval</span>
          )}
        </span>

        {patch.status === 'pending' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onReject(patch)}
              disabled={isApplying}
              className="px-3 py-1 rounded-lg border theme-border hover:theme-bg-surface-1 theme-text-secondary hover:theme-text-primary text-xs font-semibold transition cursor-pointer"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={handleApplyClick}
              disabled={isApplying}
              className="px-3 py-1 rounded-lg bg-[#FF7057] hover:bg-[#F26049] text-white text-xs font-semibold flex items-center gap-1.5 neu-button transition cursor-pointer disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply Patch</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
