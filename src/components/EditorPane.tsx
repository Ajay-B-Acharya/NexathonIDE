import React, { useState, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  Code2,
  X,
  Command,
  Sparkles,
  ChevronRight,
  Shield,
  ShieldAlert,
  Unlock,
  Eye,
} from 'lucide-react';
import { EditReservation, FollowState, SupportedLanguage, WorkspaceFile } from '../types';

interface EditorPaneProps {
  openFiles: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  dirtyFileIds: Set<string>;
  reservations?: EditReservation[];
  activeConflictReservation?: EditReservation | null;
  followState?: FollowState | null;
  currentUserId?: string;
  onSelectTab: (file: WorkspaceFile) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onLanguageChange: (file: WorkspaceFile, language: SupportedLanguage) => void;
  onReserveSelection?: (startLine: number, endLine: number) => void;
  onReleaseReservation?: (reservationId: string) => void;
  onStopFollowing?: () => void;
  onEditorReady: (
    editor: Monaco.editor.IStandaloneCodeEditor,
    monaco: typeof Monaco
  ) => void;
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
  reservations = [],
  activeConflictReservation = null,
  followState = null,
  currentUserId = '',
  onSelectTab,
  onCloseTab,
  onLanguageChange,
  onReserveSelection,
  onReleaseReservation,
  onStopFollowing,
  onEditorReady,
}) => {
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const myReservation = reservations.find(
    (r) => r.ownerId === currentUserId && r.filePath === activeFile?.path
  );

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('nexathon-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#090a0f',
        'editor.lineHighlightBackground': '#14182499',
        'editorLineNumber.foreground': '#475569',
        'editorLineNumber.activeForeground': '#818cf8',
        'editorGutter.background': '#090a0f',
        'editor.selectionBackground': '#6366f133',
        'editor.inactiveSelectionBackground': '#6366f11a',
      },
    });
    monaco.editor.setTheme('nexathon-obsidian');

    // Track user selection for reserving line sections
    editor.onDidChangeCursorSelection((e) => {
      const sel = e.selection;
      if (sel && sel.startLineNumber && sel.endLineNumber) {
        setSelectedRange({
          startLine: Math.min(sel.startLineNumber, sel.endLineNumber),
          endLine: Math.max(sel.startLineNumber, sel.endLineNumber),
        });
      }
    });

    onEditorReady(editor, monaco);
  };

  if (!activeFile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#090a0f] bg-grid-pattern p-6 select-none">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f121d]/90 p-6 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/30">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                Nexathon Command Center
              </h3>
              <p className="text-xs text-slate-400">
                Select or create a file in the Explorer to begin live editing
              </p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#141824] px-3 py-2">
              <span className="text-slate-300">Save File to PostgreSQL</span>
              <kbd className="rounded border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[11px] text-indigo-300">
                Ctrl + S
              </kbd>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#141824] px-3 py-2">
              <span className="text-slate-300">
                Execute in Sandbox (Pyodide / QuickJS)
              </span>
              <kbd className="rounded border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                Ctrl + Enter
              </kbd>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-white/5 bg-[#141824] px-3 py-2">
              <span className="text-slate-300">Toggle File Explorer</span>
              <kbd className="rounded border border-white/10 bg-black/40 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                Ctrl + B
              </kbd>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-indigo-300/80">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Every file has an isolated Yjs CRDT buffer & live cursor presence</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-[#090a0f] overflow-hidden">
      {/* Tabs & Breadcrumb Bar */}
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-white/10 bg-[#0f121d] pr-3">
        {/* Scrollable File Tabs */}
        <div className="flex items-center overflow-x-auto no-scrollbar">
          {openFiles.map((file) => {
            const isActive = file.id === activeFile.id;
            const isDirty = dirtyFileIds.has(file.id);

            return (
              <div
                key={file.id}
                onClick={() => onSelectTab(file)}
                className={`group flex h-9 cursor-pointer items-center gap-2 border-r border-white/10 px-3.5 text-xs transition-all select-none ${
                  isActive
                    ? 'border-b-2 border-b-indigo-500 bg-[#090a0f] text-white font-medium shadow-[0_4px_12px_rgba(99,102,241,0.15)]'
                    : 'bg-[#0f121d] text-slate-400 hover:bg-[#141824] hover:text-slate-200'
                }`}
              >
                <Code2
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-indigo-400' : 'text-slate-500'
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
                  className="rounded p-0.5 text-slate-500 opacity-70 hover:bg-white/10 hover:text-white group-hover:opacity-100"
                  title="Close Tab"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>

        {/* File Path Breadcrumb & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Reservation Controls */}
          {myReservation ? (
            <button
              type="button"
              onClick={() => onReleaseReservation?.(myReservation.id)}
              title="Click to release your edit reservation on this section"
              className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/40 bg-indigo-950/50 px-2 py-0.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-900/60 transition cursor-pointer"
            >
              <Unlock className="h-3 w-3 text-indigo-400" />
              <span>Release Lines {myReservation.startLine}–{myReservation.endLine}</span>
            </button>
          ) : selectedRange && selectedRange.endLine >= selectedRange.startLine ? (
            <button
              type="button"
              onClick={() => onReserveSelection?.(selectedRange.startLine, selectedRange.endLine)}
              title={`Reserve lines ${selectedRange.startLine}–${selectedRange.endLine} for focused editing`}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-[#141824] px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:border-indigo-500/40 hover:text-indigo-200 transition cursor-pointer"
            >
              <Shield className="h-3 w-3 text-indigo-400" />
              <span>Reserve Lines {selectedRange.startLine}–{selectedRange.endLine}</span>
            </button>
          ) : null}

          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono text-slate-400 truncate max-w-[180px]">
            {activeFile.path.split('/').map((segment, idx, arr) => (
              <React.Fragment key={`${segment}-${idx}`}>
                <span className={idx === arr.length - 1 ? 'text-slate-200' : ''}>
                  {segment}
                </span>
                {idx < arr.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-slate-600" />
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
            className="rounded-md border border-white/10 bg-[#141824] px-2 py-0.5 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="bg-[#0f121d]">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Advisory Conflict Banner */}
      {activeConflictReservation && (
        <div className="flex items-center justify-between border-b border-amber-500/30 bg-amber-950/60 px-3 py-1.5 text-xs text-amber-200 animate-fadeIn">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              <strong>Reserved Section Notice:</strong> Lines{' '}
              {activeConflictReservation.startLine}–{activeConflictReservation.endLine} are
              currently reserved by <strong>{activeConflictReservation.ownerName}</strong>
              {activeConflictReservation.taskDescription ? ` (${activeConflictReservation.taskDescription})` : ''}.
              Please coordinate before editing this section.
            </span>
          </div>
        </div>
      )}

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
        <Editor
          height="100%"
          theme="vs-dark"
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
          }}
        />
      </div>
    </div>
  );
};
