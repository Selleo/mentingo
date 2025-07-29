import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogOverlay,
} from "~/components/ui/dialog";

import type React from "react";

type RetakeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

const RetakeModal: React.FC<RetakeModalProps> = ({ open, onOpenChange, onConfirm, onCancel }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="z-[110]" />
      <DialogContent className="z-[120]">
        <DialogHeader>
          <DialogTitle>{t("studentCourseView.lesson.aiMentorLesson.retakeModalTitle")}</DialogTitle>
          <DialogDescription>
            {t("studentCourseView.lesson.aiMentorLesson.retakeModalDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            {t("common.button.cancel")}
          </Button>
          <Button onClick={onConfirm} className="bg-primary-700">
            {t("clientStatisticsView.button.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RetakeModal;
