import { useState } from 'react';
import { User as UserIcon, LogIn, Loader2, Code2, Terminal, Bot, Users } from 'lucide-react';
import type { User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Login failed');
      }
      
      const user = await res.json();
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0d1117 0%, #161b22 100%)',
      color: '#ddd',
      padding: '20px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: 80,
            height: 80,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #0e639c, #1a7bc9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 32px rgba(14, 99, 156, 0.3)',
          }}>
            <Code2 size={40} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 36, fontWeight: 700, background: 'linear-gradient(135deg, #fff, #888)', backgroundClip: 'text', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Collaborative IDE
          </h1>
          <p style={{ margin: 0, color: '#888', fontSize: 16 }}>Real-time coding with AI debugging</p>
        </div>

        <div style={{
          background: 'rgba(22, 27, 34, 0.8)',
          border: '1px solid #30363d',
          borderRadius: 16,
          padding: '32px',
          backdropFilter: 'blur(10px)',
        }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="username" style={{ display: 'block', marginBottom: '8px', fontSize: 14, fontWeight: 500, color: '#ddd' }}>
                <UserIcon size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={loading}
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 16,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onFocus={e => e.currentTarget.style.borderColor = '#0e639c'}
                onBlur={e => e.currentTarget.style.borderColor = '#30363d'}
              />
            </div>

            {error && (
              <div style={{ 
                marginBottom: '20px', 
                padding: '12px 16px', 
                background: 'rgba(218, 52, 52, 0.15)', 
                border: '1px solid #da3633', 
                borderRadius: 8, 
                color: '#f88', 
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <Terminal size={16} /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              style={{
                width: '100%',
                padding: '14px',
                background: username.trim() ? 'linear-gradient(135deg, #0e639c, #1a7bc9)' : '#30363d',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: loading || !username.trim() ? 'not-allowed' : 'pointer',
                fontSize: 16,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'transform 0.1s',
              }}
              onMouseDown={e => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={e => !loading && (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={e => !loading && (e.currentTarget.style.transform = 'scale(1)')}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  <span>Enter IDE</span>
                </>
              )}
            </button>
          </form>

          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid #30363d' }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 500, color: '#888', textAlign: 'center' }}>Features</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <Code2 size={24} style={{ color: '#4ec9b0', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Real-time Sync</p>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <Terminal size={24} style={{ color: '#dcdcaa', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>Shared Terminal</p>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px' }}>
                <Bot size={24} style={{ color: '#c586c0', marginBottom: 8 }} />
                <p style={{ margin: 0, fontSize: 12, color: '#aaa' }}>AI Debugging</p>
              </div>
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