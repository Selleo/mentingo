import { Info, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "~/components/ui/dialog";
import { Textarea } from "~/components/ui/textarea";

type LearningPathDetailsProps = {
  title: string;
  description: string;
  canEdit: boolean;
  onSave: (description: string) => Promise<void>;
};

// Match the course overview's outline action and responsive details dialog.
export function LearningPathDetails({
  title,
  description,
  canEdit,
  onSave,
}: LearningPathDetailsProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(description);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaveError, setHasSaveError] = useState(false);

  const saveAndClose = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setHasSaveError(false);
    try {
      if (canEdit && draft.trim() !== description.trim()) await onSave(draft.trim());
      setOpen(false);
    } catch {
      setHasSaveError(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraft(description);
          setHasSaveError(false);
          setOpen(true);
        } else {
          void saveAndClose();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="mt-3 flex h-auto min-h-10 max-w-full items-center gap-2 whitespace-normal text-left backdrop-blur-sm transition"
        >
          <Info className="size-4" />
          <span className="text-sm font-semibold">{t("learningPathsView.pathDetails")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        variant="mobileDrawer"
        className="flex max-h-[90dvh] flex-col rounded-2xl border-0 bg-white shadow-2xl sm:max-h-[90vh] sm:w-[calc(100vw-2rem)] sm:!max-w-4xl"
        noCloseButton
        aria-describedby={undefined}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mb-4 flex items-center justify-between gap-4 md:mb-6">
            <DialogTitle className="font-gothic text-xl font-bold text-neutral-950 md:text-2xl">
              {t("learningPathsView.pathDetails")}
            </DialogTitle>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.button.close")}
              onClick={() => void saveAndClose()}
              disabled={isSaving}
              className="shrink-0 rounded-full"
            >
              <X className="size-5 text-neutral-800" />
            </Button>
          </div>
          <h4 className="mb-6 break-words text-xl font-bold text-neutral-950">{title}</h4>
          <div className="mb-6">
            <h5 className="mb-3 font-bold text-neutral-950">
              {t("modernCourseView.overview.description")}
            </h5>
            {canEdit ? (
              <Textarea
                aria-label={t("modernCourseView.overview.description")}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                disabled={isSaving}
                className="min-h-48"
              />
            ) : (
              <p className="whitespace-pre-wrap break-words text-neutral-800">
                {description || t("adminLearningPathsView.table.emptyDescription")}
              </p>
            )}
          </div>
          {hasSaveError && (
            <p role="alert" className="mb-4 text-sm text-error-600">
              {t("common.toast.somethingWentWrong")}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              onClick={() => void saveAndClose()}
              disabled={isSaving}
              className="px-6 font-semibold"
            >
              {t(canEdit ? "modernCourseView.common.saveChanges" : "modernCourseView.common.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
