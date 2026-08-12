import { useCallback, useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 400;

export function useAutoSave<T>(onSave: (payload: T) => void, delayMs = DEFAULT_DELAY_MS) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => void) | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const trigger = useCallback(
    (payload: T) => {
      pendingSaveRef.current = () => {
        pendingSaveRef.current = null;
        onSaveRef.current(payload);
      };
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        pendingSaveRef.current?.();
      }, delayMs);
    },
    [delayMs],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      pendingSaveRef.current?.();
    };
  }, []);

  return trigger;
}
