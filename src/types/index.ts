export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  color: string;
  createdAt: Date;
}

export interface Room {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
}

export interface WorkspaceFile {
  id: string;
  roomId: string;
  path: string;
  content: string;
  language: string;
  updatedAt: Date;
}

export interface CursorPosition {
  userId: string;
  username: string;
  color: string;
  position: { lineNumber: number; column: number } | null;
  selection: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number } | null;
}

export interface PresenceUser extends User {
  cursor?: CursorPosition;
  lastActive: Date;
}

export interface ExecutionResult {
  output: string;
  error?: string;
  executionTime: number;
}

export interface AIDebugRequest {
  code: string;
  language: string;
  error?: string;
  filePath: string;
}

export interface AIDebugResponse {
  explanation: string;
  suggestedFix?: string;
  confidence: number;
}

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