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
      <DialogContent
        variant="mobileDrawer"
        data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_MODAL}
        className="z-[120] flex flex-col sm:!max-w-md"
      >
        <DialogHeader className="gap-2 border-b border-neutral-100 px-6 py-5 text-left">
          <DialogTitle className="text-lg font-semibold text-neutral-950">
            {t("studentCourseView.lesson.aiMentorLesson.retakeModalTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-neutral-600">
            {t("studentCourseView.lesson.aiMentorLesson.retakeModalDescription")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 border-t border-neutral-100 px-6 py-4 sm:gap-0">
          <Button
            data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_CANCEL_BUTTON}
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            {t("common.button.cancel")}
          </Button>
          <Button
            data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_CONFIRM_BUTTON}
            variant="primary"
            onClick={onConfirm}
            className="w-full sm:w-auto"
          >
            {t("clientStatisticsView.button.continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RetakeModal;
