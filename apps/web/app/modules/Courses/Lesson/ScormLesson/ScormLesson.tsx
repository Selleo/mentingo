import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useScormLaunch } from "~/api/queries";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LEARNING_HANDLES } from "../../../../../e2e/data/learning/handles";

import { ScormPlayer } from "./ScormPlayer";

type ScormLessonProps = {
  lessonId: string;
};

type ScormNavigationProps = {
  title: string;
  previousScoId: string | null;
  nextScoId: string | null;
  onSelectSco: (scoId: string | null) => void;
};

function ScormNavigation({ title, previousScoId, nextScoId, onSelectSco }: ScormNavigationProps) {
  const { t } = useTranslation();

  return (
    <div
      data-testid={LEARNING_HANDLES.SCORM_NAVIGATION}
      className="grid min-h-12 grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2"
    >
      <Button
        data-testid={LEARNING_HANDLES.SCORM_PREVIOUS_SECTION_BUTTON}
        variant="outline"
        className="justify-self-start"
        disabled={!previousScoId}
        onClick={() => onSelectSco(previousScoId)}
      >
        <ChevronLeft className="size-4" />
        {t("studentLessonView.scorm.previousSco")}
      </Button>
      <p className="body-sm-md max-w-80 truncate text-center text-neutral-950">{title}</p>
      <Button
        data-testid={LEARNING_HANDLES.SCORM_NEXT_SECTION_BUTTON}
        variant="outline"
        className="justify-self-end"
        disabled={!nextScoId}
        onClick={() => onSelectSco(nextScoId)}
      >
        {t("studentLessonView.scorm.nextSco")}
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

export function ScormLesson({ lessonId }: ScormLessonProps) {
  const { t } = useTranslation();
  const { language } = useLanguageStore();
  const [selectedScoId, setSelectedScoId] = useState<string | null>(null);
  const {
    data: launch,
    isLoading,
    isError,
    refetch,
  } = useScormLaunch({
    lessonId,
    scoId: selectedScoId,
  });

  if (isLoading) {
    return (
      <div className="grid min-h-[28rem] place-items-center rounded-lg border border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-3 text-neutral-700">
          <Loader2 className="size-5 animate-spin" />
          <span className="body-sm-md">{t("studentLessonView.scorm.loading")}</span>
        </div>
      </div>
    );
  }

  if (isError || !launch) {
    return (
      <Dialog open>
        <DialogContent data-testid={LEARNING_HANDLES.SCORM_LAUNCH_FAILED_DIALOG} noCloseButton>
          <DialogHeader>
            <DialogTitle>{t("studentLessonView.scorm.launchFailed")}</DialogTitle>
            <DialogDescription>{t("studentLessonView.scorm.launchFailedBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              data-testid={LEARNING_HANDLES.SCORM_LAUNCH_RETRY_BUTTON}
              onClick={() => void refetch()}
            >
              {t("studentLessonView.scorm.tryAgain")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const hasScoNavigation = Boolean(launch.navigation.previousScoId || launch.navigation.nextScoId);

  return (
    <div className="flex w-full flex-col gap-4">
      {hasScoNavigation && (
        <ScormNavigation
          title={launch.scoTitle}
          previousScoId={launch.navigation.previousScoId}
          nextScoId={launch.navigation.nextScoId}
          onSelectSco={setSelectedScoId}
        />
      )}
      <ScormPlayer launch={launch} language={language} />
    </div>
  );
}
