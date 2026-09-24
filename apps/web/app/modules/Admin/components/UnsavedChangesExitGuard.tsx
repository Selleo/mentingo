import { useBeforeUnload, useBlocker } from "@remix-run/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

type UnsavedChangesExitGuardProps = {
  testIds?: { cancel: string; leave: string };
  enabled: boolean;
  dialogTitle: string;
  message: string;
  cancelLabel?: string;
  leaveLabel: string;
};

export const BLOCKER_STATES = {
  BLOCKED: "blocked",
} as const;

export function UnsavedChangesExitGuard({
  testIds,
  enabled,
  dialogTitle,
  message,
  cancelLabel,
  leaveLabel,
}: UnsavedChangesExitGuardProps) {
  const { t } = useTranslation();
  const blocker = useBlocker(enabled);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useBeforeUnload(
    (event) => {
      if (!enabled) return;
      event.preventDefault();
      event.returnValue = message;
    },
    { capture: true },
  );

  useEffect(() => {
    setIsDialogOpen(blocker.state === BLOCKER_STATES.BLOCKED);
  }, [blocker.state]);

  const cancelNavigation = () => {
    if (blocker.state === BLOCKER_STATES.BLOCKED) {
      blocker.reset();
    }
    setIsDialogOpen(false);
  };

  const proceedNavigation = () => {
    if (blocker.state === BLOCKER_STATES.BLOCKED) {
      blocker.proceed();
    }
    setIsDialogOpen(false);
  };

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) cancelNavigation();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid={testIds?.cancel}
            type="button"
            variant="outline"
            onClick={cancelNavigation}
          >
            {cancelLabel ?? t("common.button.cancel")}
          </Button>
          <Button data-testid={testIds?.leave} type="button" onClick={proceedNavigation}>
            {leaveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
