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
      return <FileCode className="h-4 w-4 shrink-0 text-amber-400" />;
    case 'ts':
    case 'tsx':
      return <FileCode className="h-4 w-4 shrink-0 text-blue-400" />;
    case 'js':
    case 'jsx':
      return <FileCode className="h-4 w-4 shrink-0 text-yellow-300" />;
    case 'json':
      return <FileJson className="h-4 w-4 shrink-0 text-emerald-400" />;
    case 'md':
      return <FileText className="h-4 w-4 shrink-0 text-sky-400" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 text-slate-400" />;
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
              className="flex w-full items-center gap-1.5 py-1.5 pr-2 text-left text-xs text-slate-300 hover:bg-[#141824] hover:text-white transition cursor-pointer"
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              )}
              {isExpanded ? (
                <FolderOpen className="h-4 w-4 shrink-0 text-indigo-400" />
              ) : (
                <Folder className="h-4 w-4 shrink-0 text-indigo-400/80" />
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
            className="flex items-center gap-1 py-1 pr-2 bg-[#161b2a]"
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
              className="w-full rounded border border-indigo-500 bg-[#090a0f] px-2 py-0.5 text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleRenameSubmit(file)}
              className="p-0.5 text-emerald-400 hover:text-emerald-300"
              title="Confirm Rename"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setEditingFileId(null)}
              className="p-0.5 text-slate-400 hover:text-white"
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
              ? 'border-l-2 border-indigo-500 bg-[#161b2a] text-white font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
              : 'border-l-2 border-transparent text-slate-400 hover:bg-[#141824] hover:text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {getExtensionBadge(node.name)}
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {isDirty && (
              <span
                className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
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
                className="rounded p-0.5 text-slate-400 hover:bg-white/10 hover:text-white"
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
                className="rounded p-0.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400"
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
    <aside className="flex h-full w-full flex-col bg-[#0f121d] border-r border-white/10 select-none overflow-hidden">
      {/* Explorer Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-[#090a0f]/40">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Workspace Files
        </span>
        <button
          type="button"
          onClick={() => {
            setIsCreating(true);
            setErrorMsg(null);
          }}
          title="New File (supports nested paths like src/main.py)"
          className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#141824] px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:border-indigo-500/50 hover:bg-[#1c2234] hover:text-white transition cursor-pointer"
        >
          <FilePlus className="h-3.5 w-3.5 text-indigo-400" />
          <span>New</span>
        </button>
      </div>

      {/* Inline New File Input */}
      {isCreating && (
        <form
          onSubmit={(e) => void handleCreateSubmit(e)}
          className="border-b border-white/10 bg-[#141824] p-2.5 space-y-1.5"
        >
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>Path (e.g. <code className="text-indigo-300">src/app.py</code>)</span>
            <span className="font-mono text-[9px] text-slate-500">Enter ↵ • Esc</span>
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
              className="w-full rounded-md border border-indigo-500 bg-[#090a0f] px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
            <button
              type="submit"
              className="rounded-md bg-indigo-600 p-1.5 text-white hover:bg-indigo-500"
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
              className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              title="Cancel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      )}

      {errorMsg && (
        <div className="bg-rose-950/70 border-b border-rose-800 px-3 py-1.5 text-[11px] text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {tree.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-slate-500">
              <FolderTree className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-slate-300">Workspace is empty</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Click <strong className="text-indigo-400">+ New</strong> above to create your first file.
            </p>
          </div>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </aside>
  );
};
