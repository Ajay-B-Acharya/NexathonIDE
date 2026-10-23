import { useState, useEffect, useCallback } from 'react';
import { IDELayout } from './components/IDELayout';
import { Login } from './components/Login';
import { RoomSelection } from './components/RoomSelection';
import type { User, Room } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [view, setView] = useState<'login' | 'rooms' | 'ide'>('login');

  const handleLogin = useCallback((loggedInUser: User) => {
    setUser(loggedInUser);
    setView('rooms');
  }, []);

  const handleRoomSelect = useCallback((selectedRoom: Room) => {
    setRoom(selectedRoom);
    setView('ide');
  }, []);

  const handleLogout = useCallback(() => {
    setUser(null);
    setRoom(null);
    setView('login');
  }, []);

  const handleLeaveRoom = useCallback(() => {
    setRoom(null);
    setView('rooms');
  }, []);

  if (view === 'login') {
    return <Login onLogin={handleLogin} />;
  }

  if (view === 'rooms') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 24px',
          background: '#252526',
          borderBottom: '1px solid #333',
        }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: '#4ec9b0' }}>Collaborative IDE</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {user && (
              <span style={{ color: '#888', fontSize: 14 }}>
                Signed in as <strong>{user.username}</strong>
              </span>
            )}
            <button
              onClick={handleLogout}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                color: '#888',
                border: '1px solid #333',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Sign Out
            </button>
          </div>
        </header>
        <RoomSelection user={user!} onRoomSelect={handleRoomSelect} />
      </div>
    );
  }

  if (view === 'ide') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <IDELayout roomId={room!.id} user={user!} room={room!} />
      </div>
    );
  }

  return null;
}

export default App;