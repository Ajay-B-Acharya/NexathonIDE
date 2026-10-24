import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FolderPlus,
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
  RefreshCw,
  ChevronsDownUp,
  Database,
  Palette,
  Terminal,
  Settings,
  Code2,
} from 'lucide-react';
import { FileTreeNode, WorkspaceFile } from '../types';

interface FileExplorerProps {
  files: WorkspaceFile[];
  emptyFolders?: Set<string>;
  activeFileId: string | null;
  dirtyFileIds: Set<string>;
  onSelectFile: (file: WorkspaceFile) => void;
  onCreateFile: (path: string) => Promise<void>;
  onCreateFolder?: (path: string) => Promise<void>;
  onRenameFile: (file: WorkspaceFile, newPath: string) => Promise<void>;
  onRenameFolder?: (oldPath: string, newPath: string) => Promise<void>;
  onRequestDeleteFile: (file: WorkspaceFile) => void;
  onRequestDeleteFolder?: (folderPath: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  workspaceName?: string;
}

/**
 * Builds a nested hierarchical tree from file paths and explicit empty folder paths.
 * Filters out internal .gitkeep files from display while ensuring their parent folders are preserved.
 */
function buildFileTree(files: WorkspaceFile[], customFolders: Set<string> = new Set()): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  // 1. First ensure all explicit folders exist in the tree
  for (const folderPath of customFolders) {
    const cleanFolder = folderPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!cleanFolder) continue;
    const parts = cleanFolder.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let existingNode = currentLevel.find((n) => n.name === part && n.type === 'folder');
      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type: 'folder',
          children: [],
        };
        currentLevel.push(existingNode);
      }
      if (existingNode.children) {
        currentLevel = existingNode.children;
      }
    }
  }

  // 2. Add all workspace files
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const isKeep = file.name === '.gitkeep' || file.path.endsWith('/.gitkeep');
    const parts = file.path.split('/').filter(Boolean);
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      // Filter out .gitkeep files from visible display; the parent folder was already created
      if (isFile && isKeep) {
        continue;
      }

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
      } else if (isFile) {
        existingNode.file = file;
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

/**
 * Returns VS Code-like colored icons matching file extensions.
 */
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
    case 'css':
    case 'scss':
    case 'less':
      return <Palette className="h-4 w-4 shrink-0 text-pink-500 dark:text-pink-400" />;
    case 'html':
    case 'htm':
      return <Code2 className="h-4 w-4 shrink-0 text-orange-500 dark:text-orange-400" />;
    case 'sql':
      return <Database className="h-4 w-4 shrink-0 text-purple-500 dark:text-purple-400" />;
    case 'sh':
    case 'bash':
    case 'zsh':
      return <Terminal className="h-4 w-4 shrink-0 text-green-500 dark:text-green-400" />;
    case 'env':
    case 'gitignore':
    case 'yaml':
    case 'yml':
      return <Settings className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-300" />;
    default:
      return <FileText className="h-4 w-4 shrink-0 theme-text-secondary" />;
  }
}

