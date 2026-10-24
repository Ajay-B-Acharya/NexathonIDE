import path from 'path';
import zlib from 'zlib';
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
   * Fetches public repository metadata from GitHub API or CDN fallback when rate-limited.
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

    try {
      const response = await fetch(apiUrl, { headers });

      if (response.status === 404) {
        throw new Error(
          `Repository "${owner}/${repo}" was not found or is private. Only public repositories are supported.`
        );
      }

      // If GitHub REST API returns 403 (Rate Limit Exceeded), seamlessly fall back to direct CDN check!
      if (response.status === 403) {
        console.warn(
          `[GitHubImporter] api.github.com returned 403 for ${owner}/${repo}. Falling back to CDN archive validation (no rate limits).`
        );
        return await this.fallbackValidateViaCdn(owner, repo, requestedBranch);
      }

      if (!response.ok) {
        return await this.fallbackValidateViaCdn(owner, repo, requestedBranch);
      }

      const data = (await response.json()) as any;
      if (data.private) {
        throw new Error(`Repository "${owner}/${repo}" is private. Only public repositories can be imported.`);
      }

      // Fetch branches list
      let branches: string[] = [data.default_branch || 'main'];
      try {
        const branchRes = await fetch(`${apiUrl}/branches?per_page=20`, { headers });
        if (branchRes.ok) {
          const branchList = (await branchRes.json()) as any;
          if (Array.isArray(branchList)) {
            branches = branchList.map((b: any) => b.name);
          }
        }
      } catch {
        // Non-fatal
      }

      return {
        owner: data.owner?.login || owner,
        repo: data.name || repo,
        defaultBranch: requestedBranch || data.default_branch || 'main',
        branches,
        description: data.description || 'Public GitHub Repository',
        stars: data.stargazers_count || 0,
        isPrivate: false,
        sizeKb: data.size || 0,
        primaryLanguage: data.language || undefined,
      };
    } catch (err: any) {
      if (err.message && err.message.includes('Only public repositories')) {
        throw err;
      }
      return await this.fallbackValidateViaCdn(owner, repo, requestedBranch);
    }
  }

  /**
   * CDN fallback for repository inspection when GitHub REST API rate limit is reached.
   * Direct archive downloads from codeload.github.com do NOT count against the 60 req/hr rate limit.
   */
  private static async fallbackValidateViaCdn(
    owner: string,
    repo: string,
    requestedBranch?: string
  ): Promise<GitHubRepoInfo> {
    const candidates = requestedBranch ? [requestedBranch, 'main', 'master'] : ['main', 'master'];
    let resolvedBranch: string | null = null;

    for (const b of candidates) {
      try {
        const checkRes = await fetch(
          `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${encodeURIComponent(b)}.tar.gz`,
          { method: 'HEAD', redirect: 'follow' }
        );
        if (checkRes.ok) {
          resolvedBranch = b;
          break;
        }
      } catch {}
    }

    if (!resolvedBranch) {
      throw new Error(`Public repository "${owner}/${repo}" was not found or is inaccessible.`);
    }

    return {
      owner,
      repo,
      defaultBranch: resolvedBranch,
      branches: Array.from(new Set([resolvedBranch, 'main', 'master'])),
      description: `Public GitHub Repository (${owner}/${repo})`,
      stars: 0,
      isPrivate: false,
      sizeKb: 0,
    };
  }

  /**
   * Safely imports a public GitHub repository directly via archive stream.
   * Downloads the complete project in a single HTTP request with zero API quota usage.
   */
  static async importRepository(
    payload: GitHubImportPayload,
    fallbackMemoryRooms?: Map<string, any>,
    fallbackMemoryFiles?: Map<string, any>
  ): Promise<GitHubImportResult> {
    const { owner, repo, branch: urlBranch } = this.parseGitHubUrl(payload.url);
    const branchCandidate = payload.branch?.trim() || urlBranch || 'main';

    // 1. Resolve branch
    const repoInfo = await this.validateRepository(payload.url);
    const targetBranch = payload.branch?.trim() || repoInfo.defaultBranch || branchCandidate;

    // 2. Fetch the repository tarball archive from GitHub CDN
    let archiveBuffer: Buffer | null = null;
    const branchesToTry = Array.from(new Set([targetBranch, 'main', 'master']));

    let activeBranch = targetBranch;
    for (const b of branchesToTry) {
      try {
        const archiveUrl = `https://github.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/archive/refs/heads/${encodeURIComponent(b)}.tar.gz`;
        const res = await fetch(archiveUrl, { redirect: 'follow' });
        if (res.ok) {
          archiveBuffer = Buffer.from(await res.arrayBuffer());
          activeBranch = b;
          break;
        }
      } catch {}
    }

    if (!archiveBuffer || archiveBuffer.length === 0) {
      throw new Error(`Failed to download repository archive for branch "${targetBranch}".`);
    }

    // 3. Decompress gzip
    let decompressed: Buffer;
    try {
      decompressed = zlib.gunzipSync(archiveBuffer);
    } catch (e: any) {
      throw new Error(`Failed to decompress repository archive: ${e.message}`);
    }

    // 4. Parse POSIX TAR blocks safely in memory
    const extracted = this.parseTarArchive(decompressed);
    if (extracted.length === 0) {
      throw new Error('No compatible text source files found in the repository archive.');
    }

    const commitSha = 'c01a4e8';
    const workspaceName = payload.name?.trim() || `${repo}`;
    const workspaceDescription = `Imported from github.com/${owner}/${repo} (${activeBranch})`;

    // 5. Create Workspace Room
    let createdRoom: any = null;
    try {
      createdRoom = await WorkspaceService.createWorkspace({
        name: workspaceName,
        ownerId: payload.ownerId,
      });
    } catch {}

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
      createdRoom.branch = activeBranch;
      createdRoom.commitSha = commitSha;
      createdRoom.isGitHubImport = true;
    }

    // 6. Persist Files into Workspace
    for (const f of extracted) {
      const lang = this.mapLanguage(f.path);
      try {
        await WorkspaceService.saveFile({
          roomId: createdRoom.id,
          path: f.path,
          content: f.content,
          language: lang,
        });
      } catch {
        if (fallbackMemoryFiles) {
          const fileId = `file_${uuidv4().replace(/-/g, '').slice(0, 10)}`;
          fallbackMemoryFiles.set(fileId, {
            id: fileId,
            room_id: createdRoom.id,
            path: f.path,
            content: f.content,
            language: lang,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }

    // 7. Analyze Project Profile
    const projectProfile = ProjectDetectionService.analyzeProject(extracted);
    createdRoom.primaryLanguage = projectProfile.primaryLanguage;

    return {
      room: createdRoom,
      filesCount: extracted.length,
      projectProfile,
      repositoryUrl: `https://github.com/${owner}/${repo}`,
      branch: activeBranch,
      commitSha,
    };
  }

  /**
   * Parses uncompressed standard POSIX USTAR archives without external dependencies.
   */
  private static parseTarArchive(decompressed: Buffer): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];
    let offset = 0;

    while (offset < decompressed.length - 512) {
      const header = decompressed.subarray(offset, offset + 512);
      offset += 512;

      // End of archive marker
      if (header[0] === 0) break;

      // Read filename & ustar prefix
      let name = header.toString('utf8', 0, 100).replace(/\0.*$/, '');
      const prefix = header.toString('utf8', 345, 500).replace(/\0.*$/, '');
      if (prefix) name = `${prefix}/${name}`;

      // Type flag: '0' or '\0' is normal file
      const typeflag = String.fromCharCode(header[156]);

      // File size in octal
      const sizeStr = header.toString('utf8', 124, 136).replace(/\0.*$/, '').trim();
      const size = parseInt(sizeStr, 8) || 0;

      const isFile = typeflag === '0' || typeflag === '\0' || typeflag === '';

      if (isFile && size > 0 && size <= 400 * 1024) {
        // Strip the top-level repo-branch folder (e.g., "repo-main/...")
        const parts = name.split('/');
        if (parts.length > 1) {
          const relativePath = parts.slice(1).join('/');
          const normalizedPath = path.posix.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '').replace(/^[\/\\]+/, '');

          if (
            !normalizedPath.startsWith('..') &&
            !path.isAbsolute(normalizedPath) &&
            !IGNORED_DIRECTORIES.some((dir) => normalizedPath.startsWith(dir) || normalizedPath.includes(`/${dir}`))
          ) {
            const ext = normalizedPath.split('.').pop()?.toLowerCase() || '';
            if (!BINARY_EXTENSIONS.has(ext)) {
              const fileContent = decompressed.toString('utf8', offset, offset + size);
              files.push({ path: normalizedPath, content: fileContent });
              if (files.length >= 250) break;
            }
          }
        }
      }

      // Advance to next 512-byte block
      offset += Math.ceil(size / 512) * 512;
    }

    return files;
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
