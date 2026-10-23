export interface User {
  id: string;
  username: string;
  avatar_url?: string;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface WorkspaceFile {
  id: string;
  room_id: string;
  path: string;
  content: string;
  language: string;
  updated_at: string;
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