export const FileExplorer: React.FC<FileExplorerProps> = ({
  files,
  emptyFolders = new Set(),
  activeFileId,
  dirtyFileIds,
  onSelectFile,
  onCreateFile,
  onCreateFolder,
  onRenameFile,
  onRenameFolder,
  onRequestDeleteFile,
  onRequestDeleteFolder,
  onRefresh,
  isRefreshing = false,
  workspaceName = 'EXPLORER',
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(['src', 'components', 'utils'])
  );
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);

  // VS Code creation state: 'file' or 'folder' being created under parentPath
  const [creationState, setCreationState] = useState<{
    type: 'file' | 'folder';
    parentPath: string; // '' for root, or 'src', 'src/components', etc.
  } | null>(null);
  const [creationName, setCreationName] = useState('');

  // Editing (rename) state
  const [editingNode, setEditingNode] = useState<{
    type: 'file' | 'folder';
    idOrPath: string;
    value: string;
  } | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const creationInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const tree = useMemo(() => buildFileTree(files, emptyFolders), [files, emptyFolders]);

  useEffect(() => {
    if (creationState) {
      creationInputRef.current?.focus();
      creationInputRef.current?.select();
    }
  }, [creationState]);

  useEffect(() => {
    if (editingNode) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [editingNode]);

  const toggleFolder = (folderPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedFolderPath(folderPath);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) next.delete(folderPath);
      else next.add(folderPath);
      return next;
    });
  };

  const handleStartCreation = (type: 'file' | 'folder', parentPath: string = '') => {
    setErrorMsg(null);
    setCreationName('');
    setCreationState({ type, parentPath });
    if (parentPath) {
      setExpandedFolders((prev) => new Set(prev).add(parentPath));
    }
  };

  const handleCreationSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!creationState) return;

    const trimmed = creationName.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (!trimmed) {
      setCreationState(null);
      setCreationName('');
      return;
    }

    const fullPath = creationState.parentPath
      ? `${creationState.parentPath}/${trimmed}`
      : trimmed;

    try {
      setErrorMsg(null);
      if (creationState.type === 'file') {
        await onCreateFile(fullPath);
      } else {
        if (onCreateFolder) {
          await onCreateFolder(fullPath);
        } else {
          // Fallback if onCreateFolder not provided
          await onCreateFile(`${fullPath}/.gitkeep`);
        }
      }

      // Automatically expand all ancestor folders
      const segments = fullPath.split('/');
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        let acc = '';
        for (let i = 0; i < segments.length - (creationState.type === 'file' ? 1 : 0); i++) {
          acc = acc ? `${acc}/${segments[i]}` : segments[i];
          next.add(acc);
        }
        return next;
      });

      setCreationState(null);
      setCreationName('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : `Failed to create ${creationState.type}`);
    }
  };

  const handleRenameSubmit = async () => {
    if (!editingNode) return;
    const trimmed = editingNode.value.trim().replace(/^\/+/, '').replace(/\/+$/, '');

    if (!trimmed) {
      setEditingNode(null);
      return;
    }

    try {
      setErrorMsg(null);
      if (editingNode.type === 'file') {
        const file = files.find((f) => f.id === editingNode.idOrPath);
        if (file && trimmed !== file.path) {
          // If user typed only a file name, preserve directory path
          let newFullPath = trimmed;
          if (!trimmed.includes('/') && file.path.includes('/')) {
            const dir = file.path.substring(0, file.path.lastIndexOf('/'));
            newFullPath = `${dir}/${trimmed}`;
          }
          await onRenameFile(file, newFullPath);
        }
      } else {
        const oldFolderPath = editingNode.idOrPath;
        if (onRenameFolder && trimmed !== oldFolderPath) {
          let newFolderPath = trimmed;
          if (!trimmed.includes('/') && oldFolderPath.includes('/')) {
            const parentDir = oldFolderPath.substring(0, oldFolderPath.lastIndexOf('/'));
            newFolderPath = `${parentDir}/${trimmed}`;
          }
          await onRenameFolder(oldFolderPath, newFolderPath);
        }
      }
      setEditingNode(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to rename');
    }
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
    setSelectedFolderPath(null);
  };

  /**
   * Renders the inline creation input field at the appropriate level in the tree.
   */
  const renderInlineCreationInput = (depth: number) => {
    if (!creationState) return null;
    const isFolder = creationState.type === 'folder';

    return (
      <form
        onSubmit={(e) => void handleCreationSubmit(e)}
        style={{ paddingLeft: `${depth * 14 + 10}px` }}
        className="flex items-center gap-1.5 py-1 pr-2 theme-bg-surface-2 animate-fadeIn border-l-2 border-[#FF7057]"
      >
        <span className="shrink-0">
          {isFolder ? (
            <FolderOpen className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          ) : (
            getExtensionBadge(creationName || 'new.txt')
          )}
        </span>
        <input
          ref={creationInputRef}
          type="text"
          value={creationName}
          onChange={(e) => setCreationName(e.target.value)}
          placeholder={isFolder ? 'folder_name' : 'file_name.ts'}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleCreationSubmit();
            if (e.key === 'Escape') {
              setCreationState(null);
              setCreationName('');
            }
          }}
          onBlur={() => {
            // If empty, dismiss on blur; if text typed, submit
            if (!creationName.trim()) {
              setCreationState(null);
              setCreationName('');
            } else {
              void handleCreationSubmit();
            }
          }}
          className="w-full rounded border border-[#FF7057] theme-bg-surface-1 px-1.5 py-0.5 text-xs theme-text-primary focus:outline-none"
        />
        <button
          type="submit"
          className="p-0.5 text-emerald-500 hover:text-emerald-400 cursor-pointer"
          title="Confirm"
        >
          <Check className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => {
            setCreationState(null);
            setCreationName('');
          }}
          className="p-0.5 theme-text-secondary hover:theme-text-primary cursor-pointer"
          title="Cancel"
        >
          <X className="h-3 w-3" />
        </button>
      </form>
    );
  };

  /**
   * Recursively renders the tree nodes with full VS Code folder & file controls.
   */
  const renderTreeNodes = (nodes: FileTreeNode[], depth = 0): React.ReactNode => {
    return (
      <>
        {/* If creating at current folder parent level, display inline input at top */}
        {creationState && creationState.parentPath === '' && depth === 0 && renderInlineCreationInput(depth)}

        {nodes.map((node) => {
          if (node.type === 'folder') {
            const isExpanded = expandedFolders.has(node.path);
            const isSelected = selectedFolderPath === node.path;
            const isEditing = editingNode?.type === 'folder' && editingNode?.idOrPath === node.path;
            const isTargetOfCreation = creationState && creationState.parentPath === node.path;

            if (isEditing) {
              return (
                <div
                  key={`edit-folder-${node.path}`}
                  style={{ paddingLeft: `${depth * 14 + 10}px` }}
                  className="flex items-center gap-1.5 py-1 pr-2 theme-bg-surface-2"
                >
                  <FolderOpen className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={editingNode.value}
                    onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRenameSubmit();
                      if (e.key === 'Escape') setEditingNode(null);
                    }}
                    onBlur={() => void handleRenameSubmit()}
                    className="w-full rounded border border-[#FF7057] theme-bg-surface-1 px-1.5 py-0.5 text-xs theme-text-primary focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleRenameSubmit()}
                    className="p-0.5 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                    title="Confirm Rename"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingNode(null)}
                    className="p-0.5 theme-text-secondary hover:theme-text-primary cursor-pointer"
                    title="Cancel"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            }

            return (
              <div key={`folder-${node.path}`}>
                <div
                  onClick={(e) => toggleFolder(node.path, e)}
                  style={{ paddingLeft: `${depth * 14 + 10}px` }}
                  className={`group flex items-center justify-between py-1 pr-2 text-left text-xs transition cursor-pointer select-none ${
                    isSelected
                      ? 'theme-bg-surface-2 theme-text-primary'
                      : 'theme-text-primary hover:theme-bg-surface-2/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 theme-text-secondary opacity-70" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 theme-text-secondary opacity-70" />
                    )}
                    {isExpanded ? (
                      <FolderOpen className="h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Folder className="h-4 w-4 shrink-0 text-amber-500/80 dark:text-amber-400/80" />
                    )}
                    <span className="truncate font-medium">{node.name}</span>
                  </div>

                  {/* VS Code Hover Actions on Folder */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 pl-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCreation('file', node.path);
                      }}
                      title={`New File inside ${node.name}`}
                      className="rounded p-0.5 theme-text-secondary hover:theme-bg-surface-1 hover:text-[#FF7057] transition"
                    >
                      <FilePlus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartCreation('folder', node.path);
                      }}
                      title={`New Folder inside ${node.name}`}
                      className="rounded p-0.5 theme-text-secondary hover:theme-bg-surface-1 hover:text-amber-400 transition"
                    >
                      <FolderPlus className="h-3.5 w-3.5" />
                    </button>
                    {onRenameFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingNode({
                            type: 'folder',
                            idOrPath: node.path,
                            value: node.name,
                          });
                        }}
                        title={`Rename folder ${node.name}`}
                        className="rounded p-0.5 theme-text-secondary hover:theme-bg-surface-1 hover:theme-text-primary transition"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onRequestDeleteFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRequestDeleteFolder(node.path);
                        }}
                        title={`Delete folder ${node.name}`}
                        className="rounded p-0.5 theme-text-secondary hover:bg-rose-500/20 hover:text-rose-500 transition"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Subtree content with indentation guide */}
                {isExpanded && (
                  <div className="relative border-l border-white/5 dark:border-white/5 ml-3">
                    {/* Inline creation input inside this folder */}
                    {isTargetOfCreation && renderInlineCreationInput(depth + 1)}

                    {node.children && node.children.length > 0 ? (
                      renderTreeNodes(node.children, depth + 1)
                    ) : (
                      !isTargetOfCreation && (
                        <div
                          style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
                          className="py-1 text-[11px] font-mono theme-text-muted italic opacity-60"
                        >
                          (empty folder)
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          }

          const file = node.file!;
          const isActive = file.id === activeFileId;
          const isDirty = dirtyFileIds.has(file.id);
          const isEditing = editingNode?.type === 'file' && editingNode?.idOrPath === file.id;

          if (isEditing) {
            return (
              <div
                key={`edit-file-${file.id}`}
                style={{ paddingLeft: `${depth * 14 + 14}px` }}
                className="flex items-center gap-1.5 py-1 pr-2 theme-bg-surface-2"
              >
                {getExtensionBadge(file.name)}
                <input
                  ref={renameInputRef}
                  type="text"
                  value={editingNode.value}
                  onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void handleRenameSubmit();
                    if (e.key === 'Escape') setEditingNode(null);
                  }}
                  onBlur={() => void handleRenameSubmit()}
                  className="w-full rounded border border-[#FF7057] theme-bg-surface-1 px-1.5 py-0.5 text-xs theme-text-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleRenameSubmit()}
                  className="p-0.5 text-emerald-500 hover:text-emerald-400 cursor-pointer"
                  title="Confirm Rename"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingNode(null)}
                  className="p-0.5 theme-text-secondary hover:theme-text-primary cursor-pointer"
                  title="Cancel"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={`file-${file.id}`}
              style={{ paddingLeft: `${depth * 14 + 16}px` }}
              onClick={() => {
                onSelectFile(file);
                // Also update selected folder context to file's parent folder
                if (file.path.includes('/')) {
                  setSelectedFolderPath(file.path.substring(0, file.path.lastIndexOf('/')));
                } else {
                  setSelectedFolderPath(null);
                }
              }}
              className={`group flex cursor-pointer items-center justify-between py-1 pr-2 text-xs transition select-none ${
                isActive
                  ? 'border-l-2 border-[#FF7057] theme-bg-selected theme-text-primary font-medium'
                  : 'border-l-2 border-transparent theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {getExtensionBadge(node.name)}
                <span className="truncate">{node.name}</span>
              </div>

              <div className="flex items-center gap-1">
                {isDirty && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-400"
                    title="Unsaved local edits"
                  />
                )}
                {/* VS Code Hover Actions on File */}
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0 pl-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingNode({
                        type: 'file',
                        idOrPath: file.id,
                        value: file.name,
                      });
                    }}
                    title="Rename File"
                    className="rounded p-0.5 theme-text-secondary hover:theme-bg-surface-1 hover:theme-text-primary transition"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDeleteFile(file);
                    }}
                    title="Delete File"
                    className="rounded p-0.5 theme-text-secondary hover:bg-rose-500/20 hover:text-rose-500 transition"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </>
    );
  };

  return (
    <aside
      className="flex h-full w-full flex-col theme-bg-surface-1 border-r theme-border select-none overflow-hidden transition-colors"
      onClick={() => {
        // Clicking root background deselects folder
        setSelectedFolderPath(null);
      }}
    >
      {/* VS Code Explorer Action Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b theme-border theme-bg-surface-2/60 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="text-[11px] font-bold uppercase tracking-wider theme-text-secondary truncate">
            {workspaceName}
          </span>
          {selectedFolderPath && (
            <span
              className="text-[10px] font-mono text-[#FF7057] truncate max-w-[90px]"
              title={`Selected Folder: ${selectedFolderPath}`}
            >
              /{selectedFolderPath}
            </span>
          )}
        </div>

        {/* VS Code Action Bar */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => handleStartCreation('file', selectedFolderPath || '')}
            title={selectedFolderPath ? `New File inside /${selectedFolderPath}` : 'New File at Workspace Root'}
            className="rounded p-1 theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
          >
            <FilePlus className="h-3.5 w-3.5 text-[#FF7057]" />
          </button>
          <button
            type="button"
            onClick={() => handleStartCreation('folder', selectedFolderPath || '')}
            title={selectedFolderPath ? `New Folder inside /${selectedFolderPath}` : 'New Folder at Workspace Root'}
            className="rounded p-1 theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
          >
            <FolderPlus className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
          </button>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refresh Explorer"
              className="rounded p-1 theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#FF7057]' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={handleCollapseAll}
            title="Collapse Folders in Explorer"
            className="rounded p-1 theme-text-secondary hover:theme-text-primary hover:theme-bg-surface-2 transition cursor-pointer"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-500/10 border-b border-rose-500/30 px-3 py-1.5 text-[11px] text-rose-500 flex items-center justify-between">
          <span className="truncate">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="p-0.5 hover:text-rose-400"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* File Tree List */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 && !creationState ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7057]/15 text-[#FF7057] ring-1 ring-[#FF7057]/30 neu-button">
              <FolderTree className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold theme-text-primary">Workspace is empty</p>
            <p className="mt-1 text-[11px] theme-text-secondary max-w-[180px]">
              Use the toolbar buttons above to create files and folders.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStartCreation('file', '')}
                className="inline-flex items-center gap-1 rounded-md bg-[#FF7057] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#F26049] transition cursor-pointer neu-button"
              >
                <FilePlus className="h-3 w-3" />
                <span>New File</span>
              </button>
              <button
                type="button"
                onClick={() => handleStartCreation('folder', '')}
                className="inline-flex items-center gap-1 rounded-md border theme-border theme-bg-surface-2 px-2.5 py-1 text-[11px] font-medium theme-text-primary hover:theme-bg-surface-1 transition cursor-pointer"
              >
                <FolderPlus className="h-3 w-3" />
                <span>New Folder</span>
              </button>
            </div>
          </div>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </aside>
  );
};
