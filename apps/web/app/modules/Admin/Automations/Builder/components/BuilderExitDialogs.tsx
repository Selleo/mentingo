import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface BuilderExitDialogsProps {
  name: string;
  busy: boolean;
  leaveOpen: boolean;
  archiveOpen: boolean;
  onLeaveOpenChange: (open: boolean) => void;
  onArchiveOpenChange: (open: boolean) => void;
  onLeave: () => void;
  onSaveAndLeave: () => void;
  onArchive: () => void;
}

export function BuilderExitDialogs(props: BuilderExitDialogsProps) {
  const { t } = useTranslation();

  return (
    <>
      <Dialog open={props.leaveOpen} onOpenChange={props.onLeaveOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("automationBuilder.header.leaveDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("automationBuilder.header.leaveDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.button.cancel")}</Button>
            </DialogClose>
            <Button variant="outline" onClick={props.onLeave}>
              {t("automationBuilder.header.leaveDialog.leaveWithoutSaving")}
            </Button>
            <Button disabled={props.busy} onClick={props.onSaveAndLeave}>
              {t("automationBuilder.header.leaveDialog.saveAndLeave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={props.archiveOpen} onOpenChange={props.onArchiveOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("automations.archive")}</DialogTitle>
            <DialogDescription>
              {t("automationBuilder.header.archiveDescription", { name: props.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t("common.button.cancel")}</Button>
            </DialogClose>
            <DialogClose asChild>
              <Button variant="destructive" disabled={props.busy} onClick={props.onArchive}>
                {t("automations.archive")}
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
