import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, Copy, Check, AlertTriangle, Code } from 'lucide-react';
import type { AIDebugResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface AIDebugPanelProps {
  file: { path: string; content: string; language: string } | null;
  executionError?: string;
  onApplyFix: (fixedCode: string) => void;
}

export function AIDebugPanel({ file, executionError, onApplyFix }: AIDebugPanelProps) {
  const [response, setResponse] = useState<AIDebugResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [response]);

  const handleDebug = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      const res = await fetch(`${API_URL}/api/ai/debug`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: file.content,
          language: file.language,
          error: executionError,
          filePath: file.path,
        }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'AI debugging failed');
      }
      
      const data = await res.json();
      setResponse(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get AI assistance');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyFix = () => {
    if (response?.suggestedFix) {
      navigator.clipboard.writeText(response.suggestedFix);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApplyFix = () => {
    if (response?.suggestedFix) {
      onApplyFix(response.suggestedFix);
    }
  };

  if (!file) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e', color: '#888' }}>
        <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={16} /> AI Assistant
          </h3>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <Bot size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>Open a file to get AI debugging assistance</p>
            <p style={{ fontSize: 12, marginTop: 8 }}>Select a file from the explorer</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#1e1e1e' }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #333' }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={16} /> AI Debug Assistant
        </h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleDebug}
            disabled={loading}
            style={{
              padding: '6px 12px',
              background: '#0e639c',
              color: '#fff',
              border: 'none',
              borderRadius: 3,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            {loading ? 'Analyzing...' : 'Debug with AI'}
          </button>
          {executionError && (
            <span style={{ fontSize: 11, color: '#f44747', alignSelf: 'center' }}>
              <AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Execution error detected
            </span>
          )}
        </div>
      </div>
      
      <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
        {error && (
          <div style={{ 
            background: '#3c1313', 
            border: '1px solid #5a1d1d', 
            borderRadius: 4, 
            padding: '12px', 
            marginBottom: 12,
            color: '#f88',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <AlertTriangle size={16} />
              <strong>Error</strong>
            </div>
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{error}</pre>
          </div>
        )}
        
        {response && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ 
              background: '#252526', 
              border: '1px solid #333', 
              borderRadius: 4, 
              overflow: 'hidden',
            }}>
              <div style={{ 
                padding: '8px 12px', 
                background: '#2d2d2d', 
                borderBottom: '1px solid #333',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Bot size={14} style={{ color: '#4ec9b0' }} />
                <span style={{ fontWeight: 500 }}>Analysis</span>
                <span style={{ 
                  fontSize: 11, 
                  color: '#888',
                  background: '#333',
                  padding: '2px 6px',
                  borderRadius: 3,
                }}>
                  {Math.round(response.confidence * 100)}% confidence
                </span>
              </div>
              <div style={{ padding: '12px', color: '#ddd', fontSize: 13, lineHeight: 1.6 }}>
                {response.explanation}
              </div>
            </div>
            
            {response.suggestedFix && (
              <div style={{ 
                background: '#252526', 
                border: '1px solid #333', 
                borderRadius: 4, 
                overflow: 'hidden',
              }}>
                <div style={{ 
                  padding: '8px 12px', 
                  background: '#2d2d2d', 
                  borderBottom: '1px solid #333',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Code size={14} style={{ color: '#4ec9b0' }} />
                    <span style={{ fontWeight: 500 }}>Suggested Fix</span>
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={handleCopyFix}
                      style={{
                        padding: '4px 8px',
                        background: '#333',
                        border: '1px solid #444',
                        color: '#ddd',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontSize: 11,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                      title="Copy to clipboard"
                    >
                      {copied ? <Check size={12} style={{ color: '#4ec9b0' }} /> : <Copy size={12} />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleApplyFix}
                      style={{
                        padding: '4px 12px',
                        background: '#0e639c',
                        border: 'none',
                        color: '#fff',
                        borderRadius: 3,
                        cursor: 'pointer',
                        fontSize: 11,
                      }}
                    >
                      Apply Fix
                    </button>
                  </div>
                </div>
                <pre style={{ margin: 0, padding: '12px', background: '#1e1e1e', overflow: 'auto' }}>
                  <code style={{ fontSize: 12, fontFamily: 'monospace', color: '#d4d4d4' }}>
                    {response.suggestedFix}
                  </code>
                </pre>
              </div>
            )}
          </div>
        )}
        
        {!response && !loading && !error && (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
            <Bot size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <p>Click "Debug with AI" to analyze your code</p>
            {executionError && (
              <p style={{ marginTop: 8, fontSize: 12, color: '#f44747' }}>
                An execution error was detected - AI can help fix it
              </p>
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}