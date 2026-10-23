import { useEffect } from 'react';

interface ShortcutHandlers {
  onSave?: () => void;
  onRun?: () => void;
  onToggleExplorer?: () => void;
}

export function useKeyboardShortcuts({
  onSave,
  onRun,
  onToggleExplorer,
}: ShortcutHandlers): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      // Ctrl+S / Cmd+S -> Save active file
      if (isCtrlOrCmd && event.key.toLowerCase() === 's') {
        event.preventDefault();
        onSave?.();
        return;
      }

      // Ctrl+Enter / Cmd+Enter -> Run active file
      if (isCtrlOrCmd && event.key === 'Enter') {
        event.preventDefault();
        onRun?.();
        return;
      }

      // Ctrl+B / Cmd+B -> Toggle File Explorer sidebar
      if (isCtrlOrCmd && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        onToggleExplorer?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onRun, onToggleExplorer]);
}

