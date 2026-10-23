import { useState, useEffect, useCallback } from 'react';
import type { WorkspaceFile } from '../types';
import { FolderOpen, File, Plus, Trash2, FileText, ChevronRight, ChevronDown } from 'lucide-react';

interface FileExplorerProps {
  roomId: string;
  files: WorkspaceFile[];
  onFileSelect: (file: WorkspaceFile) => void;
  onFileCreate: (path: string) => void;
  onFileDelete: (path: string) => void;
  activeFilePath?: string;
}

export function FileExplorer({ roomId, files, onFileSelect, onFileCreate, onFileDelete, activeFilePath }: FileExplorerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['']));
  const [creatingFile, setCreatingFile] = useState<{ parentPath: string } | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const buildFileTree = useCallback((files: WorkspaceFile[]) => {
    const tree: any = { name: '', path: '', children: [], isFolder: true };
    
    files.forEach(file => {
      const parts = file.path.split('/').filter(Boolean);
      let current = tree;
      
      parts.forEach((part, index) => {
        const isFile = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        let child = current.children.find((c: any) => c.name === part);
        if (!child) {
          child = {
            name: part,
            path: currentPath,
            children: isFile ? [] : [],
            isFolder: !isFile,
            file: isFile ? file : null,
          };
          current.children.push(child);
        }
        current = child;
      });
    });
    
    const sortChildren = (node: any) => {
      node.children.sort((a: any, b: any) => {
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach((child: any) => {
        if (child.isFolder) sortChildren(child);
      });
    };
    
    sortChildren(tree);
    return tree.children;
  }, []);

  const fileTree = buildFileTree(files);

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleCreateFile = (parentPath: string) => {
    setCreatingFile({ parentPath });
    setNewFileName('');
  };

  const confirmCreateFile = () => {
    if (!creatingFile || !newFileName.trim()) return;
    const fullPath = creatingFile.parentPath ? `${creatingFile.parentPath}/${newFileName.trim()}` : newFileName.trim();
    onFileCreate(fullPath);
    setCreatingFile(null);
    setNewFileName('');
  };

  const renderTree = (nodes: any[], depth = 0) => (
    <ul style={{ paddingLeft: depth * 16 }}>
      {nodes.map((node) => (
        <li key={node.path} style={{ listStyle: 'none' }}>
          {node.isFolder ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                userSelect: 'none',
              }}
              onClick={() => toggleFolder(node.path)}
            >
              {expandedFolders.has(node.path) ? (
                <ChevronDown size={14} style={{ marginRight: 4 }} />
              ) : (
                <ChevronRight size={14} style={{ marginRight: 4 }} />
              )}
              <FolderOpen size={16} style={{ marginRight: 6, color: '#f0c674' }} />
              <span style={{ flex: 1 }}>{node.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleCreateFile(node.path); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 14,
                }}
                title="New file"
              >
                <Plus size={14} />
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '4px 8px',
                borderRadius: 4,
                cursor: 'pointer',
                background: activeFilePath === node.path ? '#2d2d2d' : 'transparent',
                color: activeFilePath === node.path ? '#fff' : '#ddd',
              }}
              onClick={() => onFileSelect(node.file)}
              onContextMenu={(e) => {
                e.preventDefault();
                if (confirm(`Delete ${node.file.path}?`)) onFileDelete(node.file.path);
              }}
            >
              <FileText size={16} style={{ marginRight: 6, color: '#e8e8e8' }} />
              <span style={{ flex: 1, fontSize: 13 }}>{node.name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); if (confirm(`Delete ${node.file.path}?`)) onFileDelete(node.file.path); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '2px 6px',
                  borderRadius: 3,
                  fontSize: 14,
                }}
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
          {node.isFolder && expandedFolders.has(node.path) && (
            <>{renderTree(node.children, depth + 1)}</>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', background: '#1e1e1e', color: '#ddd' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>EXPLORER</h3>
          <button
            onClick={() => handleCreateFile('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#888',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 3,
            }}
            title="New file"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
      
      {creatingFile && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid #333', background: '#252526' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <FileText size={16} style={{ color: '#888' }} />
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmCreateFile(); if (e.key === 'Escape') setCreatingFile(null); }}
              placeholder="File name"
              style={{
                flex: 1,
                background: '#333',
                border: '1px solid #444',
                color: '#fff',
                padding: '4px 8px',
                borderRadius: 3,
                fontSize: 13,
                outline: 'none',
              }}
              autoFocus
            />
            <button onClick={confirmCreateFile} style={{ padding: '4px 8px', fontSize: 12 }}>Create</button>
            <button onClick={() => setCreatingFile(null)} style={{ padding: '4px 8px', fontSize: 12 }}>Cancel</button>
          </div>
        </div>
      )}
      
      <div style={{ flex: 1, overflow: 'auto', padding: '8px' }}>
        {renderTree(fileTree)}
        {files.length === 0 && (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            <FolderOpen size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 13 }}>No files yet</p>
            <button
              onClick={() => handleCreateFile('')}
              style={{ marginTop: 8, padding: '6px 12px', fontSize: 12, background: '#0e639c', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer' }}
            >
              Create first file
            </button>
          </div>
        )}
      </div>
    </div>
  );
}