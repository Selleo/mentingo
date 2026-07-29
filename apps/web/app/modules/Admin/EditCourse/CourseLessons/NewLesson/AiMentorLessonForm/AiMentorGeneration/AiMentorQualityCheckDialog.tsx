import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

import type { AiMentorQualityResult } from "./aiMentorGeneration.types";

type AiMentorQualityCheckDialogProps = {
  open: boolean;
  isLoading?: boolean;
  result?: AiMentorQualityResult;
  onOpenChange: (open: boolean) => void;
  onImprove?: () => void;
};

export const AiMentorQualityCheckDialog = ({
  open,
  isLoading = false,
  result,
  onOpenChange,
  onImprove,
}: AiMentorQualityCheckDialogProps) => {
  const { t } = useTranslation();

  const renderContent = () => {
    if (isLoading)
      return (
        <p className="text-sm text-neutral-600">
          {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.checking")}
        </p>
      );
    if (!result) return null;

    return (
      <div className="space-y-4">
        <p className="font-semibold">{result.summary}</p>
        {result.findings.length > 0 && (
          <ul className="divide-y rounded-md border">
            {result.findings.map((finding) => (
              <li
                key={`${finding.code}-${finding.field ?? "configuration"}`}
                className="p-3"
              >
                <p className="text-sm font-medium">{finding.message}</p>
                <p className="mt-1 text-sm text-neutral-600">{finding.correction}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={isLoading ? () => undefined : onOpenChange}>
      <DialogContent
        variant="mobileDrawer"
        className="!flex max-h-[85dvh] !flex-col sm:w-[min(92vw,36rem)] sm:!max-w-none"
      >
        <DialogHeader className="shrink-0 border-b border-neutral-200 px-5 py-4 pr-14 sm:px-6">
          <DialogTitle>
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.title")}
          </DialogTitle>
          <DialogDescription>
            {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {renderContent()}
        </div>
        {!isLoading && (
          <DialogFooter className="shrink-0 border-t border-neutral-200 px-5 py-4 sm:px-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.close")}
            </Button>
            {result && result.findings.length > 0 && onImprove && (
              <Button type="button" onClick={onImprove}>
                {t("adminCourseView.curriculum.lesson.aiMentorGeneration.quality.improve")}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};
