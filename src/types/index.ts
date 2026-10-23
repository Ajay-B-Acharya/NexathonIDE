export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown';

export interface UserProfile {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  username?: string;
}

export type User = UserProfile;

export interface CollaboratorPresence {
  clientId: number;
  user: UserProfile;
  activeFile?: string;
  cursor?: {
    lineNumber: number;
    column: number;
  } | null;
  isTyping?: boolean;
  lastActive: number;
}

export interface WorkspaceFile {
  id: string;
  roomId: string;
  name: string;
  path: string; // e.g., "src/main.py" or "index.js"
  language: SupportedLanguage;
  content: string;
  updatedAt: string;
  isDirty?: boolean;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  file?: WorkspaceFile;
  children?: FileTreeNode[];
}

export interface WorkspaceRoom {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  files?: WorkspaceFile[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  language: SupportedLanguage;
  timestamp: string;
  output?: string;
  error?: string | null;
  executionTime?: number;
}

export interface AIDebugRequest {
  code: string;
  language: SupportedLanguage;
  error: string;
  filePath: string;
}

export interface AIDebugResponse {
  explanation: string;
  probableCause?: string;
  suggestedFix: string;
  confidence?: number;
  lineNumbers?: number[];
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type BottomTabType = 'output' | 'terminal' | 'ai-debugger';

export interface TerminalMessage {
  type?: 'input' | 'output' | 'resize' | 'connect' | 'disconnect' | 'history' | 'presence' | 'typing' | 'restart' | 'exit';
  action?: 'terminal_input' | 'terminal_output' | 'terminal_resize' | 'terminal_connect' | 'terminal_disconnect' | 'terminal_history' | 'terminal_presence' | 'terminal_typing' | 'terminal_restart' | 'terminal_exit';
  data?: string;
  payload?: any;
  cols?: number;
  rows?: number;
  userId?: string;
  username?: string;
  color?: string;
  shellType?: string;
  isIsolated?: boolean;
  exitCode?: number;
  users?: Array<{ userId: string; username: string; color?: string }>;
}
