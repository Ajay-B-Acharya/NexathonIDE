import React, { useRef, useEffect } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  Code2,
  X,
  Command,
  ChevronRight,
  Eye,
  Lock,
} from 'lucide-react';
import { FollowState, LineLockNotice, SupportedLanguage, WorkspaceFile } from '../types';
import { ThemeMode } from './ThemeToggle';

interface EditorPaneProps {
  openFiles: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  dirtyFileIds: Set<string>;
  followState?: FollowState | null;
  lineLockNotice?: LineLockNotice | null;
  currentUserId?: string;
  theme?: ThemeMode;
  onSelectTab: (file: WorkspaceFile) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onLanguageChange: (file: WorkspaceFile, language: SupportedLanguage) => void;
  onStopFollowing?: () => void;
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
  followState = null,
  lineLockNotice = null,
  theme = 'dark',
  onSelectTab,
  onCloseTab,
  onLanguageChange,
  onStopFollowing,
  onEditorReady,
}) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const isDark = theme !== 'light';

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme('nexathon-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#000000',
        'editor.foreground': '#FFFFFF',
        'editor.lineHighlightBackground': '#111111',
        'editorLineNumber.foreground': '#555555',
        'editorLineNumber.activeForeground': '#FF7057',
        'editorGutter.background': '#000000',
        'editor.selectionBackground': '#262626',
        'editor.inactiveSelectionBackground': '#1A1A1A',
      },
    });

    monaco.editor.defineTheme('nexathon-titanium', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#FFF9F0',
        'editor.foreground': '#1C1917',
        'editor.lineHighlightBackground': '#F5EBE1',
        'editorLineNumber.foreground': '#A8A29E',
        'editorLineNumber.activeForeground': '#FF7057',
        'editorGutter.background': '#FFF9F0',
        'editor.selectionBackground': '#EFE3D2',
        'editor.inactiveSelectionBackground': '#EFE3D280',
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
        <div className="w-full max-w-md rounded-2xl border theme-border theme-bg-surface-1 p-6 neu-card backdrop-blur-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FF7057]/15 text-[#FF7057] ring-1 ring-[#FF7057]/30 neu-button">
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
              <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-[#FF7057]">
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden theme-bg-root">
      {/* File Tabs Bar & Action Strip */}
      <div className="flex h-11 items-center justify-between border-b theme-border theme-bg-surface-1 px-3 neu-inset">
        {/* Open Files Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile.id;
            const isDirty = dirtyFileIds.has(file.id);

            return (
              <div
                key={file.id}
                onClick={() => onSelectTab(file)}
                className={`group flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0 h-8 ${
                  isActive
                    ? 'border-[#FF7057]/40 bg-[#FF7057]/10 text-[#FF7057] shadow-xs neu-card'
                    : 'border-transparent theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary'
                }`}
              >
                <Code2 className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="max-w-[140px] truncate">{file.name}</span>
                {isDirty && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-[#FF7057]"
                    title="Unsaved changes"
                  />
                )}
                <button
                  type="button"
                  onClick={(e) => onCloseTab(file.id, e)}
                  className="rounded p-0.5 theme-text-secondary opacity-70 hover:theme-bg-surface-2 hover:theme-text-primary group-hover:opacity-100 transition-opacity"
                  title="Close Tab"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* File Path Breadcrumb & Language Selector */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1 text-xs font-mono theme-text-secondary truncate max-w-[220px]">
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
            className="h-8 rounded-lg border theme-border theme-bg-surface-2 px-2.5 text-xs font-semibold theme-text-primary focus:border-[#FF7057] focus:outline-none cursor-pointer shadow-2xs"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="theme-bg-surface-1 theme-text-primary">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Follow Mode Status Banner */}
      {followState && (
        <div className="flex items-center justify-between border-b border-cyan-500/40 bg-cyan-950/60 px-3 py-1 text-xs text-cyan-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
            <span>
              Pair Programming Active: Following <strong>{followState.targetUserName}</strong>.
              Your editor viewport automatically tracks their cursor.
            </span>
          </div>
          <button
            type="button"
            onClick={onStopFollowing}
            className="rounded border border-cyan-500/40 bg-cyan-900/60 hover:bg-cyan-800 px-2.5 py-0.5 text-[11px] font-semibold text-white transition cursor-pointer"
          >
            Stop Following (Esc)
          </button>
        </div>
      )}

      {/* Monaco Editor Container */}
      <div className="relative flex-1 overflow-hidden">
        {/* Real-time Line Lock Toast Notification */}
        {lineLockNotice && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-neutral-900/95 dark:bg-black/95 text-white border border-[#FF7057]/60 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200 pointer-events-none select-none max-w-[90%]">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#FF7057]/20 text-[#FF7057]">
              <Lock className="h-3 w-3 stroke-[2.5]" />
            </div>
            <span className="text-xs font-medium text-neutral-200 truncate">
              <span className="font-semibold text-white">Line {lineLockNotice.line}</span> is locked by{' '}
              <span className="font-semibold" style={{ color: lineLockNotice.userColor || '#FF7057' }}>
                {lineLockNotice.userName}
              </span>
              . Simultaneous editing on this line is disabled.
            </span>
          </div>
        )}

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
            glyphMargin: true,
            dragAndDrop: false,
            readOnlyMessage: {
              value: '🔒 Line is locked by another collaborator actively typing here.',
            },
          }}
        />
      </div>
    </div>
  );
};
