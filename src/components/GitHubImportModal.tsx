import React, { useState } from 'react';
import {
  X,
  GitBranch,
  Check,
  AlertCircle,
  Loader2,
  Lock,
  Globe,
  Star,
  Layers,
  ArrowRight,
  Shield,
  FileCode,
} from 'lucide-react';
import { GithubIcon } from './icons/GithubIcon';
import { workspaceApi } from '../services/workspaceApi';
import type { GitHubRepoInfo, GitHubImportResult } from '../types';

interface GitHubImportModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onImportSuccess: (result: GitHubImportResult) => void;
}

type ImportStep = 'input' | 'validated' | 'importing' | 'complete';

export const GitHubImportModal: React.FC<GitHubImportModalProps> = ({
  isOpen,
  userId,
  onClose,
  onImportSuccess,
}) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [step, setStep] = useState<ImportStep>('input');
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [customName, setCustomName] = useState('');
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) {
      setError('Please enter a GitHub repository URL.');
      return;
    }

    setIsValidating(true);
    setError(null);
    try {
      const info = await workspaceApi.validateGitHubRepo(repoUrl.trim(), githubToken.trim() || undefined);
      setRepoInfo(info);
      setSelectedBranch(info.defaultBranch);
      setCustomName(info.repo);
      setStep('validated');
    } catch (err: any) {
      setError(err.message || 'Failed to inspect GitHub repository.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartImport = async () => {
    if (!repoInfo) return;

    setIsImporting(true);
    setError(null);
    setStep('importing');
    setProgressStatus('Fetching repository file tree...');

    try {
      setTimeout(() => setProgressStatus('Downloading source blobs & manifests...'), 800);
      setTimeout(() => setProgressStatus('Analyzing project architecture & languages...'), 1800);
      setTimeout(() => setProgressStatus('Provisioning collaborative CRDT workspace...'), 2600);

      const result = await workspaceApi.importGitHubRepo({
        url: repoUrl.trim(),
        branch: selectedBranch,
        ownerId: userId,
        name: customName.trim() || repoInfo.repo,
        githubToken: githubToken.trim() || undefined,
      });

      setStep('complete');
      setTimeout(() => {
        onImportSuccess(result);
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Import failed. Please check repository permissions or size.');
      setStep('validated');
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setStep('input');
    setRepoInfo(null);
    setError(null);
    setProgressStatus('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl rounded-2xl border theme-border theme-bg-surface-1 p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b theme-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-black dark:bg-white text-white dark:text-black shadow-sm">
              <GithubIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold theme-text-primary">Import from GitHub</h2>
              <p className="text-xs theme-text-secondary">
                Clone and provision any public or private repository into a real-time collaborative workspace.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="rounded-lg p-1.5 theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          {step === 'input' && (
            <form onSubmit={handleValidate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold theme-text-primary mb-1.5">
                  GitHub Repository URL
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="https://github.com/owner/repository"
                    disabled={isValidating}
                    className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3.5 py-2.5 text-xs font-mono theme-text-primary placeholder:theme-text-muted focus:outline-none focus:border-[#FF7057] transition shadow-inner"
                    autoFocus
                  />
                </div>
                <p className="mt-1.5 text-[11px] theme-text-secondary">
                  Examples: <span className="font-mono text-[10px]">facebook/react</span> or <span className="font-mono text-[10px]">https://github.com/fastapi/fastapi</span>
                </p>
              </div>

              {/* Private Repo Token Toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowTokenInput((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent-primary)] hover:underline cursor-pointer"
                >
                  <Lock className="h-3 w-3" />
                  <span>{showTokenInput ? 'Hide GitHub Token' : 'Import Private Repository (Add Personal Token)'}</span>
                </button>

                {showTokenInput && (
                  <div className="mt-2.5 p-3 rounded-xl border theme-border theme-bg-surface-2 space-y-2">
                    <label className="block text-[11px] font-semibold theme-text-primary">
                      GitHub Personal Access Token (PAT)
                    </label>
                    <input
                      type="password"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="w-full rounded-lg border theme-border theme-bg-surface-1 px-3 py-1.5 text-xs font-mono theme-text-primary focus:outline-none focus:border-[#FF7057]"
                    />
                    <div className="flex items-center gap-1.5 text-[10px] theme-text-secondary">
                      <Shield className="h-3 w-3 text-emerald-500" />
                      <span>Tokens are encrypted in transit and never stored in room shared state.</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border theme-border theme-bg-surface-2 px-4 py-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isValidating || !repoUrl.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-semibold text-white disabled:opacity-50 transition cursor-pointer shadow-md"
                >
                  {isValidating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Inspecting Repository...</span>
                    </>
                  ) : (
                    <>
                      <span>Inspect Repository</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {step === 'validated' && repoInfo && (
            <div className="space-y-4 animate-fade-in">
              {/* Repository Card Preview */}
              <div className="p-4 rounded-xl border theme-border theme-bg-surface-2 space-y-2.5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm theme-text-primary truncate">
                        {repoInfo.owner} / {repoInfo.repo}
                      </span>
                      {repoInfo.isPrivate ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-[10px] font-semibold">
                          <Lock className="h-2.5 w-2.5" />
                          Private
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-semibold">
                          <Globe className="h-2.5 w-2.5" />
                          Public
                        </span>
                      )}
                    </div>
                    <p className="text-xs theme-text-secondary line-clamp-2 mt-1">
                      {repoInfo.description || 'No description provided.'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-xs theme-text-secondary shrink-0 pl-2">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-current" />
                    <span className="font-mono">{repoInfo.stars}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] theme-text-muted pt-1">
                  {repoInfo.primaryLanguage && (
                    <span className="px-2 py-0.5 rounded bg-[#FF7057]/10 text-[#FF7057] font-semibold">
                      {repoInfo.primaryLanguage}
                    </span>
                  )}
                  <span>Size: {Math.round(repoInfo.sizeKb)} KB</span>
                </div>
              </div>

              {/* Branch and Project Name Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold theme-text-primary mb-1">
                    Branch to Import
                  </label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={(e) => setSelectedBranch(e.target.value)}
                      className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3 py-2 text-xs font-mono theme-text-primary focus:outline-none focus:border-[#FF7057] cursor-pointer"
                    >
                      {repoInfo.branches.map((b) => (
                        <option key={b} value={b}>
                          {b} {b === repoInfo.defaultBranch ? '(default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold theme-text-primary mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Project Name"
                    className="w-full rounded-xl border theme-border theme-bg-surface-2 px-3 py-2 text-xs theme-text-primary focus:outline-none focus:border-[#FF7057]"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs font-medium theme-text-secondary hover:theme-text-primary cursor-pointer"
                >
                  ← Choose Different Repo
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-xl border theme-border theme-bg-surface-2 px-4 py-2 text-xs font-semibold theme-text-secondary hover:theme-text-primary transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleStartImport}
                    className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] px-5 py-2 text-xs font-semibold text-white transition cursor-pointer shadow-md"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    <span>Create & Import Workspace</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'importing' && (
            <div className="py-8 text-center space-y-4 animate-fade-in">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FF7057]/10 text-[#FF7057] animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-sm font-bold theme-text-primary">
                  Importing {repoInfo?.repo || 'Repository'}...
                </h3>
                <p className="text-xs theme-text-secondary mt-1 font-mono">
                  {progressStatus || 'Downloading and compiling workspace files...'}
                </p>
              </div>
              <div className="w-full max-w-xs mx-auto bg-neutral-200 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-[#FF7057] h-full w-2/3 animate-pulse rounded-full" />
              </div>
            </div>
          )}

          {step === 'complete' && (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold theme-text-primary">Workspace Ready!</h3>
              <p className="text-xs theme-text-secondary">
                Repository successfully imported and configured. Opening collaborative editor...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
