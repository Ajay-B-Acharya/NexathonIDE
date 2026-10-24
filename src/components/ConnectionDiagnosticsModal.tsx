import React, { useState, useEffect } from 'react';
import {
  X,
  Activity,
  Copy,
  Check,
  RefreshCw,
  Radio,
  Users,
} from 'lucide-react';
import { getEndpointDiagnostics, EndpointConfig } from '../config/endpoints';
import { CollaboratorPresence, ConnectionStatus, UserProfile } from '../types';

interface ConnectionDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  activeFilePath?: string;
  connectionStatus: ConnectionStatus;
  isDocumentSynced: boolean;
  collaborators: CollaboratorPresence[];
  currentUser: UserProfile;
  lastWsUrl?: string;
  onForceReconnect?: () => void;
}

export const ConnectionDiagnosticsModal: React.FC<ConnectionDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  roomId,
  activeFilePath = 'untitled',
  connectionStatus,
  isDocumentSynced,
  collaborators,
  currentUser,
  lastWsUrl,
  onForceReconnect,
}) => {
  const [endpoints, setEndpoints] = useState<EndpointConfig>(getEndpointDiagnostics());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEndpoints(getEndpointDiagnostics());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const copyToClipboard = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestLatency = () => {
    setIsPinging(true);
    const start = performance.now();
    // Test WebSocket reachability to active endpoint
    const targetWs = lastWsUrl || endpoints.yjsWsUrl;
    try {
      const probe = new WebSocket(`${targetWs}/__latency_probe__`);
      const timeout = setTimeout(() => {
        try { probe.close(); } catch {}
        setPingMs(Math.round(performance.now() - start));
        setIsPinging(false);
      }, 1500);

      probe.onopen = () => {
        clearTimeout(timeout);
        const rtt = Math.round(performance.now() - start);
        setPingMs(rtt);
        setIsPinging(false);
        try { probe.close(); } catch {}
      };

      probe.onerror = () => {
        clearTimeout(timeout);
        setPingMs(null);
        setIsPinging(false);
      };
    } catch {
      setIsPinging(false);
      setPingMs(null);
    }
  };

  const fullDocRoom = `${roomId}:${activeFilePath.replace(/^\/+/, '')}`;
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#E9DECE] dark:border-[#242424] bg-[#FFF9F0] dark:bg-[#000000] p-6 neu-card text-[#302820] dark:text-[#FFFFFF] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E9DECE] dark:border-[#242424] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7057]/15 text-[#FF7057] border border-[#FF7057]/30 neu-button">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#302820] dark:text-[#FFFFFF] flex items-center gap-2">
                Collaboration Diagnostics
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-[#EFE3D2] dark:bg-[#111111] border border-[#E9DECE] dark:border-[#242424] text-[#756858] dark:text-[#B3B3B3]">
                  Dev Mode
                </span>
              </h2>
              <p className="text-xs text-[#756858] dark:text-[#808080]">
                Live network telemetry, resolved endpoints & sync state
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#756858] dark:text-[#808080] hover:bg-[#F1E8DA] dark:hover:bg-[#171717] hover:text-[#302820] dark:hover:text-[#FFFFFF] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="mt-5 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Status summary banner */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-3">
              <div className="text-[11px] text-[#756858] dark:text-[#808080]">WebSocket Transport</div>
              <div className="mt-1 flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Connected</span>
                  </>
                ) : connectionStatus === 'connecting' ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-medium text-amber-500">Connecting...</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-medium text-rose-500">Disconnected</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-3">
              <div className="text-[11px] text-[#756858] dark:text-[#808080]">CRDT Document Sync</div>
              <div className="mt-1 flex items-center gap-2">
                {isDocumentSynced ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Synchronized</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 text-amber-500 animate-spin" />
                    <span className="text-xs font-medium text-amber-500">Syncing...</span>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-3">
              <div className="text-[11px] text-[#756858] dark:text-[#808080]">Active Peers</div>
              <div className="mt-1 flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#FF7057]" />
                <span className="text-xs font-medium text-[#302820] dark:text-[#FFFFFF]">
                  {collaborators.length} collaborator{collaborators.length === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          </div>

          {/* Network Endpoints Table */}
          <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-4 space-y-3">
            <h3 className="text-xs font-medium text-[#302820] dark:text-[#FFFFFF] uppercase tracking-wider">
              Network Routing & Endpoints
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[#E9DECE] dark:border-[#242424]">
                <span className="text-[#756858] dark:text-[#808080]">Frontend Origin:</span>
                <div className="flex items-center gap-2">
                  <code className="text-[#302820] dark:text-[#FFFFFF] font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424]">
                    {endpoints.origin}
                  </code>
                  <button
                    onClick={() => copyToClipboard('origin', endpoints.origin)}
                    className="text-[#756858] dark:text-[#808080] hover:text-[#302820] dark:hover:text-[#FFFFFF] cursor-pointer"
                  >
                    {copiedKey === 'origin' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#E9DECE] dark:border-[#242424]">
                <span className="text-[#756858] dark:text-[#808080]">Resolved Yjs WebSocket:</span>
                <div className="flex items-center gap-2">
                  <code className="text-emerald-600 dark:text-emerald-400 font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424]">
                    {lastWsUrl || endpoints.yjsWsUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard('ws', lastWsUrl || endpoints.yjsWsUrl)}
                    className="text-[#756858] dark:text-[#808080] hover:text-[#302820] dark:hover:text-[#FFFFFF] cursor-pointer"
                  >
                    {copiedKey === 'ws' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#E9DECE] dark:border-[#242424]">
                <span className="text-[#756858] dark:text-[#808080]">Resolved HTTP API:</span>
                <div className="flex items-center gap-2">
                  <code className="text-[#FF7057] font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424]">
                    {endpoints.apiBaseUrl}
                  </code>
                  <button
                    onClick={() => copyToClipboard('api', endpoints.apiBaseUrl)}
                    className="text-[#756858] dark:text-[#808080] hover:text-[#302820] dark:hover:text-[#FFFFFF] cursor-pointer"
                  >
                    {copiedKey === 'api' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[#756858] dark:text-[#808080]">Client Access Mode:</span>
                <span className="text-[#302820] dark:text-[#FFFFFF] font-medium">
                  {endpoints.isLocalhost
                    ? '💻 Localhost (Loopback)'
                    : endpoints.isLan
                    ? '🌐 LAN / Cross-device Network'
                    : '☁️ Remote / Public Deployment'}
                </span>
              </div>
            </div>
          </div>

          {/* Room Identification */}
          <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-4 space-y-3">
            <h3 className="text-xs font-medium text-[#302820] dark:text-[#FFFFFF] uppercase tracking-wider">
              Room & Document Isolation
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-[#E9DECE] dark:border-[#242424]">
                <span className="text-[#756858] dark:text-[#808080]">Workspace / Project ID:</span>
                <code className="text-[#302820] dark:text-[#FFFFFF] font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424] truncate max-w-[280px]">
                  {roomId}
                </code>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-[#E9DECE] dark:border-[#242424]">
                <span className="text-[#756858] dark:text-[#808080]">Active Document Path:</span>
                <code className="text-[#302820] dark:text-[#FFFFFF] font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424]">
                  {activeFilePath}
                </code>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-[#756858] dark:text-[#808080]">Full Y.Doc Room Name:</span>
                <div className="flex items-center gap-2">
                  <code className="text-[#FF7057] font-mono bg-[#FFF9F0] dark:bg-[#000000] px-2 py-0.5 rounded border border-[#E9DECE] dark:border-[#242424] truncate max-w-[280px]">
                    {fullDocRoom}
                  </code>
                  <button
                    onClick={() => copyToClipboard('room', fullDocRoom)}
                    className="text-[#756858] dark:text-[#808080] hover:text-[#302820] dark:hover:text-[#FFFFFF] cursor-pointer"
                  >
                    {copiedKey === 'room' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Connected Peers in Document */}
          <div className="rounded-xl border border-[#E9DECE] dark:border-[#242424] bg-[#F1E8DA] dark:bg-[#0A0A0A] p-4 space-y-3">
            <h3 className="text-xs font-medium text-[#302820] dark:text-[#FFFFFF] uppercase tracking-wider">
              Awareness & Connected Peers ({collaborators.length})
            </h3>

            {collaborators.length === 0 ? (
              <div className="text-xs text-[#756858] dark:text-[#808080] italic">No remote collaborators connected yet.</div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {collaborators.map((peer) => (
                  <div
                    key={peer.clientId}
                    className="flex items-center justify-between rounded-lg bg-[#FFF9F0] dark:bg-[#000000] px-3 py-2 border border-[#E9DECE] dark:border-[#242424] text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: peer.user.color || '#FF7057' }}
                      />
                      <span className="font-medium text-[#302820] dark:text-[#FFFFFF]">{peer.user.name}</span>
                      {peer.user.id === currentUser.id && (
                        <span className="text-[10px] bg-[#EFE3D2] dark:bg-[#111111] text-[#756858] dark:text-[#B3B3B3] px-1.5 py-0.2 rounded">
                          you
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[#756858] dark:text-[#808080] text-[11px] font-mono">
                      <span>Client #{peer.clientId}</span>
                      <span>{peer.activeFile || 'idle'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Action Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-[#E9DECE] dark:border-[#242424] pt-4">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestLatency}
              disabled={isPinging}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E9DECE] dark:border-[#242424] bg-[#FFF9F0] dark:bg-[#0A0A0A] px-3 py-1.5 text-xs font-medium text-[#302820] dark:text-[#FFFFFF] hover:bg-[#F1E8DA] dark:hover:bg-[#171717] transition-colors disabled:opacity-50 neu-button cursor-pointer"
            >
              <Radio className={`h-3.5 w-3.5 ${isPinging ? 'animate-pulse text-amber-500' : 'text-[#FF7057]'}`} />
              {isPinging ? 'Measuring...' : pingMs !== null ? `RTT: ${pingMs}ms` : 'Ping Latency'}
            </button>

            {onForceReconnect && (
              <button
                onClick={onForceReconnect}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E9DECE] dark:border-[#242424] bg-[#FFF9F0] dark:bg-[#0A0A0A] px-3 py-1.5 text-xs font-medium text-[#302820] dark:text-[#FFFFFF] hover:bg-[#F1E8DA] dark:hover:bg-[#171717] transition-colors neu-button cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5 text-[#756858] dark:text-[#808080]" />
                Force Reconnect
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => copyToClipboard('share', shareUrl)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors neu-button cursor-pointer"
            >
              {copiedKey === 'share' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedKey === 'share' ? 'Copied Share Link!' : 'Copy Room Share Link'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-[#EFE3D2] dark:bg-[#111111] px-3 py-1.5 text-xs font-medium text-[#302820] dark:text-[#FFFFFF] hover:bg-[#F1E8DA] dark:hover:bg-[#171717] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
