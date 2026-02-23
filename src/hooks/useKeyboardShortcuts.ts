import { useEffect } from 'react';

interface UseKeyboardShortcutsProps {
  onUndo: () => void;
  onRedo: () => void;
  onSave?: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useKeyboardShortcuts({
  onUndo,
  onRedo,
  onSave,
  canUndo,
  canRedo,
}: UseKeyboardShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl or Cmd key
      const isCtrlOrCmd = event.ctrlKey || event.metaKey;

      if (!isCtrlOrCmd) return;

      switch (event.key.toLowerCase()) {
        case 'z':
          if (event.shiftKey) {
            // Ctrl/Cmd + Shift + Z = Redo
            if (canRedo) {
              event.preventDefault();
              onRedo();
            }
          } else {
            // Ctrl/Cmd + Z = Undo
            if (canUndo) {
              event.preventDefault();
              onUndo();
            }
          }
          break;
        
        case 'y':
          // Ctrl/Cmd + Y = Redo (alternative)
          if (canRedo) {
            event.preventDefault();
            onRedo();
          }
          break;

        case 's':
          // Ctrl/Cmd + S = Save/Export
          if (onSave) {
            event.preventDefault();
            onSave();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onUndo, onRedo, onSave, canUndo, canRedo]);
}
