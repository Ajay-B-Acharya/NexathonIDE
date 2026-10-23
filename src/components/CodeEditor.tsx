import { useEffect, useRef, useState, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { MonacoBinding } from 'y-monaco';
import { useCollaborativeEditor } from '../hooks/useCollaborativeEditor';
import type { WorkspaceFile, User } from '../types';

interface CodeEditorProps {
  roomId: string;
  user: User;
  file: WorkspaceFile | null;
  onContentChange: (content: string) => void;
}

export function CodeEditor({ roomId, user, file, onContentChange }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [language, setLanguage] = useState('plaintext');
  const [isModelReady, setIsModelReady] = useState(false);
  
  const {
    doc,
    provider,
    awareness,
    connectedUsers,
    isConnected,
    bindEditor,
    unbindEditor,
    updateCursor,
    getUserColor,
  } = useCollaborativeEditor(roomId, user);

  useEffect(() => {
    if (file) {
      setLanguage(file.language);
    }
  }, [file]);

  const handleEditorDidMount = useCallback((editor: any, monacoInstance: any) => {
    editorRef.current = editor;
    
    if (file && doc) {
      const model = editor.getModel();
      if (model) {
        monacoInstance.editor.setModelLanguage(model, file.language);
        
        if (!isModelReady) {
          const yText = doc.getText('codemirror');
          const binding = new MonacoBinding(
            yText,
            model,
            new Set([provider?.awareness.clientID]),
            provider?.awareness
          );
          
          editor.onDidChangeCursorPosition((e: any) => {
            if (e.position) {
              updateCursor({
                lineNumber: e.position.lineNumber,
                column: e.position.column,
              }, e.selection ? {
                startLineNumber: e.selection.startLineNumber,
                startColumn: e.selection.startColumn,
                endLineNumber: e.selection.endLineNumber,
                endColumn: e.selection.endColumn,
              } : undefined);
            }
          });
          
          model.onDidChangeContent(() => {
            onContentChange(model.getValue());
          });
          
          setIsModelReady(true);
        }
      }
    }
  }, [file, doc, provider, updateCursor, onContentChange]);

  const handleEditorWillUnmount = useCallback(() => {
    unbindEditor();
    setIsModelReady(false);
  }, [unbindEditor]);

  useEffect(() => {
    if (!editorRef.current || !file || !doc) return;
    
    const model = editorRef.current.getModel();
    if (!model) return;
    
    monaco.editor.setModelLanguage(model, file.language);
    
    const yText = doc.getText('codemirror');
    const newContent = file.content;
    const currentContent = yText.toString();
    
    if (newContent !== currentContent) {
      const binding = new MonacoBinding(
        yText,
        model,
        new Set([provider?.awareness.clientID]),
        provider?.awareness
      );
      
      yText.delete(0, yText.length);
      yText.insert(0, newContent);
      
      binding.destroy();
    }
  }, [file, doc, provider]);

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e1e1e', color: '#888' }}>
        <div style={{ textAlign: 'center' }}>
          <p>No file selected</p>
          <p style={{ fontSize: 12 }}>Select a file from the explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#252526',
        borderBottom: '1px solid #333',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{file.path}</span>
          <span style={{ color: isConnected ? '#4ec9b0' : '#f44747' }}>
            {isConnected ? '● Connected' : '○ Disconnected'}
          </span>
          <span style={{ color: '#888' }}>{connectedUsers.length} user{connectedUsers.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{
              background: '#333',
              border: '1px solid #444',
              color: '#fff',
              padding: '2px 8px',
              borderRadius: 3,
              fontSize: 11,
            }}
          >
            <option value="plaintext">Plain Text</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="json">JSON</option>
            <option value="markdown">Markdown</option>
            <option value="sql">SQL</option>
            <option value="shell">Shell</option>
            <option value="yaml">YAML</option>
          </select>
        </div>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={file.content}
          onMount={handleEditorDidMount}
          onChange={(value) => onContentChange(value || '')}
          beforeMount={handleEditorWillUnmount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            wordWrap: 'on',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true },
            renderLineHighlight: 'all',
            cursorBlinking: 'smooth',
            smoothScrolling: true,
          }}
        />
        
        {connectedUsers.map(u => {
          if (u.id === user.id || !u.cursor?.position) return null;
          const color = getUserColor(u.id);
          return (
            <RemoteCursor
              key={u.id}
              user={u}
              color={color}
              editor={editorRef.current}
            />
          );
        })}
      </div>
    </div>
  );
}

function RemoteCursor({ user, color, editor }: { user: any; color: string; editor: any }) {
  const [position, setPosition] = useState<{ top: number; left: number; height: number } | null>(null);
  
  useEffect(() => {
    if (!editor || !user.cursor?.position) return;
    
    const updatePosition = () => {
      const pos = user.cursor!.position;
      const coords = editor.getPositionCoordinates({ lineNumber: pos.lineNumber, column: pos.column });
      if (coords) {
        setPosition({
          top: coords.top,
          left: coords.left,
          height: coords.height,
        });
      }
    };
    
    updatePosition();
    const disposable = editor.onDidScrollChange(updatePosition);
    return () => disposable.dispose();
  }, [editor, user.cursor]);
  
  if (!position) return null;
  
  return (
    <div
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        width: 2,
        height: position.height,
        background: color,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -18,
          left: -2,
          background: color,
          color: '#fff',
          padding: '1px 4px',
          borderRadius: 2,
          fontSize: 10,
          whiteSpace: 'nowrap',
          fontFamily: 'monospace',
        }}
      >
        {user.username}
      </div>
    </div>
  );
}