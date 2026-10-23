import React, { useState, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileJson,
  FileText,
  FilePlus,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  FolderTree,
} from 'lucide-react';
import { FileTreeNode, WorkspaceFile } from '../types';

interface FileExplorerProps {
  files: WorkspaceFile[];
  activeFileId: string | null;
  dirtyFileIds: Set<string>;
  onSelectFile: (file: WorkspaceFile) => void;
  onCreateFile: (path: string) => Promise<void>;
  onRenameFile: (file: WorkspaceFile, newPath: string) => Promise<void>;
  onRequestDeleteFile: (file: WorkspaceFile) => void;
}

function buildFileTree(files: WorkspaceFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));

  for (const file of sorted) {
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      let existingNode = currentLevel.find((n) => n.name === part);
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'folder',
          file: isFile ? file : undefined,
          children: isFile ? undefined : [],
        };
        currentLevel.push(existingNode);
      }

      if (!isFile && existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] =>
    nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) =>
        node.children ? { ...node, children: sortNodes(node.children) } : node
      );

  return sortNodes(root);
}

function getExtensionBadge(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'py':
      return <FileCode className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="h-4 w-4 shrink-0 text-blue-500 dark:text-blue-400" />;
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 shrink-0 text-yellow-500 dark:text-yellow-300" />;
    case 'json':
      return <FileJson className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />;
    case 'md':
      return <FileText className="h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 theme-text-secondary" />;
  }
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  activeFileId,
  dirtyFileIds,
  onSelectFile,
  onCreateFile,
  onRenameFile,
  onRequestDeleteFile,
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['src', 'components', 'utils'])
  );
  const [isCreating, setIsCreating] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [editingPathValue, setEditingPathValue] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const tree = useMemo(() => buildFileTree(files), [files]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFilePath.trim().replace(/^\/+/, '');
    if (!trimmed) return;

    try {
      setErrorMsg(null);
      await onCreateFile(trimmed);
      const segments = trimmed.split('/');
      if (segments.length > 1) {
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          let acc = '';
          for (let i = 0; i < segments.length - 1; i++) {
            acc = acc ? `${acc}/${segments[i]}` : segments[i];
            next.add(acc);
          }
          return next;
        });
      }
      setNewFilePath('');
      setIsCreating(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create file');
    }
  };

  const handleRenameSubmit = async (file: WorkspaceFile) => {
    const trimmed = editingPathValue.trim().replace(/^\/+/, '');
    if (!trimmed || trimmed === file.path) {
      setEditingFileId(null);
      return;
    }
    try {
      setErrorMsg(null);
      await onRenameFile(file, trimmed);
      setEditingFileId(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to rename file');
    }
  };

  const renderTreeNodes = (nodes: FileTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === 'folder') {
        const isExpanded = expandedFolders.has(node.path);
        return (
          <div key={`folder-${node.path}`}>
            <button
              type="button"
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 10}px` }}
              className="flex w-full items-center gap-1.5 py-1.5 pr-2 text-left text-xs theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 theme-text-secondary opacity-70" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 theme-text-secondary opacity-70" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-amber-500/85 dark:text-amber-400/85" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-amber-500/70 dark:text-amber-400/70" />
              )}
              <span className="truncate font-medium">{node.name}</span>
            </button>
            {isExpanded && node.children && (
              <div>{renderTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const file = node.file!;
      const isActive = file.id === activeFileId;
      const isDirty = dirtyFileIds.has(file.id);
      const isEditing = editingFileId === file.id;

      if (isEditing) {
        return (
          <div
            key={file.id}
            style={{ paddingLeft: `${depth * 12 + 14}px` }}
            className="flex items-center gap-1 py-1 pr-2 theme-bg-surface-2"
          >
            <input
              type="text"
              value={editingPathValue}
              onChange={(e) => setEditingPathValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleRenameSubmit(file);
                if (e.key === 'Escape') setEditingFileId(null);
              }}
              autoFocus
              className="w-full rounded border border-teal-500 theme-bg-surface-1 px-2 py-0.5 text-xs theme-text-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleRenameSubmit(file)}
              className="p-0.5 text-emerald-500 hover:text-emerald-400 cursor-pointer"
              title="Confirm Rename"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingFileId(null)}
              className="p-0.5 theme-text-secondary hover:theme-text-primary cursor-pointer"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }

      return (
        <div
          key={file.id}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          onClick={() => onSelectFile(file)}
          className={`group flex cursor-pointer items-center justify-between py-1.5 pr-2.5 text-xs transition-all ${
            isActive
              ? 'border-l-2 border-teal-500 theme-bg-selected theme-text-primary font-medium'
              : 'border-l-2 border-transparent theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {getExtensionBadge(node.name)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isDirty && (
              <span
                className="h-2 w-2 rounded-full bg-amber-400"
                title="Unsaved local edits"
              />
            )}
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFileId(file.id);
                  setEditingPathValue(file.path);
                }}
                title="Rename File"
                className="rounded p-0.5 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRequestDeleteFile(file);
                }}
                title="Delete File"
                className="rounded p-0.5 theme-text-secondary hover:bg-rose-500/20 hover:text-rose-500"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      );
    });
  };

  return (
    <aside className="flex h-full w-full flex-col theme-bg-surface-1 border-r theme-border select-none overflow-hidden transition-colors">
      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b theme-border theme-bg-surface-2/60">
        <span className="text-[11px] font-semibold uppercase tracking-wider theme-text-secondary">
          Workspace Files
        </span>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setErrorMsg(null);
          }}
          title="New File (supports nested paths like src/main.py)"
          className="inline-flex items-center gap-1 rounded-md border theme-border theme-bg-surface-2 px-2 py-0.5 text-[11px] font-medium theme-text-primary hover:border-teal-500/50 hover:theme-bg-elevated transition cursor-pointer shadow-xs"
        >
          <FilePlus className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
          <span>New</span>
        </button>
      </div>

      {/* Inline New File Input */}
      {isCreating && (
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="border-b theme-border theme-bg-surface-2 p-2.5 space-y-1.5"
        >
          <div className="flex items-center justify-between text-[10px] theme-text-secondary">
            <span>Path (e.g. <code className="text-teal-600 dark:text-teal-400 font-mono">src/app.py</code>)</span>
            <span className="font-mono text-[9px] opacity-70">Enter ↵ • Esc</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newFilePath}
              onChange={(e) => setNewFilePath(e.target.value)}
              placeholder="main.py or src/index.ts"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFilePath('');
                }
              }}
              className="w-full rounded-md border border-teal-500 theme-bg-surface-1 px-2.5 py-1 text-xs theme-text-primary placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500/30"
            />
            <button
              type="submit"
              className="rounded-md bg-teal-600 p-1.5 text-white hover:bg-teal-500 cursor-pointer"
              title="Create File"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreating(false);
                setNewFilePath('');
              }}
              className="rounded-md p-1.5 theme-text-secondary hover:theme-bg-surface-1 hover:theme-text-primary cursor-pointer"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-3 py-1.5 text-[11px] text-rose-500">
          {errorMsg}
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <FolderTree className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium theme-text-primary">Workspace is empty</p>
            <p className="mt-1 text-[11px] theme-text-secondary">
              Click <strong className="text-teal-600 dark:text-teal-400">+ New</strong> above to create your first file.
            </p>
          </div>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </aside>
  );
};
