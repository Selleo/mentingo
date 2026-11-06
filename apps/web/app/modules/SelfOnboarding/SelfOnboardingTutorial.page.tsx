import { Link, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useHelpdeskTutorial } from "~/api/queries/self-onboarding/useSelfOnboardingTutorial";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import {
  helpdeskTutorialLabel,
  helpdeskTutorialPath,
  selectedHelpdeskChapter,
} from "./self-onboarding.helpers";
import { HelpdeskRelatedTutorials } from "./SelfOnboardingRelatedTutorials";
import { HelpdeskLoading, HelpdeskRequestError } from "./SelfOnboardingRequestState";
import { HelpdeskTutorialPlayer } from "./SelfOnboardingTutorialPlayer";

export default function HelpdeskTutorialPage() {
  const { t } = useTranslation();
  const { key = "" } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const language = useLanguageStore((state) => state.language);
  const { data: tutorial, isPending, isError, error, refetch } = useHelpdeskTutorial(key, language);
  const chapterId = search.get("chapter");
  const chapter = tutorial ? selectedHelpdeskChapter(tutorial, chapterId) : undefined;

  return (
    <PageWrapper>
      <Button asChild variant="ghost" className="mb-4">
        <Link to="/dashboard">
          <ArrowLeft className="mr-2 size-4" aria-hidden />
          {t("helpdesk.back")}
        </Link>
      </Button>
      <section className="mx-auto max-w-5xl overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {isPending && <HelpdeskLoading />}
        {isError && (
          <HelpdeskRequestError
            error={error}
            onRetry={() => {
              void refetch();
            }}
          />
        )}
        {tutorial && !isError && (
          <>
            <header className="px-6 pb-4 pt-5">
              <h1 className="text-xl font-semibold leading-snug text-neutral-950">
                {helpdeskTutorialLabel(tutorial).title}
              </h1>
              <p className="mt-1.5 body-sm text-neutral-600">{tutorial.description}</p>
            </header>
            {chapterId && !chapter && (
              <p role="status" className="px-6 pb-4 body-sm text-neutral-600">
                {t("helpdesk.chapterUnavailable")}
              </p>
            )}
            <HelpdeskTutorialPlayer
              key={`${tutorial.revisionId}:${chapter?.id ?? "video"}`}
              tutorial={tutorial}
              startMs={chapter?.startMs ?? 0}
            />
            <HelpdeskRelatedTutorials
              currentKey={tutorial.key}
              onSelect={({ tutorial }) => navigate(helpdeskTutorialPath(tutorial.key))}
            />
          </>
        )}
      </section>
    </PageWrapper>
  );
}
