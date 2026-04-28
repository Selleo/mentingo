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

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

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
      <DialogContent data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_MODAL} className="z-[120]">
        <DialogHeader>
          <DialogTitle>{t("studentCourseView.lesson.aiMentorLesson.retakeModalTitle")}</DialogTitle>
          <DialogDescription>
            {t("studentCourseView.lesson.aiMentorLesson.retakeModalDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_CANCEL_BUTTON}
            variant="outline"
            onClick={onCancel}
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_CONFIRM_BUTTON}
            onClick={onConfirm}
            className="bg-primary-700"
          >
            {t("clientStatisticsView.button.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RetakeModal;
