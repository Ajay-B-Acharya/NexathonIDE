import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { WorkspaceSelection } from './pages/WorkspaceSelection';
import { Workspace } from './pages/Workspace';
import { workspaceApi } from './services/workspaceApi';
import {
  parseCurrentRoute,
  syncRoute,
  getStoredActiveRoom,
  saveStoredActiveRoom,
  getStoredUser,
  saveStoredUser,
  clearStoredUser,
  AppView,
} from './services/refreshEngine';
import {
  supabase,
  getCurrentUserProfile,
  mapSupabaseUserToProfile,
  signOutUser,
  isSupabaseConfigured,
} from './services/supabaseClient';
import { UserProfile, WorkspaceRoom } from './types';
import { ThemeMode } from './components/ThemeToggle';

const THEME_STORAGE_KEY = 'nexathon_ide_theme';
const GUEST_COLORS = ['#35B8A6', '#218653', '#E6B450', '#2563EB', '#0D9488', '#475569'];

export const App: React.FC = () => {
  const initialRoute = useMemo(() => parseCurrentRoute(), []);

  const [user, setUser] = useState<UserProfile | null>(() => {
    return getStoredUser();
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

  const [activeRoom, setActiveRoom] = useState<WorkspaceRoom | null>(() => {
    if (initialRoute.view === 'workspace') {
      const storedRoom = getStoredActiveRoom();
      if (storedRoom && (!initialRoute.roomId || storedRoom.id === initialRoute.roomId)) {
        return storedRoom;
      }
      if (initialRoute.roomId) {
        return {
          id: initialRoute.roomId,
          name: storedRoom?.name || initialRoute.roomId,
          description: storedRoom?.description || 'Collaborative workspace',
          createdAt: storedRoom?.createdAt || new Date().toISOString(),
          updatedAt: storedRoom?.updatedAt || new Date().toISOString(),
          ownerId: storedRoom?.ownerId || 'guest',
        };
      }
    }
    return null;
  });

  const [view, setView] = useState<AppView>(() => {
    return initialRoute.view;
  });

  // Centralized navigation engine syncing browser history and persistent storage
  const navigateTo = useCallback((nextView: AppView, room: WorkspaceRoom | null = null, replace: boolean = false) => {
    setView(nextView);
    setActiveRoom(room);
    syncRoute(nextView, room, replace);
  }, []);

  // Synchronize browser URL query param with activeRoom ID
  useEffect(() => {
    if (activeRoom) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('room') !== activeRoom.id) {
        url.searchParams.set('room', activeRoom.id);
        window.history.replaceState(null, '', url.toString());
      }
    } else {
      const url = new URL(window.location.href);
      if (url.searchParams.has('room') && view !== 'workspace') {
        url.searchParams.delete('room');
        window.history.replaceState(null, '', url.toString());
      }
    }
  }, [activeRoom, view]);

  // Handle deep-link to room on initial load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const targetRoomId = urlParams.get('room');
    if (!targetRoomId) return;

    let currentUser = user;
    if (!currentUser) {
      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const randomColor = GUEST_COLORS[Math.floor(Math.random() * GUEST_COLORS.length)];
      currentUser = {
        id: `usr_guest_${randomSuffix.toLowerCase()}`,
        name: `dev_${randomSuffix.toLowerCase()}`,
        color: randomColor,
      };
      saveStoredUser(currentUser);
      setUser(currentUser);
    }

    workspaceApi
      .getRoom(targetRoomId)
      .then((room) => {
        setActiveRoom(room);
        setView('workspace');
      })
      .catch(() => {
        const fallbackRoom: WorkspaceRoom = {
          id: targetRoomId,
          name: 'Collaborative Workspace',
          description: 'Live shared editing room',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ownerId: currentUser.id,
        };
        setActiveRoom(fallbackRoom);
        setView('workspace');
      });
  }, []);

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

  // Initial synchronization of route so URL always reflects initial view on mount/reload
  useEffect(() => {
    syncRoute(view, activeRoom, true);
  }, []);

  // Listen to browser Back / Forward events (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      if (route.view === 'workspace') {
        const storedRoom = getStoredActiveRoom();
        if (storedRoom && (!route.roomId || storedRoom.id === route.roomId)) {
          setActiveRoom(storedRoom);
        } else if (route.roomId) {
          void workspaceApi.getRoom(route.roomId)
            .then((fresh) => {
              setActiveRoom(fresh);
              saveStoredActiveRoom(fresh);
            })
            .catch(() => {});
        }
      } else if (route.view === 'workspaces') {
        setActiveRoom(null);
      }
      setView(route.view);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Persist user both in state and dual storage (localStorage + sessionStorage)
  const persistUser = useCallback((loggedInUser: UserProfile) => {
    saveStoredUser(loggedInUser);
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

  // Background refresh of room metadata when on a workspace page
  useEffect(() => {
    if (view === 'workspace' && activeRoom?.id) {
      let isMounted = true;
      workspaceApi.getRoom(activeRoom.id).then((freshRoom) => {
        if (isMounted && freshRoom) {
          setActiveRoom(freshRoom);
          saveStoredActiveRoom(freshRoom);
        }
      }).catch((err) => {
        console.debug('Active room background sync status:', err?.message);
      });
      return () => {
        isMounted = false;
      };
    }
  }, [view, activeRoom?.id]);

  const handleLoginSuccess = useCallback(
    (loggedInUser: UserProfile) => {
      persistUser(loggedInUser);
      if (activeRoom) {
        navigateTo('workspace', activeRoom);
      } else {
        navigateTo('workspaces');
      }
    },
    [persistUser, activeRoom, navigateTo]
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
        navigateTo('workspace', existingRooms[0]);
        return;
      }

      const createdRoom = await workspaceApi.createRoom({
        name: 'nexathon-distributed-sandbox',
        description: 'Ephemeral CRDT + Pyodide WASM + Node-PTY Room',
        ownerId: guestUser.id,
      });
      navigateTo('workspace', createdRoom);
    } catch {
      const fallbackDemoRoom: WorkspaceRoom = {
        id: 'room_local_wasm_01',
        name: 'nexathon-wasm-sandbox',
        description: 'Zero-friction guest workspace with in-browser WASM execution',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ownerId: guestUser.id,
      };
      navigateTo('workspace', fallbackDemoRoom);
    }
  }, [user, persistUser, navigateTo]);

  const handleLogout = useCallback(async () => {
    await signOutUser();
    clearStoredUser();
    setActiveRoom(null);
    setUser(null);
    navigateTo('landing', null, true);
  }, [navigateTo]);

  if (view === 'landing') {
    return (
      <Landing
        existingUser={user}
        theme={theme}
        onToggleTheme={setTheme}
        onCompleteOnboarding={(newUser) => {
          persistUser(newUser);
          navigateTo('workspaces');
        }}
        onInstantGuestDemo={handleInstantGuestDemo}
        onResumeSession={() => {
          if (activeRoom) {
            navigateTo('workspace', activeRoom);
          } else {
            navigateTo('workspaces');
          }
        }}
        onNavigateToLogin={() => navigateTo('login')}
      />
    );
  }

  if (view === 'login') {
    return (
      <Login
        theme={theme}
        onToggleTheme={setTheme}
        onLogin={handleLoginSuccess}
        onBackToLanding={() => navigateTo('landing')}
        onGuestDemo={handleInstantGuestDemo}
      />
    );
  }

  // If user accesses authenticated views without a profile, generate guest identity seamlessly
  // or prompt for login
  const effectiveUser = user || {
    id: `usr_guest_auto`,
    name: `dev_guest`,
    color: '#35B8A6',
  };

  if (view === 'workspaces' || !activeRoom) {
    return (
      <WorkspaceSelection
        user={effectiveUser}
        theme={theme}
        onToggleTheme={setTheme}
        onSelectRoom={(room) => {
          navigateTo('workspace', room);
        }}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <Workspace
      room={activeRoom}
      user={effectiveUser}
      theme={theme}
      onToggleTheme={setTheme}
      onSwitchWorkspace={() => {
        navigateTo('workspaces');
      }}
      onLogout={handleLogout}
    />
  );
};

export default App;
