import { useEffect, useRef } from "react";

type KeyboardShortcut = {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
};

type UseHandleKeyboardShortcutOptions = {
  shortcuts: KeyboardShortcut[];
  onShortcut: (shortcut: KeyboardShortcut) => void;
  enabled?: boolean;
  preventDefault?: boolean;
};

export function useHandleKeyboardShortcut({
  shortcuts,
  onShortcut,
  enabled = true,
  preventDefault = true,
}: UseHandleKeyboardShortcutOptions) {
  const shortcutsRef = useRef(shortcuts);
  const onShortcutRef = useRef(onShortcut);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    onShortcutRef.current = onShortcut;
  }, [onShortcut]);

  useEffect(() => {
    if (!enabled) return;

    const handler = (event: KeyboardEvent) => {
      const matchedShortcut = shortcutsRef.current.find((shortcut) => {
        const keyMatch = event.key === shortcut.key || event.key === shortcut.key.toUpperCase();
        const metaMatch =
          shortcut.metaKey === undefined ? true : event.metaKey === shortcut.metaKey;
        const ctrlMatch =
          shortcut.ctrlKey === undefined ? true : event.ctrlKey === shortcut.ctrlKey;
        const shiftMatch =
          shortcut.shiftKey === undefined ? true : event.shiftKey === shortcut.shiftKey;
        const altMatch = shortcut.altKey === undefined ? true : event.altKey === shortcut.altKey;

        return keyMatch && metaMatch && ctrlMatch && shiftMatch && altMatch;
      });

      if (matchedShortcut) {
        if (preventDefault) {
          event.preventDefault();
        }
        onShortcutRef.current(matchedShortcut);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, preventDefault]);
}
