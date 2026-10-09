import { useBeforeUnload, useBlocker, useNavigate } from "@remix-run/react";
import { useRef } from "react";

export function useAutomationExitGuard(hasUnsavedChanges: boolean) {
  const navigate = useNavigate();
  const bypass = useRef(false);
  const blocker = useBlocker(() => hasUnsavedChanges && !bypass.current);

  useBeforeUnload((event) => {
    if (!hasUnsavedChanges) return;

    event.preventDefault();
    event.returnValue = "";
  });

  function navigateAfterSave(path: string) {
    bypass.current = true;
    try {
      navigate(path);
    } finally {
      bypass.current = false;
    }
  }

  return { blocker, navigateAfterSave };
}
