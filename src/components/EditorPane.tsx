import React, { useState, useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import {
  Code2,
  X,
  Command,
  Sparkles,
  ChevronRight,
  ArrowLeft,
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
  reservations = [],
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
  onSwitchWorkspace,
}) => {
  const [selectedRange, setSelectedRange] = useState<{ startLine: number; endLine: number } | null>(null);
  const [blockedNotice, setBlockedNotice] = useState<{
    ownerName: string;
    startLine: number;
    endLine: number;
  } | null>(null);

  const [boxCoords, setBoxCoords] = useState<{
    top: number;
    height: number;
    startLine: number;
    endLine: number;
    rightOffset: number;
  } | null>(null);
  const [dragEdge, setDragEdge] = useState<'top' | 'bottom' | null>(null);
  const [dragLines, setDragLines] = useState<{ startLine: number; endLine: number } | null>(null);

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const reservationsRef = useRef(reservations);
  const activeFileRef = useRef(activeFile);
  const blockedNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    reservationsRef.current = reservations;
    activeFileRef.current = activeFile;
  }, [reservations, activeFile]);
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
      const height = Math.max(20, top2 - top1);
      const top = top1 - editor.getScrollTop();

      const layout = editor.getLayoutInfo();
      // Position neatly to the right of content area, just before minimap or scrollbar
      const minimapWidth = (layout.minimap && layout.minimap.minimapWidth) || 0;
      const rightOffset = minimapWidth > 0 ? minimapWidth + 16 : 28;

      setBoxCoords({
        top,
        height,
        startLine: start,
        endLine: end,
        rightOffset,
      });
    } catch {
      // Ignore during file or model transition
    }
  }, [myReservation, dragLines]);

  useEffect(() => {
    updateBoxCoords();
  }, [updateBoxCoords, reservations, activeFile?.id]);

  // Window resize & layout change listeners to maintain handle alignment
  useEffect(() => {
    const handleResize = () => updateBoxCoords();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateBoxCoords]);

  // Handle interactive drag-to-expand on reservation top or bottom handle
  const handleStartDrag = (edge: 'top' | 'bottom', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const editor = editorRef.current;
    if (!editor || !myReservation) return;

    setDragEdge(edge);
    let curStart = dragLines ? dragLines.startLine : myReservation.startLine;
    let curEnd = dragLines ? dragLines.endLine : myReservation.endLine;

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

  const showBlockedAlert = (peer: EditReservation) => {
    setBlockedNotice({
      ownerName: peer.ownerName,
      startLine: peer.startLine,
      endLine: peer.endLine,
    });
    if (blockedNoticeTimerRef.current) clearTimeout(blockedNoticeTimerRef.current);
    blockedNoticeTimerRef.current = setTimeout(() => {
      setBlockedNotice(null);
    }, 3500);
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    monaco.editor.defineTheme('nexathon-obsidian', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#000000',
        'editor.lineHighlightBackground': '#0A0A0A',
        'editorLineNumber.foreground': '#808080',
        'editorLineNumber.activeForeground': '#FF7057',
        'editorGutter.background': '#000000',
        'editor.selectionBackground': '#171717',
        'editor.inactiveSelectionBackground': '#17171780',
      },
    });

    monaco.editor.defineTheme('nexathon-titanium', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#FFF9F0',
        'editor.lineHighlightBackground': '#F1E8DA',
        'editorLineNumber.foreground': '#8A7D6D',
        'editorLineNumber.activeForeground': '#FF7057',
        'editorGutter.background': '#FFF9F0',
        'editor.selectionBackground': '#EFE3D2',
        'editor.inactiveSelectionBackground': '#EFE3D280',
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

    // Editor-Level Protection: Intercept keystrokes to prevent editing peer-reserved sections
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
        showBlockedAlert(peerLock);
      }
    });

    // Paste event protection
    editor.onDidPaste((e) => {
      const startLine = e.range.startLineNumber;
      const endLine = e.range.endLineNumber;
      const now = Date.now();
      const peerLock = reservationsRef.current.find(
        (r) =>
          r.filePath === activeFileRef.current?.path &&
          r.ownerId !== currentUserId &&
          r.expiresAt > now &&
          !(endLine < r.startLine || startLine > r.endLine)
      );
      if (peerLock) {
        editor.trigger('keyboard', 'undo', null);
        showBlockedAlert(peerLock);
      }
    });

    // Keep handles updated across all editor events
    editor.onDidScrollChange(() => updateBoxCoords());
    editor.onDidChangeCursorPosition(() => updateBoxCoords());
    editor.onDidChangeModelContent(() => updateBoxCoords());
    editor.onDidLayoutChange(() => updateBoxCoords());
    updateBoxCoords();

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

            {onSwitchWorkspace && (
              <button
                type="button"
                onClick={onSwitchWorkspace}
                className="w-full flex items-center justify-between rounded-lg border theme-border theme-bg-surface-2 px-3 py-2 hover:border-[#FF7057]/40 hover:theme-bg-elevated transition cursor-pointer text-left neu-button"
              >
                <span className="flex items-center gap-2 theme-text-primary font-medium">
                  <ArrowLeft className="h-3.5 w-3.5 text-[#FF7057]" />
                  Exit to Workspaces Dashboard
                </span>
                <kbd className="rounded border theme-border theme-bg-surface-1 px-2 py-0.5 font-mono text-[11px] text-[#FF7057]">
                  Exit
                </kbd>
              </button>
            )}
          </div>

          <div className="mt-5 flex items-center justify-center gap-1.5 text-[11px] text-[#FF7057]">
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
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FF7057]/40 bg-[#FF7057]/15 px-2 py-0.5 text-[11px] font-medium text-[#FF7057] hover:bg-[#FF7057]/25 transition cursor-pointer"
            >
              <Unlock className="h-3 w-3 text-[#FF7057]" />
              <span>Release Lines {myReservation.startLine}–{myReservation.endLine}</span>
            </button>
          ) : selectedRange && selectedRange.endLine >= selectedRange.startLine ? (
            <button
              type="button"
              onClick={() => onReserveSelection?.(selectedRange.startLine, selectedRange.endLine)}
              title={`Reserve lines ${selectedRange.startLine}–${selectedRange.endLine} for focused editing`}
              className="inline-flex items-center gap-1 rounded-md border theme-border theme-bg-surface-2 px-2 py-0.5 text-[11px] font-medium theme-text-secondary hover:border-[#FF7057]/40 hover:text-[#FF7057] transition cursor-pointer"
            >
              <Shield className="h-3 w-3 text-[#FF7057]" />
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
            className="rounded-md border theme-border theme-bg-surface-2 px-2.5 py-0.5 text-xs font-medium theme-text-primary focus:border-[#FF7057] focus:outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value} className="theme-bg-surface-1 theme-text-primary">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Blocked Edit Alert Banner */}
      {blockedNotice && (
        <div className="flex items-center justify-between border-b border-amber-500/50 bg-amber-950/90 px-3 py-1.5 text-xs font-medium text-amber-200 animate-fadeIn shadow-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400 animate-bounce" />
            <span>
              <strong>Line Locked:</strong> Lines {blockedNotice.startLine}–{blockedNotice.endLine} are reserved by{' '}
              <span className="font-bold text-white underline">{blockedNotice.ownerName}</span>.
              Keystrokes are locked to prevent edit conflicts.
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

      {/* Monaco Editor Container with Overlay Handles */}
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
            dragAndDrop: false,
          }}
        />

        {/* Compact, Subtle Draggable Reservation Handles & Right Bracket Rail */}
        {boxCoords && myReservation && boxCoords.top + boxCoords.height > -30 && boxCoords.top < 3500 && (
          <>
            {/* Visual Rail connecting Top & Bottom Handles along right margin */}
            <div
              className="pointer-events-none absolute z-20 border-r-2 border-[#FF7057]/40 border-dashed"
              style={{
                top: `${boxCoords.top}px`,
                height: `${boxCoords.height}px`,
                right: `${boxCoords.rightOffset + 11}px`,
              }}
            />

            {/* Top Draggable Handle: Substantially compact, sleek, positioned on right margin */}
            <div
              onMouseDown={(e) => handleStartDrag('top', e)}
              className={`group pointer-events-auto absolute z-30 flex items-center justify-center w-6 h-3.5 rounded-full bg-[#FF7057] text-white border border-[#F26049] cursor-ns-resize select-none transition-all hover:scale-110 before:absolute before:-inset-2 before:content-[''] neu-button ${
                dragEdge === 'top' ? 'scale-110 ring-2 ring-[#FF7057]' : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                top: `${Math.max(4, boxCoords.top - 7)}px`,
                right: `${boxCoords.rightOffset}px`,
              }}
              title="Click and drag upwards to expand reservation to earlier lines"
            >
              <ChevronsUp className="h-2.5 w-2.5 text-white" />
              {/* Dynamic Line Indicator visible on hover or drag */}
              <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#0A0A0A] dark:bg-[#111111] border border-[#242424] text-[10px] font-mono font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                ▲ Ln {boxCoords.startLine}
              </span>
            </div>

            {/* Bottom Draggable Handle: Substantially compact, sleek, positioned on right margin */}
            <div
              onMouseDown={(e) => handleStartDrag('bottom', e)}
              className={`group pointer-events-auto absolute z-30 flex items-center justify-center w-6 h-3.5 rounded-full bg-[#FF7057] text-white border border-[#F26049] cursor-ns-resize select-none transition-all hover:scale-110 before:absolute before:-inset-2 before:content-[''] neu-button ${
                dragEdge === 'bottom' ? 'scale-110 ring-2 ring-[#FF7057]' : 'opacity-85 hover:opacity-100'
              }`}
              style={{
                top: `${boxCoords.top + boxCoords.height - 7}px`,
                right: `${boxCoords.rightOffset}px`,
              }}
              title="Click and drag downwards to expand reservation to more lines"
            >
              <ChevronsDown className="h-2.5 w-2.5 text-white" />
              {/* Dynamic Line Indicator visible on hover or drag */}
              <span className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#0A0A0A] dark:bg-[#111111] border border-[#242424] text-[10px] font-mono font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                ▼ Ln {boxCoords.endLine}
              </span>
            </div>

            {/* Compact Floating Quick-Adjustment Control at top right */}
            <div className="pointer-events-auto absolute right-16 top-2 z-30 flex items-center gap-1.5 rounded-md border border-[#E9DECE] dark:border-[#242424] bg-[#FFF9F0] dark:bg-[#0A0A0A] backdrop-blur-md px-2.5 py-1 text-xs text-[#302820] dark:text-[#FFFFFF] neu-card select-none">
              <Shield className="h-3 w-3 text-[#FF7057] shrink-0" />
              <span className="font-medium text-[#302820] dark:text-[#FFFFFF] text-[11px]">
                Lines {boxCoords.startLine}–{boxCoords.endLine}
              </span>
              <div className="h-3 w-px bg-theme-border mx-0.5" />
              <button
                type="button"
                onClick={() => {
                  const newEnd = boxCoords.endLine + 5;
                  if (onUpdateReservationRange) onUpdateReservationRange(myReservation.id, boxCoords.startLine, newEnd);
                  else if (onReserveSelection) onReserveSelection(boxCoords.startLine, newEnd);
                }}
                className="px-1.5 py-0.5 rounded bg-[#FF7057] hover:bg-[#F26049] text-[10px] font-semibold text-white transition cursor-pointer neu-button"
                title="Add 5 lines to reservation"
              >
                +5
              </button>
              {boxCoords.endLine - boxCoords.startLine >= 5 && (
                <button
                  type="button"
                  onClick={() => {
                    const newEnd = Math.max(boxCoords.startLine, boxCoords.endLine - 5);
                    if (onUpdateReservationRange) onUpdateReservationRange(myReservation.id, boxCoords.startLine, newEnd);
                    else if (onReserveSelection) onReserveSelection(boxCoords.startLine, newEnd);
                  }}
                  className="px-1.5 py-0.5 rounded bg-theme-bg-surface-2 hover:theme-bg-surface-1 text-[10px] font-semibold theme-text-primary transition cursor-pointer"
                  title="Shrink reservation by 5 lines"
                >
                  -5
                </button>
              )}
              <button
                type="button"
                onClick={() => onReleaseReservation?.(myReservation.id)}
                className="px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500/30 text-[10px] font-semibold text-rose-500 transition cursor-pointer ml-0.5"
                title="Release reservation"
              >
                Release
              </button>
            </div>
          </>
        )}

        {/* Drag-Selection Quick Reserve Pill */}
        {selectedRange && selectedRange.endLine > selectedRange.startLine && (
          <div className="pointer-events-auto absolute left-1/2 -translate-x-1/2 top-3 z-30 flex items-center gap-2.5 rounded-lg border border-[#E9DECE] dark:border-[#242424] bg-[#FFF9F0] dark:bg-[#0A0A0A] backdrop-blur-md px-3.5 py-1.5 text-xs text-[#302820] dark:text-[#FFFFFF] neu-card animate-fadeIn">
            <Shield className="h-4 w-4 text-[#FF7057] animate-pulse shrink-0" />
            <span>
              Selected <strong>Lines {selectedRange.startLine}–{selectedRange.endLine}</strong> ({selectedRange.endLine - selectedRange.startLine + 1} lines)
            </span>
            <button
              type="button"
              onClick={() => onReserveSelection?.(selectedRange.startLine, selectedRange.endLine)}
              className="px-2.5 py-1 rounded bg-[#FF7057] hover:bg-[#F26049] text-xs font-semibold text-white transition cursor-pointer neu-button"
            >
              Lock & Reserve Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
