import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { WorkspaceService } from './workspaceService.js';
import { ProjectDetectionService } from './projectDetectionService.js';
import type {
  GitHubRepoInfo,
  GitHubImportPayload,
  GitHubImportResult,
  SupportedLanguage,
} from '../../types/index.js';

interface GitHubParsedUrl {
  owner: string;
  repo: string;
  branch?: string;
  subpath?: string;
}

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp', 'bmp',
  'pdf', 'zip', 'gz', 'tar', 'tgz', 'rar', '7z',
  'exe', 'dll', 'so', 'dylib', 'bin', 'wasm',
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  'mp3', 'mp4', 'wav', 'mov', 'avi', 'mkv',
  'class', 'jar', 'pyc', 'pyo', 'pyd',
]);

const IGNORED_DIRECTORIES = [
  '.git/',
  'node_modules/',
  'target/',
  'dist/',
  'build/',
  '.next/',
  '.nuxt/',
  '.venv/',
  'venv/',
  '__pycache__/',
  'vendor/',
  '.cargo/',
  '.idea/',
  '.vscode/',
];

export class GitHubImportService {
  /**
   * Safely parses and validates a GitHub repository URL, protecting against SSRF.
   */
  static parseGitHubUrl(rawUrl: string): GitHubParsedUrl {
    const trimmed = rawUrl.trim();
    if (!trimmed) {
      throw new Error('GitHub repository URL is required.');
    }

    // Support short syntax "owner/repo"
    const shortMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
    if (shortMatch) {
      return {
        owner: shortMatch[1],
        repo: shortMatch[2].replace(/\.git$/, ''),
      };
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    } catch {
      throw new Error('Invalid URL format. Please provide a valid GitHub repository URL.');
    }

    // SSRF boundary check: strictly verify hostname is github.com
    const hostname = parsed.hostname.toLowerCase();
    if (hostname !== 'github.com' && hostname !== 'www.github.com') {
      throw new Error(
        `Invalid host "${hostname}". Only repositories from https://github.com are supported.`
      );
    }

    // Strip leading slash
    const parts = parsed.pathname.replace(/^\/+/, '').split('/');
    if (parts.length < 2) {
      throw new Error('URL must contain both owner and repository name (e.g. github.com/owner/repo).');
    }

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, '');

    let branch: string | undefined;
    let subpath: string | undefined;

    if (parts.length >= 4 && parts[2] === 'tree') {
      branch = parts[3];
      if (parts.length > 4) {
        subpath = parts.slice(4).join('/');
      }
    }

