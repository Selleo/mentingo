import { ChevronDown, ListChecks } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

type AiMentorConfigurationDialogFooterProps = {
  canEditStructure: boolean;
  canImprove: boolean;
  canValidate: boolean;
  isAiBusy: boolean;
  isSaving: boolean;
  submitLabelKey: string;
  onCancel: () => void;
  onImprove: () => void;
  onValidate: () => void;
};

export const AiMentorConfigurationDialogFooter = ({
  canEditStructure,
  canImprove,
  canValidate,
  isAiBusy,
  isSaving,
  submitLabelKey,
  onCancel,
  onImprove,
  onValidate,
}: AiMentorConfigurationDialogFooterProps) => {
  const { t } = useTranslation();
  const showAiAssistance = canEditStructure && (canImprove || canValidate);

  return (
    <DialogFooter className="shrink-0 gap-2 border-t border-neutral-200 bg-white px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:gap-0 sm:px-6 sm:py-4">
      {showAiAssistance && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start gap-2 sm:mr-auto sm:w-auto"
              disabled={isAiBusy}
            >
              <Icon name="WandSparkles" className="size-4 text-primary-700" />
              {t("adminCourseView.curriculum.lesson.aiMentorGeneration.aiAssistance")}
              <ChevronDown className="ml-auto size-4 text-neutral-500 sm:ml-1" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64 rounded-lg bg-white p-1.5">
            {canImprove && (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-neutral-900 outline-none focus:bg-neutral-100"
                onSelect={onImprove}
              >
                <Icon name="WandSparkles" className="size-4 shrink-0 text-primary-700" />
                <span>
                  {t("adminCourseView.curriculum.lesson.aiMentorGeneration.improveWithAi")}
                </span>
              </DropdownMenuItem>
            )}
            {canValidate && (
              <DropdownMenuItem
                className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-neutral-900 outline-none focus:bg-neutral-100"
                onSelect={onValidate}
              >
                <ListChecks className="size-4 shrink-0 text-neutral-600" aria-hidden />
                <span>
                  {t("adminCourseView.curriculum.lesson.aiMentorGeneration.checkQualityWithAi")}
                </span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <Button type="button" variant="outline" disabled={isSaving} onClick={onCancel}>
        {t("common.button.cancel")}
      </Button>
      <Button
        type="submit"
        data-testid="curriculum-ai-mentor-configuration-apply-button"
        disabled={isSaving}
      >
        {t(submitLabelKey)}
      </Button>
    </DialogFooter>
  );
};
