import { useMemo, useRef } from "react";

/**
 * Tracks search values sent to the URL so their delayed echo can be told apart from an
 * external change, keeping text typed while the navigation was pending.
 */
export function useSentSearchAcknowledgments<TValue>() {
  const sentSearches = useRef<TValue[]>([]);

  return useMemo(
    () => ({
      rememberSentSearch: (value: TValue) => {
        sentSearches.current.push(value);
      },
      isAcknowledgingSentSearch: (value: TValue) => {
        const acknowledgedIndex = sentSearches.current.indexOf(value);

        if (acknowledgedIndex === -1) {
          sentSearches.current = [];
          return false;
        }

        sentSearches.current.splice(0, acknowledgedIndex + 1);
        return true;
      },
    }),
    [],
  );
}
