import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { RotateCcw, Trash2, Users, Shield, Cpu, Terminal as TerminalIcon } from 'lucide-react';
import type { User } from '../types';

import { getApiBaseUrl } from '../config/endpoints';

const API_URL = getApiBaseUrl();

interface TerminalCollaborator {
  userId: string;
  username: string;
  color: string;
}

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

  const [connected, setConnected] = useState(false);
  const [shellType, setShellType] = useState<string>('Shell');
  const [isIsolated, setIsIsolated] = useState(false);
  const [collaborators, setCollaborators] = useState<TerminalCollaborator[]>([]);
  const [typingIndicator, setTypingIndicator] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize xterm and WebSocket connection
  useEffect(() => {
    if (!isVisible) return;

    // Create fresh xterm instance
    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 13,
      fontFamily: '"Cascadia Code", "Fira Code", "Consolas", Menlo, monospace',
      theme: {
        background: '#181818',
        foreground: '#e4e4e7',
        cursor: '#38bdf8',
        cursorAccent: '#181818',
        selectionBackground: 'rgba(56, 189, 248, 0.3)',
        black: '#27272a',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
        brightBlack: '#52525b',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
      convertEol: true,
      scrollback: 10000,
      allowTransparency: true,
    });

    terminalRef.current = term;

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    term.loadAddon(new WebLinksAddon());

    if (terminalContainerRef.current) {
      terminalContainerRef.current.innerHTML = '';
      term.open(terminalContainerRef.current);
      setTimeout(() => fitAddon.fit(), 50);
    }

    // Connect to multi-user collaborative terminal WebSocket
    const wsBase = API_URL.replace(/^http/, 'ws');
    const wsUrl = `${wsBase}/ws/terminal?roomId=${encodeURIComponent(roomId)}&userId=${encodeURIComponent(user.id)}&username=${encodeURIComponent(user.username || user.name || 'Anonymous')}&color=${encodeURIComponent(user.color || '#4ec9b0')}`;
    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);

      // Send initial dimensions
      if (term.cols && term.rows) {
        ws.send(JSON.stringify({
          action: 'terminal_resize',
          type: 'resize',
          cols: term.cols,
          rows: term.rows,
        }));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      term.write('\r\n\x1b[31m[Disconnected from shared terminal session]\x1b[0m\r\n');
    };

    ws.onerror = () => {
      setError('Connection failed. Verify API server is running.');
    };

    // Centralized Input Broker: Intercept keystrokes and broadcast via WebSocket
    const onDataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          action: 'terminal_input',
          type: 'input',
          payload: data,
          data,
          userId: user.id,
        }));
      }
    });

    // Listen for incoming messages from the authoritative PTY broker
    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        // 1. Cascading Output broadcast to all screens
        if (msg.action === 'terminal_output' || msg.type === 'output') {
          term.write(msg.payload ?? msg.data ?? '');
        }
        // 2. Scrollback History replay for late joiners
        else if (msg.action === 'terminal_history' || msg.type === 'history') {
          term.clear();
          term.write(msg.payload ?? msg.data ?? '');
        }
        // 3. Connect welcome
        else if (msg.action === 'terminal_connect' || msg.type === 'connect') {
          if (msg.shellType) setShellType(msg.shellType);
          if (typeof msg.isIsolated === 'boolean') setIsIsolated(msg.isIsolated);
          term.write(msg.payload ?? msg.data ?? '');
        }
        // 4. Team Presence list
        else if (msg.action === 'terminal_presence' || msg.type === 'presence') {
          if (Array.isArray(msg.users)) {
            setCollaborators(msg.users);
          }
        }
        // 5. Typing indicator from another collaborator
        else if (msg.action === 'terminal_typing' || msg.type === 'typing') {
          if (msg.userId !== user.id) {
            setTypingIndicator(`${msg.username} is typing...`);
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            typingTimeoutRef.current = setTimeout(() => {
              setTypingIndicator(null);
            }, 1800);
          }
        }
      } catch {
        // Fallback for raw text stream
        term.write(event.data);
      }
    };

    // Handle Resize
    const handleResize = () => {
      if (fitAddonRef.current && terminalRef.current) {
        fitAddonRef.current.fit();
        const cols = terminalRef.current.cols;
        const rows = terminalRef.current.rows;
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            action: 'terminal_resize',
            type: 'resize',
            cols,
            rows,
          }));
        }
      }
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      onDataDisposable.dispose();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      ws.close();
      term.dispose();
      terminalRef.current = null;
    };
  }, [roomId, user.id, user.username, user.color, isVisible]);

  // Fit when visible
  useEffect(() => {
    if (isVisible && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current?.fit(), 100);
    }
  }, [isVisible]);

  // Restart terminal session
  const handleRestart = useCallback(() => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(JSON.stringify({
        action: 'terminal_restart',
        type: 'restart',
      }));
    }
  }, []);

  // Clear local terminal display
  const handleClear = useCallback(() => {
    terminalRef.current?.clear();
  }, []);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#181818', height: '100%' }}>
      {/* Collaborative Terminal Control Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 14px',
        background: '#1f1f23',
        borderTop: '1px solid #2e2e32',
        borderBottom: '1px solid #2e2e32',
        fontSize: 12,
        userSelect: 'none',
      }}>
        {/* Left: Terminal Title & Shell Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#f4f4f5' }}>
            <TerminalIcon size={14} style={{ color: '#38bdf8' }} />
            <span>Shared Terminal</span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            padding: '2px 8px',
            background: isIsolated ? '#143828' : '#27272a',
            color: isIsolated ? '#4ade80' : '#a1a1aa',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 500,
          }}>
            {isIsolated ? <Shield size={12} /> : <Cpu size={12} />}
            <span>{shellType}</span>
          </div>

          {/* Typing Indicator */}
          {typingIndicator && (
            <span style={{ color: '#38bdf8', fontSize: 11, fontStyle: 'italic', animation: 'pulse 1.5s infinite' }}>
              ⌨ {typingIndicator}
            </span>
          )}
        </div>

        {/* Right: Presence, Actions & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Active Collaborators in Terminal */}
          {collaborators.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} style={{ color: '#71717a' }} />
              <div style={{ display: 'flex', gap: 3 }}>
                {collaborators.map((c) => (
                  <span
                    key={c.userId}
                    title={`${c.username} (${c.userId === user.id ? 'You' : 'Collaborator'})`}
                    style={{
                      display: 'inline-block',
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      background: c.color || '#4ec9b0',
                      color: '#000',
                      fontWeight: 700,
                      fontSize: 10,
                      textAlign: 'center',
                      lineHeight: '18px',
                      boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                    }}
                  >
                    {c.username.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              onClick={handleClear}
              title="Clear terminal screen"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '3px 6px',
                borderRadius: 4,
              }}
            >
              <Trash2 size={13} />
            </button>

            <button
              onClick={handleRestart}
              title="Restart shared terminal process"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#a1a1aa',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '3px 6px',
                borderRadius: 4,
              }}
            >
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Connection Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: connected ? '#22c55e' : '#ef4444',
              boxShadow: connected ? '0 0 6px #22c55e' : 'none',
            }} />
            <span style={{ color: connected ? '#4ade80' : '#f87171', fontWeight: 500 }}>
              {connected ? 'Live' : 'Offline'}
            </span>
            {error && <span style={{ color: '#f87171', fontSize: 11 }}>({error})</span>}
          </div>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalContainerRef}
        style={{
          flex: 1,
          position: 'relative',
          padding: '6px 8px',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}