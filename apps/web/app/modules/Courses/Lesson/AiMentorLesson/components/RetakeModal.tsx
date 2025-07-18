import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
      <DialogContent>
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
