import { useState, useEffect } from 'react';
import { Users, Plus, LogIn, Loader2, Globe, Lock, Edit3 } from 'lucide-react';
import type { Room, User } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface RoomEntryProps {
  room: Room;
  onJoin: (room: Room) => void;
  currentUser: User;
}

function RoomEntry({ room, onJoin, currentUser }: RoomEntryProps) {
  const isOwner = room.ownerId === currentUser.id;
  
  return (
    <div style={{
      padding: '16px',
      background: '#252526',
      border: '1px solid #333',
      borderRadius: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }} onMouseOver={e => e.currentTarget.style.borderColor = '#444'} onMouseOut={e => e.currentTarget.style.borderColor = '#333'}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: 'linear-gradient(135deg, #0e639c, #1a7bc9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Globe size={22} style={{ color: '#fff' }} />
        </div>
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 600 }}>{room.name}</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#888' }}>
            {isOwner && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f0c674' }}>
                <Lock size={12} /> Owner
              </span>
            )}
            <span>Created {new Date(room.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onJoin(room)}
        style={{
          padding: '8px 16px',
          background: '#0e639c',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <LogIn size={14} /> Join
      </button>
    </div>
  );
}

export function RoomSelection({ user, onRoomSelect }: { user: User; onRoomSelect: (room: Room) => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadRooms();
  }, [user.id]);

  const loadRooms = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/rooms`);
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (err) {
      console.error('Failed to load rooms:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim(), ownerId: user.id }),
      });
      if (res.ok) {
        const room = await res.json();
        setRooms(prev => [room, ...prev]);
        setCreating(false);
        setNewRoomName('');
        onRoomSelect(room);
      } else {
        const err = await res.json();
        setError(err.error || 'Failed to create room');
      }
    } catch (err) {
      setError('Failed to create room');
    }
  };

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: '#1e1e1e',
      color: '#ddd',
      padding: '40px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            width: 72,
            height: 72,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #0e639c, #1a7bc9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}>
            <Edit3 size={36} style={{ color: '#fff' }} />
          </div>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 700 }}>Collaborative IDE</h1>
          <p style={{ margin: 0, color: '#888', fontSize: 16 }}>Real-time collaborative coding with AI debugging</p>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={20} /> Your Workspaces
          </h2>
          
          {creating ? (
            <div style={{ display: 'flex', gap: 12, maxWidth: 400 }}>
              <input
                type="text"
                value={newRoomName}
                onChange={e => setNewRoomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateRoom()}
                placeholder="Workspace name"
                autoFocus
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: '#252526',
                  border: '1px solid #333',
                  borderRadius: 6,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
              <button
                onClick={handleCreateRoom}
                disabled={!newRoomName.trim()}
                style={{
                  padding: '12px 20px',
                  background: '#0e639c',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Plus size={16} /> Create
              </button>
              <button
                onClick={() => setCreating(false)}
                style={{
                  padding: '12px 16px',
                  background: 'transparent',
                  color: '#888',
                  border: '1px solid #333',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              style={{
                padding: '12px 20px',
                background: 'transparent',
                color: '#0e639c',
                border: '1px dashed #333',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Plus size={16} /> Create New Workspace
            </button>
          )}

          {error && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#3c1313', border: '1px solid #5a1d1d', borderRadius: 6, color: '#f88' }}>
              {error}
            </div>
          )}

          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', color: '#888' }}>
                <Loader2 size={24} className="spin" />
                <span style={{ marginLeft: 12 }}>Loading workspaces...</span>
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <Globe size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p style={{ margin: '0 0 16px', fontSize: 16 }}>No workspaces yet</p>
                <p style={{ margin: 0, fontSize: 14 }}>Create your first workspace to start collaborating</p>
              </div>
            ) : (
              rooms.map(room => (
                <RoomEntry key={room.id} room={room} onJoin={onRoomSelect} currentUser={user} />
              ))
            )}
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