import { Link, Navigate, useNavigate, useSearchParams } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { isAxiosError } from "axios";
import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { useOpenCourseAuthoringDraft } from "~/api/mutations/useOpenCourseAuthoringDraft";
import { useCurrentUserSuspense } from "~/api/queries";
import { useCourseAuthoringSessionQuery } from "~/api/queries/useCourseAuthoringSessionQuery";
import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import {
  AI_COURSE_CREATION_PATH,
  STANDARD_COURSE_CREATION_PATH,
  withAddCourseContext,
} from "~/modules/Admin/AddCourse/utils/addCourseOrigin";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import {
  isCompletedAuthoringDraft,
  isUnavailableAuthoringSession,
} from "./authoringSessionRecovery";
import {
  authoringSessionCreateCommandKey,
  authoringSessionSelectionKey,
  getOrCreateAuthoringSessionCommand,
  readAuthoringSessionSelection,
  writeAuthoringSessionSelection,
} from "./authoringSessionSelection";
import { useVisibleAuthoringSession } from "./authoringSessionVisibility";
import { AUTHORING_SESSION_STATUS } from "./courseAuthoring.constants";
import { CourseGenerationSession } from "./CourseGenerationSession";

import type { MetaFunction } from "@remix-run/react";

const DRAFT_POLL_INTERVAL_MS = 5_000;

export const meta: MetaFunction = ({ matches }) =>
  setPageTitle(matches, "adminCourseTypeSelector.ai.title");

/** Opens a native course editor only after the attached ID is present in the durable snapshot. */
const DraftWorkspace = ({ draftId, sessionId }: { draftId: string; sessionId: string }) => {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const uiLanguage = useLanguageStore((state) => state.language);
  const selectorPath = withAddCourseContext(STANDARD_COURSE_CREATION_PATH, params);
  const { hasAccess: canEditCourse } = usePermissions({
    required: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.COURSE_UPDATE_OWN],
  });
  const { data, error, refetch } = useCourseAuthoringSessionQuery(
    draftId,
    sessionId,
    DRAFT_POLL_INTERVAL_MS,
  );
  useVisibleAuthoringSession(draftId, sessionId);

  const refetchDraft = useCallback(() => void refetch(), [refetch]);
  const attachedCourse = data && data.courseId !== draftId ? data : null;
  if (isCompletedAuthoringDraft(error) || (attachedCourse && !canEditCourse)) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="h3">{t("courseAuthoring.draft.courseCreated")}</h1>
        <Button asChild>
          <Link to={selectorPath} replace>
            {t("adminCourseTypeSelector.back")}
          </Link>
        </Button>
      </div>
    );
  }
  if (attachedCourse) {
    const destination = new URLSearchParams({ sessionId, language: attachedCourse.language });
    return (
      <Navigate
        replace
        to={`/admin/beta-courses/${encodeURIComponent(attachedCourse.courseId)}/authoring?${destination}`}
      />
    );
  }

  if (data?.status === AUTHORING_SESSION_STATUS.DISCARDED || isUnavailableAuthoringSession(error)) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="h3">{t("courseAuthoring.draft.expiredTitle")}</h1>
        <p className="text-neutral-700">{t("courseAuthoring.draft.expiredBody")}</p>
        <Button asChild>
          <Link to={withAddCourseContext(AI_COURSE_CREATION_PATH, params)} replace>
            {t("courseAuthoring.draft.startAgain")}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <CourseGenerationSession
      courseId={draftId}
      sessionId={sessionId}
      language={data?.language ?? uiLanguage}
      embedded
      isDraft
      onSessionUnavailable={refetchDraft}
      onPermissionRevoked={refetchDraft}
    />
  );
};

/** Starts one draft per visit, recovering the same command if the first response is lost. */
const StartDraft = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: actor } = useCurrentUserSuspense();
  const language = useLanguageStore((state) => state.language);
  const { mutate: openDraft, isError } = useOpenCourseAuthoringDraft(language);
  const requestedRef = useRef(false);
  const commandKey = authoringSessionCreateCommandKey(
    authoringSessionSelectionKey(
      `new-draft:${actor.id}`,
      language,
      actor.supportContext?.targetTenantId,
    ),
  );
  const draftPath = withAddCourseContext(AI_COURSE_CREATION_PATH, params);
  const start = useCallback(() => {
    const commandId = getOrCreateAuthoringSessionCommand(commandKey);
    const clearPendingCommand = () => {
      if (readAuthoringSessionSelection(commandKey) === commandId)
        writeAuthoringSessionSelection(commandKey, null);
    };
    openDraft(commandId, {
      onError: (error) => {
        if (isAxiosError(error) && error.response?.status === 410) clearPendingCommand();
      },
      onSuccess: (session) => {
        clearPendingCommand();
        const destination = new URL(draftPath, window.location.origin);
        destination.searchParams.set("draftId", session.courseId);
        destination.searchParams.set("sessionId", session.sessionId);
        navigate(`${destination.pathname}${destination.search}`, { replace: true });
      },
    });
  }, [commandKey, draftPath, navigate, openDraft]);

  useEffect(() => {
    let cancelled = false;
    // Start after StrictMode's effect replay so the mutation observer stays subscribed.
    queueMicrotask(() => {
      if (cancelled || requestedRef.current) return;
      requestedRef.current = true;
      start();
    });
    return () => {
      cancelled = true;
    };
  }, [start]);

  return (
    <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
      {isError ? (
        <>
          <p role="alert" className="text-neutral-700">
            {t("courseAuthoring.draft.startFailed")}
          </p>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link to={withAddCourseContext(STANDARD_COURSE_CREATION_PATH, params)} replace>
                {t("adminCourseTypeSelector.back")}
              </Link>
            </Button>
            <Button onClick={start}>{t("courseAuthoring.conversation.retry")}</Button>
          </div>
        </>
      ) : (
        <p role="status" className="flex items-center gap-2 text-neutral-700">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("courseAuthoring.draft.starting")}
        </p>
      )}
    </div>
  );
};

/** Checks the tenant capability before mounting draft queries and creation. */
const CourseAuthoringDraftPage = () => {
  const { t } = useTranslation();
  const { data: capability, isPending, isError, refetch } = useLumaConfigured();
  const [params] = useSearchParams();
  const draftId = params.get("draftId");
  const sessionId = params.get("sessionId");

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p role="status" className="flex items-center gap-2 text-neutral-700">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          {t("courseAuthoring.draft.starting")}
        </p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="mx-auto flex h-full max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
        <p role="alert" className="text-neutral-700">
          {t("courseAuthoring.draft.startFailed")}
        </p>
        <Button onClick={() => void refetch()}>{t("courseAuthoring.conversation.retry")}</Button>
      </div>
    );
  }
  if (!capability?.courseGenerationEnabled) {
    return <Navigate replace to={withAddCourseContext(STANDARD_COURSE_CREATION_PATH, params)} />;
  }
  if (draftId && sessionId) {
    return (
      <DraftWorkspace key={`${draftId}:${sessionId}`} draftId={draftId} sessionId={sessionId} />
    );
  }
  return <StartDraft />;
};

export default CourseAuthoringDraftPage;