    return { owner, repo, branch, subpath };
  }

  /**
   * Fetches public or authorized repository metadata from the GitHub API.
   */
  static async validateRepository(
    url: string,
    githubToken?: string
  ): Promise<GitHubRepoInfo> {
    const { owner, repo, branch: requestedBranch } = this.parseGitHubUrl(url);

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NexathonIDE-Importer/1.0',
    };
    if (githubToken?.trim()) {
      headers['Authorization'] = `Bearer ${githubToken.trim()}`;
    }

    const apiUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    const response = await fetch(apiUrl, { headers });

    if (response.status === 404) {
      throw new Error(
        `Repository "${owner}/${repo}" was not found. If it is private, please provide a GitHub Personal Access Token.`
      );
    }
    if (response.status === 403) {
      const msg = await response.text();
      if (msg.includes('rate limit')) {
        throw new Error('GitHub API rate limit exceeded. Please configure a GitHub token to proceed.');
      }
      throw new Error(`Access forbidden (403): ${msg}`);
    }
    if (!response.ok) {
      throw new Error(`GitHub API error (${response.status}): ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    // Fetch branches list
    let branches: string[] = [data.default_branch || 'main'];
    try {
      const branchRes = await fetch(`${apiUrl}/branches?per_page=20`, { headers });
      if (branchRes.ok) {
        const branchList = await branchRes.json();
        if (Array.isArray(branchList)) {
          branches = branchList.map((b: any) => b.name);
        }
      }
    } catch {
      // Non-fatal if branch listing fails
    }

    return {
      owner: data.owner?.login || owner,
      repo: data.name || repo,
      defaultBranch: requestedBranch || data.default_branch || 'main',
      branches,
      description: data.description || 'Imported GitHub Repository',
      stars: data.stargazers_count || 0,
      isPrivate: Boolean(data.private),
      sizeKb: data.size || 0,
      primaryLanguage: data.language || undefined,
    };
  }

  /**
   * Safely imports a GitHub repository into a new workspace room.
   */
  static async importRepository(
    payload: GitHubImportPayload,
    fallbackMemoryRooms?: Map<string, any>,
    fallbackMemoryFiles?: Map<string, any>
  ): Promise<GitHubImportResult> {
    const { owner, repo, branch: urlBranch } = this.parseGitHubUrl(payload.url);
    const branch = payload.branch?.trim() || urlBranch || 'main';

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'NexathonIDE-Importer/1.0',
    };
    if (payload.githubToken?.trim()) {
      headers['Authorization'] = `Bearer ${payload.githubToken.trim()}`;
    }

    // 1. Get repository metadata & authoritative default branch if not specified
    const repoInfo = await this.validateRepository(payload.url, payload.githubToken);
    const targetBranch = payload.branch?.trim() || repoInfo.defaultBranch;

    // 2. Fetch the Git Tree recursively
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(targetBranch)}?recursive=1`;
    const treeRes = await fetch(treeUrl, { headers });

    if (!treeRes.ok) {
      throw new Error(
        `Failed to fetch tree for branch "${targetBranch}". Response: ${treeRes.status} ${treeRes.statusText}`
      );
    }

    const treeData = (await treeRes.json()) as any;
    if (!Array.isArray(treeData.tree)) {
      throw new Error('Repository tree returned no files or invalid structure.');
    }

    const commitSha = String(treeData.sha || '').slice(0, 10) || 'head';

    // 3. Filter files safely
    const candidateFiles: Array<{ path: string; sha: string; size: number }> = [];

    for (const item of treeData.tree) {
      if (item.type !== 'blob') continue;

      const rawPath = String(item.path || '');
      // Path traversal security check
      const normalizedPath = path.posix.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');
      if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
        continue; // Discard malicious path traversal attempts
      }

      // Check ignored directories
      if (IGNORED_DIRECTORIES.some((dir) => normalizedPath.startsWith(dir) || normalizedPath.includes(`/${dir}`))) {
        continue;
      }

      // Check binary extension
      const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
      if (BINARY_EXTENSIONS.has(ext)) {
        continue;
      }

      // Max size limit per file (400 KB)
      const size = Number(item.size || 0);
      if (size > 400 * 1024) {
        continue;
      }

      candidateFiles.push({
        path: normalizedPath,
        sha: item.sha,
        size,
      });

      // Max total files limit (250 files) to maintain high performance in browser & Yjs
      if (candidateFiles.length >= 250) {
        break;
      }
    }

    if (candidateFiles.length === 0) {
      throw new Error('No compatible text source files found in the repository.');
    }

    // 4. Concurrently fetch file contents (with worker pool of 6)
    const fetchedFiles: Array<{ path: string; content: string; language: SupportedLanguage }> = [];
    const concurrency = 6;
    let index = 0;

    const worker = async () => {
      while (index < candidateFiles.length) {
        const item = candidateFiles[index++];
        try {
          const blobUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/blobs/${item.sha}`;
          const bRes = await fetch(blobUrl, { headers });
          if (bRes.ok) {
            const bData = (await bRes.json()) as any;
            if (bData.encoding === 'base64' && typeof bData.content === 'string') {
              const decoded = Buffer.from(bData.content.replace(/\n/g, ''), 'base64').toString('utf8');
              fetchedFiles.push({
                path: item.path,
                content: decoded,
                language: this.mapLanguage(item.path),
              });
            }
          }
        } catch {
          // Skip file if fetch fails
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, candidateFiles.length) }, () => worker());
    await Promise.all(workers);

    if (fetchedFiles.length === 0) {
      throw new Error('Failed to retrieve file contents from GitHub API.');
    }

    // 5. Create Workspace Room in Supabase / In-Memory storage
    const workspaceName = payload.name?.trim() || `${repo}`;
    const workspaceDescription = `Imported from github.com/${owner}/${repo} (${targetBranch}@${commitSha})`;

    let createdRoom: any = null;
    try {
      createdRoom = await WorkspaceService.createWorkspace({
        name: workspaceName,
        ownerId: payload.ownerId,
      });
    } catch {
      // Fallback
    }

    if (!createdRoom) {
      const roomId = `room_gh_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
      createdRoom = {
        id: roomId,
        name: workspaceName,
        description: workspaceDescription,
        ownerId: payload.ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (fallbackMemoryRooms) {
        fallbackMemoryRooms.set(roomId, createdRoom);
      }
    } else {
      createdRoom.description = workspaceDescription;
      createdRoom.repositoryUrl = `https://github.com/${owner}/${repo}`;
      createdRoom.branch = targetBranch;
      createdRoom.commitSha = commitSha;
      createdRoom.isGitHubImport = true;
    }

    // 6. Persist Files into Workspace
    for (const f of fetchedFiles) {
      try {
        await WorkspaceService.saveFile({
          roomId: createdRoom.id,
          path: f.path,
          content: f.content,
          language: f.language,
        });
      } catch {
        if (fallbackMemoryFiles) {
          const fileId = `file_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
          fallbackMemoryFiles.set(fileId, {
            id: fileId,
            room_id: createdRoom.id,
            path: f.path,
            content: f.content,
            language: f.language,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // 7. Analyze Project Profile
    const projectProfile = ProjectDetectionService.analyzeProject(
      fetchedFiles.map((f) => ({ path: f.path, content: f.content }))
    );

    createdRoom.primaryLanguage = projectProfile.primaryLanguage;

    return {
      room: createdRoom,
      filesCount: fetchedFiles.length,
      projectProfile,
      repositoryUrl: `https://github.com/${owner}/${repo}`,
      branch: targetBranch,
      commitSha,
    };
  }

  private static mapLanguage(filePath: string): SupportedLanguage {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    switch (ext) {
      case 'py': return 'python';
      case 'ts':
      case 'tsx': return 'typescript';
      case 'js':
      case 'jsx':
      case 'mjs': return 'javascript';
      case 'json': return 'json';
      case 'html': return 'html';
      case 'css': return 'css';
      case 'md': return 'markdown';
      case 'rs': return 'rust';
      case 'go': return 'go';
      case 'java': return 'java';
      case 'c':
      case 'cpp':
      case 'h':
      case 'hpp': return 'cpp';
      case 'cs': return 'csharp';
      case 'php': return 'php';
      case 'rb': return 'ruby';
      case 'dart': return 'dart';
      case 'sql': return 'sql';
      case 'sh':
      case 'bash': return 'shell';
      case 'yaml':
      case 'yml': return 'yaml';
      default: return 'plaintext';
    }
  }
}
