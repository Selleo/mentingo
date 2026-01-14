import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DialogOverlay,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

import { DeleteContentType } from "../EditCourse/EditCourse.types";

type DeleteConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  contentType?: DeleteContentType;
};

const DeleteConfirmationModal = ({
  open,
  onClose,
  onDelete,
  contentType,
}: DeleteConfirmationModalProps) => {
  const { t } = useTranslation();
  const getDialogTitleText = (): string => {
    return match(contentType)
      .with(DeleteContentType.CONTENT, () =>
        t("adminCourseView.curriculum.other.removeContentLesson"),
      )
      .with(DeleteContentType.QUIZ, () => t("adminCourseView.curriculum.other.removeQuizLesson"))
      .with(DeleteContentType.AI_MENTOR, () =>
        t("adminCourseView.curriculum.other.removeAiMentorLesson"),
      )
      .with(DeleteContentType.CHAPTER, () => t("adminCourseView.curriculum.other.removeChapter"))
      .with(DeleteContentType.QUESTION, () => t("adminCourseView.curriculum.other.removeQuestion"))
      .with(DeleteContentType.EMBED, () => t("adminCourseView.curriculum.other.removeEmbedLesson"))
      .otherwise(() => t("adminCourseView.curriculum.other.removeContent"));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay className="bg-primary-400 opacity-65" />
      <DialogContent className="max-w-[40%] p-12">
        <div className="flex items-start gap-4">
          <Icon name="Warning" className="mt-0.5 size-5 text-red-500" />
          <div>
            <DialogTitle className="text-xl font-semibold text-neutral-900">
              {getDialogTitleText()}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-neutral-600">
              {contentType === DeleteContentType.QUESTION
                ? t("adminCourseView.curriculum.other.removeContentQuestionBody")
                : t("adminCourseView.curriculum.other.removeContentBody")}
            </DialogDescription>

            <div className="mt-8 flex gap-4">
              <Button
                onClick={onDelete}
                className="rounded bg-error-500 px-4 py-2 text-white hover:bg-error-600"
              >
                {t("common.button.delete")}
              </Button>
              <Button
                onClick={onClose}
                className="bg-neutrals-200 rounded border border-neutral-300 px-4 py-2 text-primary-800"
              >
                {t("common.button.cancel")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteConfirmationModal;
