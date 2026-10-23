import { useState, useEffect, useCallback, useRef } from 'react';
import { CodeEditor } from './CodeEditor';
import { FileExplorer } from './FileExplorer';
import { TerminalComponent } from './Terminal';
import { ExecutionPanel } from './ExecutionPanel';
import { AIDebugPanel } from './AIDebugPanel';
import { Layout, Menu, X, ChevronLeft, ChevronRight, Terminal as TerminalIcon, Bug, Play, Settings, Users, Globe, Save } from 'lucide-react';
import type { WorkspaceFile, User, Room } from '../types';
import { useCollaborativeEditor } from '../hooks/useCollaborativeEditor';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface IDELayoutProps {
  roomId: string;
  user: User;
  room: Room;
}

export function IDELayout({ roomId, user, room }: IDELayoutProps) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [activeFile, setActiveFile] = useState<WorkspaceFile | null>(null);
  const [showExplorer, setShowExplorer] = useState(true);
  const [showTerminal, setShowTerminal] = useState(false);
  const [bottomPanel, setBottomPanel] = useState<'execution' | 'ai' | 'terminal' | null>('execution');
  const [bottomPanelHeight, setBottomPanelHeight] = useState(300);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [connectedUsers, setConnectedUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const resizeRef = useRef<HTMLDivElement | null>(null);
  const isResizing = useRef(false);

  const {
    connectedUsers: collabUsers,
    isConnected,
    saveFile,
    createFile,
  } = useCollaborativeEditor(roomId, user);

  useEffect(() => {
    setConnectedUsers(collabUsers);
  }, [collabUsers]);

  const loadFiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/files`);
      if (res.ok) {
        const data = await res.json();
        setFiles(data);
        if (data.length > 0 && !activeFile) {
          setActiveFile(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }, [roomId, activeFile]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleFileSelect = useCallback((file: WorkspaceFile) => {
    setActiveFile(file);
    setExecutionError(null);
  }, []);

  const handleFileCreate = useCallback(async (path: string) => {
    try {
      await createFile(path);
      loadFiles();
    } catch (err) {
      console.error('Failed to create file:', err);
      alert('Failed to create file');
    }
  }, [createFile, loadFiles]);

  const handleFileDelete = useCallback(async (path: string) => {
    try {
      const res = await fetch(`${API_URL}/api/rooms/${roomId}/files/${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        loadFiles();
        if (activeFile?.path === path) {
          setActiveFile(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete file:', err);
      alert('Failed to delete file');
    }
  }, [roomId, loadFiles, activeFile]);

  const handleContentChange = useCallback((content: string) => {
    if (activeFile) {
      setActiveFile(prev => prev ? { ...prev, content } : null);
    }
  }, [activeFile]);

  const handleSave = useCallback(async () => {
    if (!activeFile) return;
    setSaving(true);
    try {
      await saveFile(activeFile.path, activeFile.content);
      setSaving(false);
    } catch (err) {
      console.error('Failed to save:', err);
      setSaving(false);
      alert('Failed to save file');
    }
  }, [activeFile, saveFile]);

  const handleExecutionComplete = useCallback((result: any) => {
    if (result.error) {
      setExecutionError(result.error);
      setBottomPanel('ai');
    } else {
      setExecutionError(null);
    }
  }, []);

  const handleApplyFix = useCallback((fixedCode: string) => {
    if (activeFile) {
      setActiveFile({ ...activeFile, content: fixedCode });
      handleSave();
    }
  }, [activeFile, handleSave]);

  const startResize = (e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizing.current || !resizeRef.current) return;
    const containerHeight = resizeRef.current.parentElement?.clientHeight || 600;
    const newHeight = containerHeight - e.clientY;
    setBottomPanelHeight(Math.max(150, Math.min(containerHeight - 100, newHeight)));
  };

  const stopResize = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh', 
      background: '#1e1e1e', 
      color: '#ddd',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        background: '#252526',
        borderBottom: '1px solid #333',
        height: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setShowExplorer(!showExplorer)}
            style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', padding: '4px' }}
            title={showExplorer ? 'Hide Explorer' : 'Show Explorer'}
          >
            {showExplorer ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Layout size={18} style={{ color: '#4ec9b0' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>{room.name}</span>
            <span style={{ 
              padding: '2px 8px', 
              background: isConnected ? '#1a3a2e' : '#3a1a1a', 
              color: isConnected ? '#4ec9b0' : '#f44747',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 500,
            }}>
              {isConnected ? '● Connected' : '○ Offline'}
            </span>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {connectedUsers.slice(0, 5).map((u, i) => (
              <div
                key={u.id}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: u.color,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  marginLeft: i > 0 ? -8 : 0,
                  border: '2px solid #252526',
                  zIndex: 5 - i,
                }}
                title={u.username}
              >
                {u.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {connectedUsers.length > 5 && (
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: '#333',
                color: '#888',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                marginLeft: -8,
                border: '2px solid #252526',
              }}>
                +{connectedUsers.length - 5}
              </div>
            )}
          </div>
          
          <button
            onClick={handleSave}
            disabled={saving || !activeFile}
            style={{
              padding: '6px 12px',
              background: saving ? '#333' : '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: saving || !activeFile ? 'not-allowed' : 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {showExplorer && (
          <FileExplorer
            roomId={roomId}
            files={files}
            onFileSelect={handleFileSelect}
            onFileCreate={handleFileCreate}
            onFileDelete={handleFileDelete}
            activeFilePath={activeFile?.path}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <CodeEditor
            roomId={roomId}
            user={user}
            file={activeFile}
            onContentChange={handleContentChange}
          />

          <div
            ref={resizeRef}
            style={{
              height: 4,
              background: '#333',
              cursor: 'row-resize',
              position: 'relative',
            }}
            onMouseDown={startResize}
          >
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 30,
              height: 4,
              background: '#444',
              borderRadius: 2,
            }} />
          </div>

          <div style={{ 
            height: bottomPanelHeight, 
            display: 'flex', 
            borderTop: '1px solid #333',
            background: '#1e1e1e',
          }}>
            <div style={{
              width: 40,
              background: '#252526',
              borderRight: '1px solid #333',
              display: 'flex',
              flexDirection: 'column',
            }}>
              <button
                onClick={() => setBottomPanel(p => p === 'execution' ? null : 'execution')}
                style={{
                  padding: '10px',
                  background: bottomPanel === 'execution' ? '#0e639c' : 'transparent',
                  border: 'none',
                  color: bottomPanel === 'execution' ? '#fff' : '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderBottom: '1px solid #333',
                }}
                title="Execution"
              >
                <Play size={16} />
                <span style={{ fontSize: 9 }}>Run</span>
              </button>
              <button
                onClick={() => setBottomPanel(p => p === 'ai' ? null : 'ai')}
                style={{
                  padding: '10px',
                  background: bottomPanel === 'ai' ? '#0e639c' : 'transparent',
                  border: 'none',
                  color: bottomPanel === 'ai' ? '#fff' : '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  borderBottom: '1px solid #333',
                }}
                title="AI Debug"
              >
                <Bug size={16} />
                <span style={{ fontSize: 9 }}>AI</span>
              </button>
              <button
                onClick={() => setBottomPanel(p => p === 'terminal' ? null : 'terminal')}
                style={{
                  padding: '10px',
                  background: bottomPanel === 'terminal' ? '#0e639c' : 'transparent',
                  border: 'none',
                  color: bottomPanel === 'terminal' ? '#fff' : '#888',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                }}
                title="Terminal"
              >
                <TerminalIcon size={16} />
                <span style={{ fontSize: 9 }}>Term</span>
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {bottomPanel === 'execution' && (
                <ExecutionPanel
                  file={activeFile ? { path: activeFile.path, content: activeFile.content, language: activeFile.language } : null}
                  onExecutionComplete={handleExecutionComplete}
                />
              )}
              {bottomPanel === 'ai' && (
                <AIDebugPanel
                  file={activeFile ? { path: activeFile.path, content: activeFile.content, language: activeFile.language } : null}
                  executionError={executionError || undefined}
                  onApplyFix={handleApplyFix}
                />
              )}
              {bottomPanel === 'terminal' && (
                <TerminalComponent roomId={roomId} user={user} isVisible={true} />
              )}
              {!bottomPanel && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
                  <p>Select a panel from the left</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}