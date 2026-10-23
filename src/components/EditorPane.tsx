import React from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { Code2, X, Command, Sparkles, ChevronRight, ArrowLeft } from 'lucide-react';
import { SupportedLanguage, WorkspaceFile } from '../types';
import { ThemeMode } from './ThemeToggle';

interface EditorPaneProps {
  openFiles: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  dirtyFileIds: Set<string>;
  theme?: ThemeMode;
  onSelectTab: (file: WorkspaceFile) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onLanguageChange: (file: WorkspaceFile, language: SupportedLanguage) => void;
  onEditorReady: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => void;
  onSwitchWorkspace?: () => void;
}

const LANGUAGES: { label: string; value: SupportedLanguage }[] = [
  { label: 'Python', value: 'python' },
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'JSON', value: 'json' },
  { label: 'HTML', value: 'html' },
  { label: 'CSS', value: 'css' },
  { label: 'Markdown', value: 'markdown' },
];

export const EditorPane: React.FC<EditorPaneProps> = ({
  openFiles,
  activeFile,
  dirtyFileIds,
  theme = 'dark',
  onSelectTab,
  onCloseTab,
  onLanguageChange,
  onEditorReady,
  onSwitchWorkspace,
}) => {
  const isDark = theme !== 'light';
  const editorRef = React.useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = React.useRef<typeof Monaco | null>(null);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.defineTheme('nexathon-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#06080e',
        'editor.lineHighlightBackground': '#14182499',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#818cf8',
        'editorGutter.background': '#06080e',
        'editor.selectionBackground': '#6366f133',
        'editor.inactiveSelectionBackground': '#6366f11a',
      },
    });

    monaco.editor.defineTheme('nexathon-titanium', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f1f5f999',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#4f46e5',
        'editorGutter.background': '#ffffff',
        'editor.selectionBackground': '#6366f122',
        'editor.inactiveSelectionBackground': '#6366f111',
      },
    });

    monaco.editor.setTheme(isDark ? 'nexathon-obsidian' : 'nexathon-titanium');
    onEditorReady(editor, monaco);
  };

  React.useEffect(() => {
    const activeMonaco = monacoRef.current || (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (activeMonaco?.editor) {
      activeMonaco.editor.setTheme(isDark ? 'nexathon-obsidian' : 'nexathon-titanium');
    }
  }, [isDark]);

  if (!activeFile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center theme-bg-root bg-grid-pattern p-6 select-none transition-colors">
        <div className="w-full max-w-md rounded-2xl border theme-border theme-bg-surface-1 p-6 theme-shadow backdrop-blur-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 ring-1 ring-indigo-500/30">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold theme-text-primary">
                Nexathon Command Center
              </h3>
              <p className="text-xs theme-text-secondary">
                Select or create a file in the Explorer to begin live editing
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 px-3 py-2">
              <span className="theme-text-primary">Save File to PostgreSQL</span>
              <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-indigo-500 dark:text-indigo-300">
                Ctrl + S
              </kbd>
            </div>

            <div className="flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 px-3 py-2">
              <span className="theme-text-primary">
                Execute in Sandbox (Pyodide / QuickJS)
              </span>
              <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-300">
                Ctrl + Enter
              </kbd>
            </div>

            <div className="flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 px-3 py-2">
              <span className="theme-text-primary">Toggle File Explorer</span>
              <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] theme-text-secondary">
                Ctrl + B
              </kbd>
            </div>

            {onSwitchWorkspace && (
              <button
                type="button"
                onClick={onSwitchWorkspace}
                className="w-full flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 hover:border-indigo-500/40 hover:theme-bg-elevated transition cursor-pointer text-left"
              >
                <span className="flex items-center gap-2 theme-text-primary font-medium">
                  <ArrowLeft className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />
                  Exit to Workspaces Dashboard
                </span>
                <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-indigo-500 dark:text-indigo-300">
                  Exit
                </kbd>
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-indigo-500 dark:text-indigo-300">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Every file has an isolated Yjs CRDT buffer & live cursor presence</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col theme-bg-root overflow-hidden transition-colors">
      {/* Tabs & Breadcrumb Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b theme-border theme-bg-surface-1 pr-3">
        {/* Scrollable File Tabs */}
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile.id;
            const isDirty = dirtyFileIds.has(file.id);

            return (
              <div
                key={file.id}
                onClick={() => onSelectTab(file)}
                className={`group flex h-9 cursor-pointer items-center gap-2 border-r theme-border px-3.5 text-xs transition-all select-none ${
                  isActive
                    ? 'border-b-2 border-b-indigo-500 theme-bg-root theme-text-primary font-medium shadow-xs'
                    : 'theme-bg-surface-1 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary'
                }`}
              >
                <Code2
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-indigo-500 dark:text-indigo-400' : 'theme-text-secondary'
                  }`}
                />
                <span className="max-w-[140px] truncate">{file.name}</span>
                {isDirty && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                    title="Unsaved changes (Ctrl+S to save)"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => onCloseTab(file.id, e)}
                  className="rounded p-0.5 theme-text-secondary opacity-70 hover:theme-bg-surface-2 hover:theme-text-primary group-hover:opacity-100"
                  title="Close Tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* File Path Breadcrumb & Language Selector */}
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-1 text-[11px] font-mono theme-text-secondary truncate max-w-[240px]">
            {activeFile.path.split('/').map((segment, idx, arr) => (
              <React.Fragment key={`${segment}-${idx}`}>
                <span className={idx === arr.length - 1 ? 'theme-text-primary font-medium' : ''}>
                  {segment}
                </span>
                {idx < arr.length - 1 && (
                  <ChevronRight className="h-3 w-3 opacity-50" />
                )}
              </React.Fragment>
            ))}
          </div>

          <select
            value={activeFile.language}
            onChange={(e) =>
              onLanguageChange(activeFile, e.target.value as SupportedLanguage)
            }
            aria-label="Syntax Highlighting Language"
            className="rounded-md border theme-border theme-bg-surface-2 px-2.5 py-0.5 text-xs font-medium theme-text-primary focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="theme-bg-surface-1 theme-text-primary">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="relative flex-1 overflow-hidden">
        <Editor
          height="100%"
          theme={isDark ? 'nexathon-obsidian' : 'nexathon-titanium'}
          defaultLanguage={activeFile.language}
          onMount={handleEditorMount}
          options={{
            fontSize: 13.5,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            padding: { top: 12 },
            renderLineHighlight: 'all',
          }}
        />
      </div>
    </div>
  );
};
