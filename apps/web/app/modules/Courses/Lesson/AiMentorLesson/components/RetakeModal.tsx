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
        data-testid={LEARNING_HANDLES.AI_MENTOR_RETAKE_MODAL}
        className="z-[120] !bottom-0 !left-0 !right-0 !top-auto flex max-h-[85dvh] w-full !max-w-none flex-col gap-0 overflow-hidden rounded-t-xl border-x-0 border-b-0 p-0 !translate-x-0 !translate-y-0 data-[state=closed]:!slide-out-to-bottom data-[state=open]:!slide-in-from-bottom data-[state=closed]:!slide-out-to-left-0 data-[state=open]:!slide-in-from-left-0 data-[state=closed]:sm:!slide-out-to-top-[48%] data-[state=open]:sm:!slide-in-from-top-[48%] data-[state=closed]:sm:!slide-out-to-left-1/2 data-[state=open]:sm:!slide-in-from-left-1/2 sm:!bottom-auto sm:!left-1/2 sm:!right-auto sm:!top-1/2 sm:max-h-[82vh] sm:!max-w-md sm:rounded-lg sm:border sm:!translate-x-[-50%] sm:!translate-y-[-50%]"
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
