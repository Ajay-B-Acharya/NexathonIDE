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
  type: 'input' | 'output' | 'resize' | 'connect' | 'disconnect';
  data?: string;
  cols?: number;
  rows?: number;
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