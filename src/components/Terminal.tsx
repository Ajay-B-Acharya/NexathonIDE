import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { AttachAddon } from '@xterm/addon-attach';
import type { User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface TerminalProps {
  roomId: string;
  user: User;
  isVisible: boolean;
}

export function TerminalComponent({ roomId, user, isVisible }: TerminalProps) {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const attachAddonRef = useRef<any>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isVisible || terminalRef.current) return;
    
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#ffffff',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      convertEol: true,
      scrollback: 10000,
    });
    
    terminalRef.current = term;
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;
    
    term.loadAddon(new WebLinksAddon());
    
    if (terminalContainerRef.current) {
      term.open(terminalContainerRef.current);
      fitAddon.fit();
    }
    
    const wsUrl = `${API_URL.replace('http', 'ws')}/ws/terminal?roomId=${roomId}&userId=${user.id}`;
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;
    
    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };
    
    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n\x1b[31mTerminal disconnected\x1b[0m\r\n');
    };
    
    ws.onerror = () => {
      setError('Failed to connect to terminal');
    };
    
    const attachAddon = new AttachAddon(ws);
    term.loadAddon(attachAddon);
    attachAddonRef.current = attachAddon;
    
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const cols = terminalRef.current.cols;
        const rows = terminalRef.current.rows;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'resize', cols, rows }));
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
      terminalRef.current = null;
    };
  }, [roomId, user.id, isVisible]);
  
  useEffect(() => {
    if (fitAddonRef.current && terminalRef.current && terminalContainerRef.current) {
      fitAddonRef.current.fit();
    }
  }, [isVisible]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 12px',
        background: '#252526',
        borderTop: '1px solid #333',
        fontSize: 12,
      }}>
        <span>Terminal</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: connected ? '#4ec9b0' : '#f44747',
          }} />
          <span style={{ color: connected ? '#4ec9b0' : '#f44747' }}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          {error && <span style={{ color: '#f44747', fontSize: 11 }}>{error}</span>}
        </div>
      </div>
      <div ref={terminalContainerRef} style={{ flex: 1, position: 'relative' }} />
    </div>
  );
}