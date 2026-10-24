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
  email?: string;
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
  isInactive?: boolean;
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

export interface FollowState {
  targetUserId: string;
  targetUserName: string;
  targetUserColor: string;
  targetFile?: string;
  lastLineNumber?: number;
}

// ============================================================================
// Personal Autonomous AI Coding Agent Types
// ============================================================================

export type AIProviderType = 'groq' | 'openai' | 'anthropic';

export interface UserAICredential {
  provider: AIProviderType;
  selectedModel: string;
  hasKey: boolean;
  updatedAt?: string;
}

export interface AIConversation {
  id: string;
  userId: string;
  roomId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedPatch {
  filePath: string;
  explanation: string;
  originalContentHash: string;
  originalContent: string;
  patchedContent: string;
  diffSummary?: {
    additions: number;
    deletions: number;
    modifications: number;
  };
  status: 'pending' | 'applied' | 'rejected' | 'stale';
}

export interface ProposedCommand {
  id: string;
  command: string;
  workingDir: string;
  reason: string;
  status: 'pending' | 'running' | 'completed' | 'rejected' | 'failed';
  output?: string;
  exitCode?: number;
}

export type AIAgentActivityStatus =
  | 'idle'
  | 'thinking'
  | 'reading_files'
  | 'investigating_error'
  | 'preparing_patch'
  | 'waiting_approval'
  | 'running_command'
  | 'completed'
  | 'error';

export interface AIMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: 'sending' | 'streaming' | 'complete' | 'error';
  proposedPatches?: ProposedPatch[];
  proposedCommands?: ProposedCommand[];
  activityStatus?: AIAgentActivityStatus;
  activityLogs?: string[];
  createdAt: string;
}

export interface AIAgentContextPayload {
  roomId: string;
  currentFilePath?: string;
  currentFileContent?: string;
  selectedCode?: string;
  selectedRange?: { startLine: number; endLine: number };
  recentError?: string;
  terminalSnippet?: string;
  openFilesList?: string[];
  fileTree?: Array<{ path: string; language: string; size?: number }>;
}


