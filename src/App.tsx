import React, { useState, useCallback, useEffect } from 'react';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { WorkspaceSelection } from './pages/WorkspaceSelection';
import { Workspace } from './pages/Workspace';
import { workspaceApi } from './services/workspaceApi';
import {
  supabase,
  getCurrentUserProfile,
  mapSupabaseUserToProfile,
  signOutUser,
  isSupabaseConfigured,
} from './services/supabaseClient';
import { UserProfile, WorkspaceRoom } from './types';
import { ThemeMode } from './components/ThemeToggle';

const USER_STORAGE_KEY = 'nexathon_ide_user';
const THEME_STORAGE_KEY = 'nexathon_ide_theme';

type AppView = 'landing' | 'login' | 'workspaces' | 'workspace';

const GUEST_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#a855f7', '#06b6d4'];

export const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const saved = sessionStorage.getItem(USER_STORAGE_KEY);
      return saved ? (JSON.parse(saved) as UserProfile) : null;
    } catch {
      return null;
    }
  });

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      return 'dark';
    } catch {
      return 'dark';
    }
  });

  const [activeRoom, setActiveRoom] = useState<WorkspaceRoom | null>(null);
  const [view, setView] = useState<AppView>('landing');

  // Synchronize `.dark` / `.light` class on `document.documentElement`
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  const persistUser = useCallback((loggedInUser: UserProfile) => {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(loggedInUser));
    setUser(loggedInUser);
  }, []);

  // Sync Supabase Auth Session
  useEffect(() => {
    let isMounted = true;

    if (isSupabaseConfigured) {
      getCurrentUserProfile().then((profile) => {
        if (isMounted && profile) {
          persistUser(profile);
        }
      });

      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!isMounted) return;
        if (session?.user) {
          const profile = mapSupabaseUserToProfile(session.user);
          persistUser(profile);
        }
      });

      return () => {
        isMounted = false;
        authListener?.subscription?.unsubscribe();
      };
    }
  }, [persistUser]);

  const handleLoginSuccess = useCallback(
    (loggedInUser: UserProfile) => {
      persistUser(loggedInUser);
      setView('workspaces');
    },
    [persistUser]
  );

  const handleInstantGuestDemo = useCallback(async () => {
    const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomColor = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];

    const guestUser: UserProfile = user || {
      id: `usr_guest_${randomSuffix.toLowerCase()}`,
      name: `dev_${randomSuffix.toLowerCase()}`,
      color: randomColor,
    };

    persistUser(guestUser);

    try {
      const existingRooms = await workspaceApi.listRooms();
      if (existingRooms.length > 0) {
        setActiveRoom(existingRooms[0]);
        setView('workspace');
        return;
      }

      const createdRoom = await workspaceApi.createRoom({
        name: 'nexathon-distributed-sandbox',
        description: 'Ephemeral CRDT + Pyodide WASM + Node-PTY Room',
        ownerId: guestUser.id,
      });
      setActiveRoom(createdRoom);
      setView('workspace');
    } catch {
      const fallbackDemoRoom: WorkspaceRoom = {
        id: 'room_local_wasm_01',
        name: 'nexathon-wasm-sandbox',
        description: 'Zero-friction guest workspace with in-browser WASM execution',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: guestUser.id,
      };
      setActiveRoom(fallbackDemoRoom);
      setView('workspace');
    }
  }, [user, persistUser]);

  const handleLogout = useCallback(async () => {
    await signOutUser();
    sessionStorage.removeItem(USER_STORAGE_KEY);
    setActiveRoom(null);
    setUser(null);
    setView('landing');
  }, []);

  if (view === 'landing') {
    return (
      <Landing
        existingUser={user}
        theme={theme}
        onToggleTheme={setTheme}
        onCompleteOnboarding={(newUser) => {
          persistUser(newUser);
          setView('workspaces');
        }}
        onInstantGuestDemo={handleInstantGuestDemo}
        onResumeSession={() => {
          if (activeRoom) {
            setView('workspace');
          } else {
            setView('workspaces');
          }
        }}
        onNavigateToLogin={() => setView('login')}
      />
    );
  }

  if (view === 'login' || !user) {
    return (
      <Login
        theme={theme}
        onToggleTheme={setTheme}
        onLogin={handleLoginSuccess}
        onBackToLanding={() => setView('landing')}
        onGuestDemo={handleInstantGuestDemo}
      />
    );
  }

  if (view === 'workspaces' || !activeRoom) {
    return (
      <WorkspaceSelection
        user={user}
        theme={theme}
        onToggleTheme={setTheme}
        onSelectRoom={(room) => {
          setActiveRoom(room);
          setView('workspace');
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Workspace
      room={activeRoom}
      user={user}
      theme={theme}
      onToggleTheme={setTheme}
      onSwitchWorkspace={() => {
        setActiveRoom(null);
        setView('workspaces');
      }}
      onLogout={handleLogout}
    />
  );
};

export default App;
