import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { EditReservation, FollowState, SupportedLanguage, WorkspaceFile } from '../types';
import { ThemeMode } from './ThemeToggle';

interface EditorPaneProps {
  openFiles: WorkspaceFile[];
  activeFile: WorkspaceFile | null;
  dirtyFileIds: Set<string>;
  reservations?: EditReservation[];
  activeConflictReservation?: EditReservation | null;
  followState?: FollowState | null;
  currentUserId?: string;
  theme?: ThemeMode;
  onSelectTab: (file: WorkspaceFile) => void;
  onCloseTab: (fileId: string, e: React.MouseEvent) => void;
  onLanguageChange: (file: WorkspaceFile, language: SupportedLanguage) => void;
  onReserveSelection?: (startLine: number, endLine: number) => void;
  onReleaseReservation?: (reservationId: string) => void;
  onUpdateReservationRange?: (reservationId: string, startLine: number, endLine: number) => void;
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
  theme = 'dark',
  onSelectTab,
  onCloseTab,
  onLanguageChange,
  onReserveSelection,
  onReleaseReservation,
  onUpdateReservationRange,
  onStopFollowing,
  onEditorReady,
}) => {
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [blockedNotice, setBlockedNotice] = useState<{
    ownerName: string;
    ownerColor: string;
    startLine: number;
    endLine: number;
    activeLine: number;
  } | null>(null);

  const [boxCoords, setBoxCoords] = useState<{
    top: number;
    height: number;
    startLine: number;
    endLine: number;
  } | null>(null);
  const [dragEdge, setDragEdge] = useState<'top' | 'bottom' | null>(null);
  const [dragLines, setDragLines] = useState<{ startLine: number; endLine: number } | null>(null);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const reservationsRef = useRef(reservations);
  reservationsRef.current = reservations;
  const activeFileRef = useRef(activeFile);
  activeFileRef.current = activeFile;
  const blockedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDark = theme !== 'light';

  const myReservation = reservations.find(
    (r) => r.ownerId === currentUserId && r.filePath === activeFile?.path
  );

  // Dynamically compute reservation overlay pixel coordinates in Monaco viewport
  const updateBoxCoords = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !myReservation) {
      setBoxCoords(null);
      return;
    }

    const start = dragLines ? dragLines.startLine : myReservation.startLine;
    const end = dragLines ? dragLines.endLine : myReservation.endLine;

    try {
      const top1 = editor.getTopForLineNumber(start);
      const top2 = editor.getTopForLineNumber(end + 1);
      const height = Math.max(22, top2 - top1);
      const top = top1 - editor.getScrollTop();

      setBoxCoords({
        top,
        height,
        startLine: start,
        endLine: end,
      });
    } catch {
      // Ignore during file/model transition
    }
  }, [myReservation, dragLines]);

  useEffect(() => {
    updateBoxCoords();
  }, [updateBoxCoords, reservations, activeFile?.id]);

  // Handle interactive drag-to-expand on reservation top or bottom handle
  const handleStartDrag = (edge: 'top' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const editor = editorRef.current;
    if (!editor || !myReservation) return;

    setDragEdge(edge);
    let curStart = myReservation.startLine;
    let curEnd = myReservation.endLine;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const target = editor.getTargetAtClientPoint(moveEvent.clientX, moveEvent.clientY);
      if (target && target.position) {
        const mouseLine = target.position.lineNumber;

        if (edge === 'bottom') {
          let newEnd = Math.max(curStart, mouseLine);
          const peerLocks = reservationsRef.current.filter(
            (r) =>
              r.ownerId !== currentUserId &&
              r.filePath === activeFileRef.current?.path &&
              r.startLine > curStart
          );
          const minPeerStart =
            peerLocks.length > 0 ? Math.min(...peerLocks.map((r) => r.startLine)) : Infinity;
          if (newEnd >= minPeerStart) {
            newEnd = minPeerStart - 1;
          }

          if (newEnd >= curStart) {
            curEnd = newEnd;
            setDragLines({ startLine: curStart, endLine: newEnd });
          }
        } else {
          let newStart = Math.min(curEnd, Math.max(1, mouseLine));
          const peerLocks = reservationsRef.current.filter(
            (r) =>
              r.ownerId !== currentUserId &&
              r.filePath === activeFileRef.current?.path &&
              r.endLine < curEnd
          );
          const maxPeerEnd =
            peerLocks.length > 0 ? Math.max(...peerLocks.map((r) => r.endLine)) : 0;
          if (newStart <= maxPeerEnd) {
            newStart = maxPeerEnd + 1;
          }

          if (newStart <= curEnd) {
            curStart = newStart;
            setDragLines({ startLine: newStart, endLine: curEnd });
          }
        }
      }
    };

    const onMouseUp = () => {
      setDragEdge(null);
      setDragLines(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (onUpdateReservationRange) {
        onUpdateReservationRange(myReservation.id, curStart, curEnd);
      } else if (onReserveSelection) {
        onReserveSelection(curStart, curEnd);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monaco.editor.defineTheme('nexathon-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#11151B',
        'editor.lineHighlightBackground': '#171D25',
        'editorLineNumber.foreground': '#788797',
        'editorLineNumber.activeForeground': '#35B8A6',
        'editorGutter.background': '#11151B',
        'editor.selectionBackground': '#203832',
        'editor.inactiveSelectionBackground': '#20383280',
      },
    });

    monaco.editor.defineTheme('nexathon-titanium', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#F8FAFC',
        'editorLineNumber.foreground': '#748292',
        'editorLineNumber.activeForeground': '#168C7D',
        'editorGutter.background': '#ffffff',
        'editor.selectionBackground': '#E1F3EF',
        'editor.inactiveSelectionBackground': '#E1F3EF80',
      },
    });

    monaco.editor.setTheme(isDark ? 'nexathon-obsidian' : 'nexathon-titanium');

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

    // Feature 1 & 2 Enforcement: Intercept keystrokes to prevent editing peer-reserved sections
    editor.onKeyDown((e) => {
      // Allow pure navigation & view keys
      const isNav = [
        monaco.KeyCode.UpArrow,
        monaco.KeyCode.DownArrow,
        monaco.KeyCode.LeftArrow,
        monaco.KeyCode.RightArrow,
        monaco.KeyCode.PageUp,
        monaco.KeyCode.PageDown,
        monaco.KeyCode.Home,
        monaco.KeyCode.End,
        monaco.KeyCode.Escape,
      ].includes(e.keyCode);

      if (isNav) return;

      // Allow clipboard copy (Ctrl+C / Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.keyCode === monaco.KeyCode.KeyC) {
        return;
      }

      const pos = editor.getPosition();
      const sel = editor.getSelection();
      if (!pos) return;

      const startLine = sel ? Math.min(sel.startLineNumber, sel.endLineNumber) : pos.lineNumber;
      const endLine = sel ? Math.max(sel.startLineNumber, sel.endLineNumber) : pos.lineNumber;

      const now = Date.now();
      const peerLock = reservationsRef.current.find(
        (r) =>
          r.filePath === activeFileRef.current?.path &&
          r.ownerId !== currentUserId &&
          r.expiresAt > now &&
          !(endLine < r.startLine || startLine > r.endLine)
      );

      if (peerLock) {
        // Intercept & block modification in peer's reserved section!
        e.preventDefault();
        e.stopPropagation();

        setBlockedNotice({
          ownerName: peerLock.ownerName,
          ownerColor: peerLock.ownerColor,
          startLine: peerLock.startLine,
          endLine: peerLock.endLine,
          activeLine: peerLock.activeLine || peerLock.startLine,
        });

        if (blockedNoticeTimerRef.current) clearTimeout(blockedNoticeTimerRef.current);
        blockedNoticeTimerRef.current = setTimeout(() => {
          setBlockedNotice(null);
        }, 3000);
      }
    });

    editor.onDidScrollChange(() => updateBoxCoords());
    editor.onDidChangeCursorPosition(() => updateBoxCoords());
    editor.onDidChangeModelContent(() => updateBoxCoords());
    updateBoxCoords();

    onEditorReady(editor, monaco);
  };

  React.useEffect(() => {
    const winMonaco = (window as unknown as { monaco?: typeof Monaco }).monaco;
    if (winMonaco?.editor) {
      winMonaco.editor.setTheme(isDark ? 'nexathon-obsidian' : 'nexathon-titanium');
    }
  }, [isDark]);

  if (!activeFile) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center theme-bg-root bg-grid-pattern p-6 select-none transition-colors">
        <div className="w-full max-w-md rounded-2xl border theme-border theme-bg-surface-1 p-6 theme-shadow backdrop-blur-md">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/30">
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
              <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-teal-600 dark:text-teal-300">
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

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-teal-600 dark:text-teal-300">
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
                    ? 'border-b-2 border-b-teal-500 theme-bg-root theme-text-primary font-medium shadow-xs'
                    : 'theme-bg-surface-1 theme-text-secondary hover:theme-bg-surface-2 hover:theme-text-primary'
                }`}
              >
                <Code2
                  className={`h-3.5 w-3.5 ${
                    isActive ? 'text-teal-600 dark:text-teal-400' : 'theme-text-secondary'
                  }`}
                />
                <span className="max-w-[140px] truncate">{file.name}</span>
                {isDirty && (
                  <span
                    className="h-2 w-2 rounded-full bg-amber-400"
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

        {/* File Path Breadcrumb & Actions */}
        <div className="flex items-center gap-2.5">
          {/* Reservation Controls */}
          {myReservation ? (
            <button
              type="button"
              onClick={() => onReleaseReservation?.(myReservation.id)}
              title="Click to release your edit reservation on this section"
              className="inline-flex items-center gap-1.5 rounded-md border border-teal-500/40 bg-teal-950/50 px-2 py-0.5 text-[11px] font-medium text-teal-200 hover:bg-teal-900/60 transition cursor-pointer"
            >
              <Unlock className="h-3 w-3 text-teal-400" />
              <span>Release Lines {myReservation.startLine}–{myReservation.endLine}</span>
            </button>
          ) : selectedRange && selectedRange.endLine >= selectedRange.startLine ? (
            <button
              type="button"
              onClick={() => onReserveSelection?.(selectedRange.startLine, selectedRange.endLine)}
              title={`Reserve lines ${selectedRange.startLine}–${selectedRange.endLine} for focused editing`}
              className="inline-flex items-center gap-1 rounded-md border theme-border theme-bg-surface-2 px-2 py-0.5 text-[11px] font-medium theme-text-secondary hover:border-teal-500/40 hover:text-teal-400 transition cursor-pointer"
            >
              <Shield className="h-3 w-3 text-teal-400" />
              <span>Reserve Lines {selectedRange.startLine}–{selectedRange.endLine}</span>
            </button>
          ) : null}

          <div className="hidden lg:flex items-center gap-1 text-[11px] font-mono theme-text-secondary truncate max-w-[200px]">
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
            className="rounded-md border theme-border theme-bg-surface-2 px-2.5 py-0.5 text-xs font-medium theme-text-primary focus:border-teal-500 focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="theme-bg-surface-1 theme-text-primary">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Blocked Edit Alert Banner (Features 1 & 2) */}
      {blockedNotice && (
        <div
          className="flex items-center justify-between border-b px-3 py-1.5 text-xs animate-fadeIn font-medium text-white shadow-md"
          style={{
            backgroundColor: `${blockedNotice.ownerColor}22`,
            borderColor: blockedNotice.ownerColor,
          }}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert
              className="h-4 w-4 shrink-0 animate-bounce"
              style={{ color: blockedNotice.ownerColor }}
            />
            <span>
              <strong>Line Locked:</strong> Lines {blockedNotice.startLine}–{blockedNotice.endLine}{' '}
              (active: line {blockedNotice.activeLine}) are currently reserved by{' '}
              <span
                className="px-1.5 py-0.5 rounded text-[11px] font-bold text-white shadow-sm inline-block"
                style={{ backgroundColor: blockedNotice.ownerColor }}
              >
                {blockedNotice.ownerName}
              </span>
              . Keystrokes are locked to prevent conflicts until they move to another line or workspace section.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setBlockedNotice(null)}
            className="text-xs opacity-75 hover:opacity-100 px-1 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Advisory / Active Reservation Notice */}
      {!blockedNotice && activeConflictReservation && (
        <div
          className="flex items-center justify-between border-b px-3 py-1.5 text-xs animate-fadeIn text-white/90"
          style={{
            backgroundColor: `${activeConflictReservation.ownerColor}18`,
            borderColor: `${activeConflictReservation.ownerColor}55`,
          }}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert
              className="h-4 w-4 shrink-0"
              style={{ color: activeConflictReservation.ownerColor }}
            />
            <span>
              <strong>Reserved Workspace:</strong> Lines{' '}
              {activeConflictReservation.startLine}–{activeConflictReservation.endLine} are
              reserved by{' '}
              <span
                className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-white inline-flex items-center gap-1 shadow-sm"
                style={{ backgroundColor: activeConflictReservation.ownerColor }}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white inline-block animate-ping" />
                {activeConflictReservation.ownerName}
              </span>
              {activeConflictReservation.taskDescription ? ` (${activeConflictReservation.taskDescription})` : ''}
              . This 10-line workspace window is locked to prevent collisions.
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
          }}
        />

        {/* Interactive Draggable Reservation Box Overlay & Handles */}
        {boxCoords && myReservation && boxCoords.top + boxCoords.height > -50 && boxCoords.top < 3000 && (
          <>
            {/* Top Draggable Handle (Compact & Shifted to Right) */}
            <div
              onMouseDown={(e) => handleStartDrag('top', e)}
              className={`pointer-events-auto absolute right-24 z-30 flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-600/90 hover:bg-teal-500 text-white text-[10px] font-medium shadow-md cursor-ns-resize select-none transition-all ${
                dragEdge === 'top' ? 'scale-110 ring-2 ring-teal-300 bg-teal-500' : 'hover:scale-105'
              }`}
              style={{ top: `${Math.max(4, boxCoords.top - 10)}px` }}
              title="Click and drag upwards to expand the reservation to earlier lines"
            >
              <ChevronsUp className="h-3 w-3" />
              <span>▲ Ln {boxCoords.startLine}</span>
            </div>

            {/* Bottom Draggable Handle (Compact & Shifted to Right) */}
            <div
              onMouseDown={(e) => handleStartDrag('bottom', e)}
              className={`pointer-events-auto absolute right-24 z-30 flex items-center gap-1 px-1.5 py-0.5 rounded bg-teal-600/90 hover:bg-teal-500 text-white text-[10px] font-medium shadow-md cursor-ns-resize select-none transition-all ${
                dragEdge === 'bottom' ? 'scale-110 ring-2 ring-teal-300 bg-teal-500' : 'hover:scale-105'
              }`}
              style={{ top: `${boxCoords.top + boxCoords.height - 8}px` }}
              title="Click and drag downwards to expand the reservation to as many lines as needed"
            >
              <ChevronsDown className="h-3 w-3" />
              <span>▼ Ln {boxCoords.endLine}</span>
            </div>

            {/* Floating Reservation Quick-Adjustment Toolbar */}
            <div className="pointer-events-auto absolute right-14 top-2.5 z-30 flex items-center gap-2 rounded-lg border border-teal-500/40 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 text-xs text-teal-200 shadow-xl select-none animate-fadeIn">
              <Shield className="h-3.5 w-3.5 text-teal-400 shrink-0" />
              <span className="font-semibold text-white">
                Lines {boxCoords.startLine}–{boxCoords.endLine}
              </span>
              <span className="text-[10px] text-teal-300/80">
                ({boxCoords.endLine - boxCoords.startLine + 1} lines reserved)
              </span>
              <div className="h-3.5 w-px bg-white/20" />
              <button
                type="button"
                onClick={() => {
                  const newEnd = boxCoords.endLine + 5;
                  if (onUpdateReservationRange) onUpdateReservationRange(myReservation.id, boxCoords.startLine, newEnd);
                  else if (onReserveSelection) onReserveSelection(boxCoords.startLine, newEnd);
                }}
                className="px-1.5 py-0.5 rounded bg-teal-800/80 hover:bg-teal-700 text-[10px] font-bold text-white transition cursor-pointer"
                title="Add 5 lines to your reservation"
              >
                +5 Lines
              </button>
              <button
                type="button"
                onClick={() => {
                  const newEnd = boxCoords.endLine + 10;
                  if (onUpdateReservationRange) onUpdateReservationRange(myReservation.id, boxCoords.startLine, newEnd);
                  else if (onReserveSelection) onReserveSelection(boxCoords.startLine, newEnd);
                }}
                className="px-1.5 py-0.5 rounded bg-teal-800/80 hover:bg-teal-700 text-[10px] font-bold text-white transition cursor-pointer"
                title="Add 10 lines to your reservation"
              >
                +10 Lines
              </button>
              {boxCoords.endLine - boxCoords.startLine >= 5 && (
                <button
                  type="button"
                  onClick={() => {
                    const newEnd = Math.max(boxCoords.startLine, boxCoords.endLine - 5);
                    if (onUpdateReservationRange) onUpdateReservationRange(myReservation.id, boxCoords.startLine, newEnd);
                    else if (onReserveSelection) onReserveSelection(boxCoords.startLine, newEnd);
                  }}
                  className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-slate-300 transition cursor-pointer"
                  title="Shrink reservation by 5 lines"
                >
                  -5 Lines
                </button>
              )}
              <button
                type="button"
                onClick={() => onReleaseReservation?.(myReservation.id)}
                className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/40 hover:bg-rose-900 text-[10px] font-bold text-rose-200 transition cursor-pointer ml-1"
                title="Release reservation back to dynamic cursor"
              >
                Release
              </button>
            </div>
          </>
        )}

        {/* Drag-Selection Quick Reserve Pill (when user drags mouse across lines in Monaco) */}
        {selectedRange && selectedRange.endLine > selectedRange.startLine && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-3 z-30 flex items-center gap-2.5 rounded-lg border border-teal-500/50 bg-teal-950/95 backdrop-blur-md px-3.5 py-1.5 text-xs text-white shadow-2xl animate-fadeIn">
            <Shield className="h-4 w-4 text-teal-400 animate-pulse shrink-0" />
            <span>
              Selected <strong>Lines {selectedRange.startLine}–{selectedRange.endLine}</strong> ({selectedRange.endLine - selectedRange.startLine + 1} lines)
            </span>
            <button
              type="button"
              onClick={() => onReserveSelection?.(selectedRange.startLine, selectedRange.endLine)}
              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-xs font-semibold text-white shadow transition cursor-pointer"
            >
              Lock & Reserve Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
