import { useTranslation } from "react-i18next";

import { DialogDescription, DialogTitle } from "~/components/ui/dialog";

import { helpdeskTutorialLabel } from "./self-onboarding.helpers";
import { HelpdeskRelatedTutorials } from "./SelfOnboardingRelatedTutorials";
import { HelpdeskTutorialPlayer } from "./SelfOnboardingTutorialPlayer";

import type { HelpdeskSelection } from "./self-onboarding.types";

type Props = {
  selection: HelpdeskSelection;
  onSelect: (selection: HelpdeskSelection) => void;
  chapterUnavailable?: boolean;
};

export default function HelpdeskVideoContent({ selection, onSelect, chapterUnavailable }: Props) {
  const { t } = useTranslation();
  const { tutorial, startMs } = selection;
  return (
    <>
      <div className="px-6 pb-4 pt-5 pr-12">
        <DialogTitle className="text-xl leading-snug">
          {helpdeskTutorialLabel(tutorial).title}
        </DialogTitle>
        <DialogDescription className="mt-1.5 text-neutral-600">
          {tutorial.description}
        </DialogDescription>
      </div>
      {chapterUnavailable && (
        <p role="status" className="px-6 pb-4 body-sm text-neutral-600">
          {t("helpdesk.chapterUnavailable")}
        </p>
      )}
      <HelpdeskTutorialPlayer
        key={`${tutorial.revisionId}:${startMs}`}
        tutorial={tutorial}
        startMs={startMs}
        showChapterTimeline={false}
      />
      <HelpdeskRelatedTutorials currentKey={tutorial.key} onSelect={onSelect} />
    </>
  );
}
