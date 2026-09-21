import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "~/components/ui/dialog";

type LeaveConfirmationModalProps = {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
};

const LeaveConfirmationModal = ({ open, onCancel, onDiscard }: LeaveConfirmationModalProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("adminCourseView.curriculum.lesson.other.leaveContentHeader")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.other.leaveContentBody")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            {t("adminCourseView.curriculum.lesson.other.leaveContentCancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={onDiscard}>
            {t("adminCourseView.curriculum.lesson.other.leaveContentDiscard")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveConfirmationModal;
