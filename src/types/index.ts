export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'json'
  | 'html'
  | 'css'
  | 'markdown'
  | 'rust'
  | 'go'
  | 'java'
  | 'cpp'
  | 'csharp'
  | 'php'
  | 'ruby'
  | 'dart'
  | 'sql'
  | 'shell'
  | 'yaml'
  | 'plaintext';

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
  repositoryUrl?: string;
  branch?: string;
  commitSha?: string;
  primaryLanguage?: string;
  isGitHubImport?: boolean;
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

export interface LineLockNotice {
  line: number;
  userName: string;
  userColor: string;
}

// ============================================================================
// Personal Autonomous AI Coding Agent Types
// ============================================================================

export type AIProviderType =
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'deepseek'
  | 'mistral'
  | 'xai'
  | 'together'
  | 'custom';

export type AIProviderProtocol = 'openai' | 'anthropic';

export interface ProviderModelInfo {
  id: string;
  name: string;
  tag?: string;
  contextLimit?: number;
  isDecommissioned?: boolean;
}

export interface ProviderMetadata {
  id: AIProviderType;
  name: string;
  description: string;
  defaultEndpoint: string;
  defaultModel: string;
  defaultProtocol: AIProviderProtocol;
  docsUrl: string;
  keyManagementUrl: string;
  supportsModelListing: boolean;
  popularModels: ProviderModelInfo[];
}

export interface UserAICredential {
  provider: AIProviderType;
  selectedModel: string;
  hasKey: boolean;
  updatedAt?: string;
  apiEndpoint?: string;
  customProviderName?: string;
  customProtocol?: AIProviderProtocol;
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
  projectProfile?: ProjectProfile;
}

// ============================================================================
// Multi-Language Project Detection & Analysis Types
// ============================================================================

export interface ProjectLanguageBreakdown {
  language: string;
  percentage: number;
  fileCount: number;
}

export interface AvailableRuntimeInfo {
  name: string;
  environment: 'wasm' | 'container' | 'cloud' | 'preview' | 'none';
  isReady: boolean;
  description: string;
}

export interface SuggestedCommand {
  title: string;
  command: string;
  description: string;
  category?: 'build' | 'test' | 'run' | 'lint';
}

export interface ProjectProfile {
  detectedLanguages: ProjectLanguageBreakdown[];
  primaryLanguage: string;
  frameworks: string[];
  buildSystems: string[];
  manifests: string[];
  entryPoints: string[];
  availableRuntimes: AvailableRuntimeInfo[];
  suggestedCommands: SuggestedCommand[];
  detectionConfidence: 'high' | 'medium' | 'low';
  isMonorepo?: boolean;
}

// ============================================================================
// GitHub Repository Import & Git Workflow Types
// ============================================================================

export interface GitHubRepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  branches: string[];
  description: string;
  stars: number;
  isPrivate: boolean;
  sizeKb: number;
  primaryLanguage?: string;
}

export interface GitHubImportPayload {
  url: string;
  branch?: string;
  ownerId: string;
  name?: string;
  githubToken?: string;
}

export interface GitHubImportResult {
  room: WorkspaceRoom;
  filesCount: number;
  projectProfile: ProjectProfile;
  repositoryUrl: string;
  branch: string;
  commitSha: string;
}

export interface GitCommitRecord {
  sha: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface WorkspaceGitState {
  branch: string;
  commitSha: string;
  repositoryUrl?: string;
  branches: string[];
  modifiedFiles: string[];
  untrackedFiles: string[];
  isClean: boolean;
  commits: GitCommitRecord[];
}


