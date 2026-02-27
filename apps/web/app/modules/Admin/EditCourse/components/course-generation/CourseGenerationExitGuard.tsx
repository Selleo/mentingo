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

type CourseGenerationExitGuardProps = {
  enabled: boolean;
};

export function CourseGenerationExitGuard({ enabled }: CourseGenerationExitGuardProps) {
  const { t } = useTranslation();
  const message = t("adminCourseView.generation.exitWarning");
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
    if (blocker.state === "blocked") {
      setIsDialogOpen(true);
    } else {
      setIsDialogOpen(false);
    }
  }, [blocker.state]);

  return (
    <Dialog
      open={isDialogOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && blocker.state === "blocked") {
          blocker.reset();
        }
        setIsDialogOpen(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("adminCourseView.generation.exitDialogTitle")}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (blocker.state === "blocked") {
                blocker.reset();
              }
              setIsDialogOpen(false);
            }}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (blocker.state === "blocked") {
                blocker.proceed();
              }
              setIsDialogOpen(false);
            }}
          >
            {t("common.button.proceed")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
