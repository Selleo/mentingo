import { lazy, Suspense, useState } from "react";
import { useTranslation } from "react-i18next";

import { useHelpdeskTutorial } from "~/api/queries/helpdesk/useHelpdeskTutorial";
import { DialogTitle } from "~/components/ui/dialog";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { selectedHelpdeskChapter } from "./helpdesk.helpers";
import { HelpdeskRequestError } from "./HelpdeskRequestState";
import { HelpdeskVideoDialogFrame } from "./HelpdeskVideoDialogFrame";

import type { HelpdeskSelection } from "./helpdesk.types";

const HelpdeskVideoContent = lazy(() => import("./HelpdeskVideoContent"));

type Props = {
  tutorialKey: string;
  chapterId?: string;
  onClose: () => void;
  onRestoreFocus: () => void;
};

function LoadingVideo() {
  const { t } = useTranslation();
  return (
    <>
      <DialogTitle className="sr-only">{t("helpdesk.loading")}</DialogTitle>
      <div
        role="status"
        aria-label={t("helpdesk.loading")}
        className="aspect-video animate-pulse bg-neutral-100"
      />
    </>
  );
}

/** Refresh version/language-compatible metadata before opening an Assistant citation. */
export default function HelpdeskTutorialDialog({
  tutorialKey,
  chapterId,
  onClose,
  onRestoreFocus,
}: Props) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const { data: tutorial, isError, error, refetch } = useHelpdeskTutorial(tutorialKey, language);
  const [relatedSelection, setRelatedSelection] = useState<HelpdeskSelection | null>(null);
  const chapter = tutorial ? selectedHelpdeskChapter(tutorial, chapterId ?? null) : undefined;
  const selection =
    relatedSelection ??
    (tutorial && !isError ? { tutorial, startMs: chapter?.startMs ?? 0 } : null);

  let content = <LoadingVideo />;
  if (selection) {
    content = (
      <Suspense fallback={<LoadingVideo />}>
        <HelpdeskVideoContent
          selection={selection}
          onSelect={setRelatedSelection}
          chapterUnavailable={!relatedSelection && Boolean(chapterId) && !chapter}
        />
      </Suspense>
    );
  } else if (isError) {
    content = (
      <>
        <DialogTitle className="px-6 pt-5 pr-12">{t("helpdesk.title")}</DialogTitle>
        <HelpdeskRequestError
          error={error}
          onRetry={() => {
            void refetch();
          }}
        />
      </>
    );
  }
  return (
    <HelpdeskVideoDialogFrame onClose={onClose} onRestoreFocus={onRestoreFocus}>
      {content}
    </HelpdeskVideoDialogFrame>
  );
}
