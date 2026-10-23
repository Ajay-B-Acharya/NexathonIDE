import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { RefreshCw, Terminal as TerminalIcon } from 'lucide-react';
import { ConnectionStatus, UserProfile } from '../types';

interface TerminalPanelProps {
  roomId: string;
  user: UserProfile;
  isVisible: boolean;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  roomId,
  user,
  isVisible,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  // Helper to safely close any active or connecting WebSocket
  const safelyCloseWebSocket = (ws: WebSocket | null) => {
    if (!ws) return;
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;

    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.close(1000, 'Normal Closure');
      } catch {}
    } else if (ws.readyState === WebSocket.CONNECTING) {
      // Avoid browser warning: "WebSocket is closed before the connection is established"
      ws.onopen = () => {
        try {
          ws.close(1000, 'Closed after connection established');
        } catch {}
      };
    }
  };

  const connectWebSocket = useCallback(() => {
    if (!isMountedRef.current || !roomId) return;

    if (reconnectTimerRef.current) {
      window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    if (wsRef.current) {
      safelyCloseWebSocket(wsRef.current);
      wsRef.current = null;
    }

    const baseWsUrl =
      (import.meta.env.VITE_TERMINAL_WS_URL as string) ||
      'ws://localhost:3001/ws/terminal';
    const wsUrl = `${baseWsUrl}?roomId=${encodeURIComponent(
      roomId
    )}&userId=${encodeURIComponent(user?.id || 'anonymous')}&username=${encodeURIComponent(
      user?.name || 'Developer'
    )}`;

    setStatus('connecting');
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[TerminalPanel] Failed to construct WebSocket:', err);
      setStatus('error');
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (!isMountedRef.current || wsRef.current !== ws) return;
      setStatus('connected');
      termRef.current?.writeln(
        `\x1b[38;2;16;185;129m● [Nexathon Cloud PTY] Connected to room ${roomId} as ${user?.name || 'Developer'}\x1b[0m\r\n`
      );

      if (fitAddonRef.current && termRef.current && containerRef.current) {
        try {
          fitAddonRef.current.fit();
          ws.send(
            JSON.stringify({
              type: 'resize',
              cols: termRef.current.cols,
              rows: termRef.current.rows,
            })
          );
        } catch {}
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!isMountedRef.current || wsRef.current !== ws) return;
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data) as { type?: string; data?: string; payload?: string };
          const textData = parsed.data ?? parsed.payload;
          if (typeof textData === 'string') {
            termRef.current?.write(textData);
            return;
          }
        } catch {
          // Raw stream fallback
        }
        termRef.current?.write(event.data);
      }
    };

    ws.onerror = () => {
      if (!isMountedRef.current || wsRef.current !== ws) return;
      setStatus('error');
    };

    ws.onclose = (event) => {
      if (!isMountedRef.current || wsRef.current !== ws) return;
      setStatus('disconnected');

      const reasonMsg = event.reason ? ` (${event.reason})` : '';
      termRef.current?.writeln(
        `\r\n\x1b[33m[Nexathon Cloud PTY] Connection closed${reasonMsg}. Reconnecting in 4s...\x1b[0m`
      );

      reconnectTimerRef.current = window.setTimeout(() => {
        if (isMountedRef.current) {
          connectWebSocket();
        }
      }, 4000);
    };
  }, [roomId, user?.id, user?.name]);

  // Terminal lifecycle (mounts once)
  useEffect(() => {
    isMountedRef.current = true;
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      theme: {
        background: '#090a0f',
        foreground: '#e2e8f0',
        cursor: '#818cf8',
        selectionBackground: '#6366f144',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    try {
      fitAddon.fit();
    } catch {}

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const dataDisposable = term.onData((data) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'input', data }));
      }
    });

    const resizeDisposable = term.onResize(({ cols, rows }) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && containerRef.current && containerRef.current.clientWidth > 0) {
        try {
          fitAddonRef.current.fit();
        } catch {}
      }
    });

    resizeObserver.observe(containerRef.current);
    connectWebSocket();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      resizeObserver.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      safelyCloseWebSocket(wsRef.current);
      wsRef.current = null;
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connectWebSocket]);

  useEffect(() => {
    if (isVisible && fitAddonRef.current && containerRef.current && containerRef.current.clientWidth > 0) {
      const timer = window.setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch {}
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [isVisible]);

  return (
    <div className="flex h-full flex-col bg-[#090a0f] overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#0f121d] px-3.5 py-1.5">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <TerminalIcon className="h-3.5 w-3.5 text-indigo-400" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">
            Cloud Node-PTY Terminal
          </span>
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                : status === 'connecting'
                ? 'bg-amber-400 animate-pulse'
                : 'bg-rose-400'
            }`}
          />
          <span className="text-[11px] text-slate-400 capitalize">{status}</span>
        </div>

        <button
          type="button"
          onClick={connectWebSocket}
          className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-[#141824] px-2.5 py-0.5 text-[11px] text-slate-200 hover:bg-[#1c2234] transition cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Reconnect</span>
        </button>
      </div>

      <div ref={containerRef} className="flex-1 w-full overflow-hidden p-2" />
    </div>
  );
};
