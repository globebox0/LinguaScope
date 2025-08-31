
import { useEffect } from 'react';

type HotkeyMap = {
  [key: string]: (event: KeyboardEvent) => void;
};

export const useHotkeys = (hotkeyMap: HotkeyMap) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const hotkey = `${event.ctrlKey ? 'ctrl+' : ''}${event.metaKey ? 'meta+' : ''}${event.altKey ? 'alt+' : ''}${event.shiftKey ? 'shift+' : ''}${key}`;

      const normalizedHotkey = hotkey.replace('meta+', 'ctrl+'); // Treat Cmd as Ctrl for cross-platform compatibility

      if (hotkeyMap[normalizedHotkey]) {
        hotkeyMap[normalizedHotkey](event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeyMap]);
};
