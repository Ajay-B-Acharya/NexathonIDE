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
}

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
