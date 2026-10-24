import type {
  ProjectProfile,
  ProjectLanguageBreakdown,
  AvailableRuntimeInfo,
  SuggestedCommand,
} from '../../types/index.js';

interface SimpleWorkspaceFile {
  path: string;
  content?: string;
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  py: 'Python',
  pyw: 'Python',
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  c: 'C',
  h: 'C/C++ Header',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  hpp: 'C++',
  cs: 'C#',
  php: 'PHP',
  rb: 'Ruby',
  dart: 'Dart',
  html: 'HTML',
  htm: 'HTML',
  css: 'CSS',
  scss: 'SCSS',
  json: 'JSON',
  md: 'Markdown',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Shell',
  yaml: 'YAML',
  yml: 'YAML',
  toml: 'TOML',
};

export class ProjectDetectionService {
  /**
   * Performs language-agnostic project detection across all workspace files.
   */
  static analyzeProject(files: SimpleWorkspaceFile[]): ProjectProfile {
    if (!files || files.length === 0) {
      return this.getDefaultProfile();
    }

    // 1. Language Breakdown by file count and estimated lines
    const langCounts: Record<string, number> = {};
    let totalCodeFiles = 0;

    for (const file of files) {
      const ext = file.path.split('.').pop()?.toLowerCase() || '';
      const lang = EXTENSION_LANGUAGE_MAP[ext];
      if (lang && lang !== 'Markdown' && lang !== 'JSON' && lang !== 'YAML' && lang !== 'TOML') {
        langCounts[lang] = (langCounts[lang] || 0) + 1;
        totalCodeFiles++;
      }
    }

    const detectedLanguages: ProjectLanguageBreakdown[] = Object.entries(langCounts)
      .map(([language, count]) => ({
        language,
        fileCount: count,
        percentage: totalCodeFiles > 0 ? Math.round((count / totalCodeFiles) * 100) : 0,
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    const primaryLanguage = detectedLanguages.length > 0 ? detectedLanguages[0].language : 'Plain Text';

    // 2. Discover Manifests
    const filePaths = new Set(files.map((f) => f.path.replace(/^\/+/, '')));
    const manifests: string[] = [];
    const frameworks: string[] = [];
    const buildSystems: string[] = [];
    const suggestedCommands: SuggestedCommand[] = [];

    // Helper to get file content safely
    const getFileContent = (targetPath: string): string | undefined => {
      const match = files.find(
        (f) => f.path.replace(/^\/+/, '').toLowerCase() === targetPath.toLowerCase()
      );
      return match?.content;
    };

    // A. Node / JS / TS ecosystem
    if (filePaths.has('package.json')) {
      manifests.push('package.json');
      buildSystems.push('npm / Node.js');

      const pkgContent = getFileContent('package.json');
      if (pkgContent) {
        try {
          const pkg = JSON.parse(pkgContent);
          const allDeps = {
            ...(pkg.dependencies || {}),
            ...(pkg.devDependencies || {}),
          };

          // Frameworks
          if (allDeps['react']) frameworks.push('React');
          if (allDeps['next']) frameworks.push('Next.js');
          if (allDeps['vite']) frameworks.push('Vite');
          if (allDeps['vue']) frameworks.push('Vue.js');
          if (allDeps['@angular/core']) frameworks.push('Angular');
          if (allDeps['svelte']) frameworks.push('Svelte');
          if (allDeps['express']) frameworks.push('Express');
          if (allDeps['fastify']) frameworks.push('Fastify');
          if (allDeps['tailwindcss']) frameworks.push('Tailwind CSS');
          if (allDeps['@nestjs/core']) frameworks.push('NestJS');
          if (allDeps['prisma']) frameworks.push('Prisma ORM');
          if (allDeps['vitest']) frameworks.push('Vitest');
          if (allDeps['jest']) frameworks.push('Jest');
          if (allDeps['yjs']) frameworks.push('Yjs CRDT');

          // Scripts -> Commands
          if (pkg.scripts && typeof pkg.scripts === 'object') {
            for (const [scriptName, scriptCmd] of Object.entries(pkg.scripts)) {
              if (typeof scriptCmd === 'string') {
                suggestedCommands.push({
                  title: `npm run ${scriptName}`,
                  command: `npm run ${scriptName}`,
                  description: `Runs script "${scriptName}" (${scriptCmd.slice(0, 40)})`,
                  category: scriptName.includes('test')
                    ? 'test'
                    : scriptName.includes('build')
                    ? 'build'
                    : 'run',
                });
              }
            }
          }
        } catch {
          // Ignore invalid package.json syntax
        }
      }

      if (filePaths.has('tsconfig.json')) {
        manifests.push('tsconfig.json');
        frameworks.push('TypeScript');
      }
    }

    // B. Python ecosystem
    if (filePaths.has('requirements.txt') || filePaths.has('pyproject.toml') || filePaths.has('Pipfile')) {
      if (filePaths.has('requirements.txt')) manifests.push('requirements.txt');
      if (filePaths.has('pyproject.toml')) manifests.push('pyproject.toml');
      buildSystems.push('pip / Python');

      const reqContent =
        getFileContent('requirements.txt') || getFileContent('pyproject.toml') || '';
      const lowerReq = reqContent.toLowerCase();

      if (lowerReq.includes('fastapi')) frameworks.push('FastAPI');
      if (lowerReq.includes('flask')) frameworks.push('Flask');
      if (lowerReq.includes('django')) frameworks.push('Django');
      if (lowerReq.includes('numpy')) frameworks.push('NumPy');
      if (lowerReq.includes('pandas')) frameworks.push('Pandas');
      if (lowerReq.includes('torch')) frameworks.push('PyTorch');
      if (lowerReq.includes('pytest')) frameworks.push('Pytest');

      suggestedCommands.push({
        title: 'Run Python Script',
        command: 'python main.py',
        description: 'Execute main Python script via WASM or POSIX container',
        category: 'run',
      });
      if (lowerReq.includes('pytest')) {
        suggestedCommands.push({
          title: 'Run Pytest Tests',
          command: 'pytest',
          description: 'Run automated Python unit tests',
          category: 'test',
        });
      }
    }

    // C. Rust ecosystem
    if (filePaths.has('Cargo.toml')) {
      manifests.push('Cargo.toml');
      buildSystems.push('Cargo / Rust');

      const cargoContent = getFileContent('Cargo.toml') || '';
      if (cargoContent.includes('actix-web')) frameworks.push('Actix Web');
      if (cargoContent.includes('axum')) frameworks.push('Axum');
      if (cargoContent.includes('tokio')) frameworks.push('Tokio Async');
      if (cargoContent.includes('serde')) frameworks.push('Serde');

      suggestedCommands.push(
        {
          title: 'Cargo Check',
          command: 'cargo check',
          description: 'Quickly check the Rust project for compilation errors',
          category: 'build',
        },
        {
          title: 'Cargo Build',
          command: 'cargo build',
          description: 'Compile the Rust binary or library',
          category: 'build',
        },
        {
          title: 'Cargo Test',
          command: 'cargo test',
          description: 'Run Rust unit and integration tests',
          category: 'test',
        }
      );
    }

    // D. Go ecosystem
    if (filePaths.has('go.mod')) {
      manifests.push('go.mod');
      buildSystems.push('Go Toolchain');

      const goModContent = getFileContent('go.mod') || '';
      if (goModContent.includes('github.com/gin-gonic/gin')) frameworks.push('Gin Web');
      if (goModContent.includes('github.com/labstack/echo')) frameworks.push('Echo');
      if (goModContent.includes('github.com/gofiber/fiber')) frameworks.push('Fiber');

      suggestedCommands.push(
        {
          title: 'Go Run',
          command: 'go run .',
          description: 'Compile and run the Go application',
          category: 'run',
        },
        {
          title: 'Go Test',
          command: 'go test ./...',
          description: 'Run all Go package tests',
          category: 'test',
        }
      );
    }

    // E. Java ecosystem
    if (filePaths.has('pom.xml')) {
      manifests.push('pom.xml');
      buildSystems.push('Apache Maven');
      frameworks.push('Java');
      suggestedCommands.push({
        title: 'Maven Build',
        command: 'mvn clean compile',
        description: 'Compile Java sources with Maven',
        category: 'build',
      });
    } else if (filePaths.has('build.gradle') || filePaths.has('build.gradle.kts')) {
      manifests.push(filePaths.has('build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle');
      buildSystems.push('Gradle');
      frameworks.push('Java / Kotlin');
      suggestedCommands.push({
        title: 'Gradle Build',
        command: './gradlew build',
        description: 'Assemble and test project with Gradle',
        category: 'build',
      });
    }

    // F. C / C++ build systems
    if (filePaths.has('CMakeLists.txt')) {
      manifests.push('CMakeLists.txt');
      buildSystems.push('CMake');
      suggestedCommands.push({
        title: 'CMake Configure',
        command: 'cmake -B build',
        description: 'Generate build system with CMake',
        category: 'build',
      });
    }
    if (filePaths.has('Makefile')) {
      manifests.push('Makefile');
      buildSystems.push('GNU Make');
      suggestedCommands.push({
        title: 'Make',
        command: 'make',
        description: 'Run default Makefile target',
        category: 'build',
      });
    }

    // G. Docker containerization
    if (filePaths.has('Dockerfile') || filePaths.has('docker-compose.yml')) {
      manifests.push('Dockerfile');
      frameworks.push('Docker Container');
    }

    // 3. Entry point detection
    const entryPoints: string[] = [];
    const candidateEntryPaths = [
      'src/index.ts',
      'src/index.tsx',
      'src/main.ts',
      'src/main.tsx',
      'src/App.tsx',
      'index.js',
      'index.ts',
      'index.html',
      'main.py',
      'app.py',
      'server.py',
      'src/main.rs',
      'main.go',
    ];

    for (const cand of candidateEntryPaths) {
      if (filePaths.has(cand)) {
        entryPoints.push(cand);
      }
    }

    // 4. Available Runtimes (Honest, discoverable reporting)
    const availableRuntimes: AvailableRuntimeInfo[] = [
      {
        name: 'Python (Pyodide 3.12 WASM)',
        environment: 'wasm',
        isReady: primaryLanguage === 'Python' || detectedLanguages.some((l) => l.language === 'Python'),
        description: 'Instant in-browser WebAssembly execution with NumPy, Pandas and Matplotlib support.',
      },
      {
        name: 'JavaScript / TypeScript (QuickJS)',
        environment: 'wasm',
        isReady:
          primaryLanguage === 'JavaScript' ||
          primaryLanguage === 'TypeScript' ||
          detectedLanguages.some((l) => l.language === 'JavaScript' || l.language === 'TypeScript'),
        description: 'Sandboxed ES2023 execution worker with memory boundaries and traceback analysis.',
      },
      {
        name: 'Cloud Terminal (Node-PTY POSIX)',
        environment: 'container',
        isReady: true,
        description: 'Interactive pseudo-terminal shell with real-time bidirectional xterm.js streaming.',
      },
      {
        name: 'Static Web Preview (HTML/CSS/JS)',
        environment: 'preview',
        isReady: filePaths.has('index.html'),
        description: 'Live sandboxed browser rendering for web applications and client components.',
      },
    ];

    // Check Monorepo
    const isMonorepo =
      filePaths.has('pnpm-workspace.yaml') ||
      filePaths.has('lerna.json') ||
      (filePaths.has('package.json') &&
        Boolean(getFileContent('package.json')?.includes('"workspaces"')));

    // Confidence
    const detectionConfidence =
      manifests.length > 0 && entryPoints.length > 0
        ? 'high'
        : manifests.length > 0 || detectedLanguages.length > 0
        ? 'medium'
        : 'low';

    return {
      detectedLanguages,
      primaryLanguage,
      frameworks: Array.from(new Set(frameworks)),
      buildSystems: Array.from(new Set(buildSystems)),
      manifests,
      entryPoints,
      availableRuntimes,
      suggestedCommands: suggestedCommands.slice(0, 8),
      detectionConfidence,
      isMonorepo,
    };
  }

  static getDefaultProfile(): ProjectProfile {
    return {
      detectedLanguages: [{ language: 'JavaScript', fileCount: 1, percentage: 100 }],
      primaryLanguage: 'JavaScript',
      frameworks: [],
      buildSystems: ['Node.js'],
      manifests: [],
      entryPoints: [],
      availableRuntimes: [
        {
          name: 'Cloud Terminal',
          environment: 'container',
          isReady: true,
          description: 'Bidirectional POSIX shell stream',
        },
      ],
      suggestedCommands: [],
      detectionConfidence: 'low',
    };
  }
}
