import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import {
  DialogOverlay,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";

type LeaveConfirmationModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  onValidate: () => void;
  isValidated: boolean;
};

const LeaveConfirmationModal = ({
  open,
  onClose,
  onSave,
  isValidated,
  onValidate,
}: LeaveConfirmationModalProps) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogOverlay className="bg-primary-400 opacity-65" />
      <DialogContent className="max-w-[40%] p-12">
        <div className="flex items-start gap-4">
          <Icon name="Warning" className="mt-0.5 size-5 text-yellow-600" />
          <div>
            <DialogTitle className="text-xl font-semibold text-neutral-900">
              {t("adminCourseView.curriculum.lesson.other.leaveContentHeader")}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-neutral-600">
              {t("adminCourseView.curriculum.lesson.other.leaveContentBody")}
            </DialogDescription>
            {!isValidated && (
              <DialogDescription className="mt-2 text-sm text-neutral-600">
                {t("adminCourseView.curriculum.lesson.other.leaveContentBodyValidate")}
              </DialogDescription>
            )}
            <div className="mt-8 flex gap-4">
              {!isValidated ? (
                <Button
                  onClick={onValidate}
                  className="rounded bg-primary-700 px-4 py-2 text-white"
                >
                  {t("common.button.validate")}
                </Button>
              ) : (
                <Button onClick={onSave} className="rounded bg-primary-700 px-4 py-2 text-white">
                  {t("common.button.save")}
                </Button>
              )}
              <Button
                onClick={onClose}
                className="bg-neutrals-200 rounded border border-neutral-300 px-4 py-2 text-primary-800"
              >
                {t("common.button.ignore")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LeaveConfirmationModal;
