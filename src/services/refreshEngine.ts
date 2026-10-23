import { UserProfile, WorkspaceRoom, BottomTabType } from '../types';

export type AppView = 'landing' | 'login' | 'workspaces' | 'workspace';

export interface ParsedRoute {
  view: AppView;
  roomId?: string;
}

export interface StoredWorkspaceUI {
  openFileIds?: string[];
  activeFileId?: string | null;
  activeBottomTab?: BottomTabType;
  isBottomDrawerOpen?: boolean;
  isExplorerOpen?: boolean;
}

const STORAGE_KEY_VIEW = 'nexathon_ide_active_view';
const STORAGE_KEY_ACTIVE_ROOM = 'nexathon_ide_active_room';
const STORAGE_KEY_USER = 'nexathon_ide_user';
const STORAGE_KEY_WS_PREFIX = 'nexathon_ide_ws_';
const STORAGE_KEY_DRAFT_PREFIX = 'nexathon_ide_draft_';

/**
 * Parses the initial route from the browser URL, hash, query params,
 * and falls back to persistent storage on page refresh so user stays on the exact same page.
 */
export function parseCurrentRoute(): ParsedRoute {
  try {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    const hash = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Path route: /workspace/:roomId
    const wsMatch = pathname.match(/^\/workspace\/(.+)$/);
    if (wsMatch && wsMatch[1]) {
      return { view: 'workspace', roomId: decodeURIComponent(wsMatch[1]) };
    }

    // 2. Hash route: #/workspace/:roomId
    const hashWsMatch = hash.match(/^workspace\/(.+)$/);
    if (hashWsMatch && hashWsMatch[1]) {
      return { view: 'workspace', roomId: decodeURIComponent(hashWsMatch[1]) };
    }

    // 3. Search query: ?room=:roomId
    const searchRoom = searchParams.get('room');
    if (searchRoom) {
      return { view: 'workspace', roomId: searchRoom };
    }

    // 4. Workspaces list
    if (pathname === '/workspaces' || hash === 'workspaces' || searchParams.get('view') === 'workspaces') {
      return { view: 'workspaces' };
    }

    // 5. Login
    if (pathname === '/login' || hash === 'login' || searchParams.get('view') === 'login') {
      return { view: 'login' };
    }

    // 6. Root / fallback: Check stored view so refreshing '/' or page reload preserves current page
    const storedView = localStorage.getItem(STORAGE_KEY_VIEW) as AppView | null;
    const storedRoom = getStoredActiveRoom();

    if (storedView === 'workspace' && storedRoom) {
      return { view: 'workspace', roomId: storedRoom.id };
    }
    if (storedView === 'workspaces') {
      return { view: 'workspaces' };
    }
    if (storedView === 'login') {
      return { view: 'login' };
    }

    return { view: 'landing' };
  } catch (err) {
    console.error('RefreshEngine: failed to parse current route:', err);
    return { view: 'landing' };
  }
}

/**
 * Synchronizes browser URL history and persistent state on page navigation
 */
export function syncRoute(view: AppView, room?: WorkspaceRoom | null, replace: boolean = false): void {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW, view);
    let targetPath = '/';

    if (view === 'workspace') {
      if (room?.id) {
        targetPath = `/workspace/${encodeURIComponent(room.id)}`;
        saveStoredActiveRoom(room);
      } else {
        targetPath = '/workspaces';
      }
    } else if (view === 'workspaces') {
      targetPath = '/workspaces';
      clearStoredActiveRoom();
    } else if (view === 'login') {
      targetPath = '/login';
      clearStoredActiveRoom();
    } else {
      targetPath = '/';
      clearStoredActiveRoom();
    }

    if (window.location.pathname !== targetPath) {
      if (replace) {
        window.history.replaceState({ view, roomId: room?.id }, '', targetPath);
      } else {
        window.history.pushState({ view, roomId: room?.id }, '', targetPath);
      }
    }
  } catch (err) {
    console.warn('RefreshEngine: failed to sync route:', err);
  }
}

/**
 * Active room persistence
 */
export function getStoredActiveRoom(): WorkspaceRoom | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIVE_ROOM);
    return raw ? (JSON.parse(raw) as WorkspaceRoom) : null;
  } catch {
    return null;
  }
}

export function saveStoredActiveRoom(room: WorkspaceRoom): void {
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ROOM, JSON.stringify(room));
  } catch (err) {
    console.warn('RefreshEngine: unable to save active room:', err);
  }
}

export function clearStoredActiveRoom(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ROOM);
  } catch {}
}

/**
 * User profile persistence across reloads (both localStorage & sessionStorage)
 */
export function getStoredUser(): UserProfile | null {
  try {
    const local = localStorage.getItem(STORAGE_KEY_USER);
    if (local) return JSON.parse(local) as UserProfile;
    const session = sessionStorage.getItem(STORAGE_KEY_USER);
    if (session) return JSON.parse(session) as UserProfile;
    return null;
  } catch {
    return null;
  }
}

export function saveStoredUser(user: UserProfile): void {
  try {
    const serialized = JSON.stringify(user);
    localStorage.setItem(STORAGE_KEY_USER, serialized);
    sessionStorage.setItem(STORAGE_KEY_USER, serialized);
  } catch (err) {
    console.warn('RefreshEngine: unable to save user:', err);
  }
}

export function clearStoredUser(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_USER);
    sessionStorage.removeItem(STORAGE_KEY_USER);
    localStorage.removeItem(STORAGE_KEY_VIEW);
    localStorage.removeItem(STORAGE_KEY_ACTIVE_ROOM);
  } catch {}
}

/**
 * Per-workspace UI state persistence (open tabs, active tab, drawers)
 */
export function getStoredWorkspaceUI(roomId: string): StoredWorkspaceUI | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_WS_PREFIX}${roomId}`);
    return raw ? (JSON.parse(raw) as StoredWorkspaceUI) : null;
  } catch {
    return null;
  }
}

export function saveStoredWorkspaceUI(roomId: string, state: StoredWorkspaceUI): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_WS_PREFIX}${roomId}`, JSON.stringify(state));
  } catch (err) {
    console.warn('RefreshEngine: unable to save workspace UI:', err);
  }
}

/**
 * Draft changes persistence to prevent code loss across accidental page reloads
 */
export function saveFileDraft(roomId: string, fileId: string, content: string): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_DRAFT_PREFIX}${roomId}_${fileId}`, content);
  } catch {}
}

export function getFileDraft(roomId: string, fileId: string): string | null {
  try {
    return localStorage.getItem(`${STORAGE_KEY_DRAFT_PREFIX}${roomId}_${fileId}`);
  } catch {
    return null;
  }
}

export function clearFileDraft(roomId: string, fileId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEY_DRAFT_PREFIX}${roomId}_${fileId}`);
  } catch {}
}
