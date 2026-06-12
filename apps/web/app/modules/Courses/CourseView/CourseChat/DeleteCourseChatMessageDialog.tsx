import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import { COURSE_DISCUSSION_HANDLES } from "../../../../../e2e/data/courses/handles";

type DeleteCourseChatMessageDialogProps = {
  open: boolean;
  isDeleting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  cancelLabel: string;
  deleteLabel: string;
};

export function DeleteCourseChatMessageDialog({
  open,
  isDeleting,
  onOpenChange,
  onConfirm,
  title,
  description,
  cancelLabel,
  deleteLabel,
}: DeleteCourseChatMessageDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid={COURSE_DISCUSSION_HANDLES.DELETE_DIALOG}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
            data-testid={COURSE_DISCUSSION_HANDLES.DELETE_DIALOG_CANCEL_BUTTON}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isDeleting}
            data-testid={COURSE_DISCUSSION_HANDLES.DELETE_DIALOG_CONFIRM_BUTTON}
          >
            {deleteLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
