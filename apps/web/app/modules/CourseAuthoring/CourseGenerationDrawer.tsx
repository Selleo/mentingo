/** Hosts the shared generation conversation in the existing bottom-drawer pattern. */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useCreateCourseAuthoringSession } from "~/api/mutations/useCreateCourseAuthoringSession";
import { useCourseAuthoringSessionsQuery } from "~/api/queries/useCourseAuthoringSessionsQuery";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useInfiniteCourseAuthoringSessionsQuery } from "~/api/queries/useInfiniteCourseAuthoringSessionsQuery";
import { useDebounce } from "~/hooks/useDebounce";

import { COURSE_AUTHORING_HANDLES } from "../../../e2e/data/curriculum/handles";

import {
  authoringSessionSelectionKey,
  authoringSessionCreateCommandKey,
  getOrCreateAuthoringSessionCommand,
  readAuthoringSessionSelection,
  selectAuthoringSession,
  writeAuthoringSessionSelection,
} from "./authoringSessionSelection";
import { useVisibleAuthoringSession } from "./authoringSessionVisibility";
import { AuthoringSessionMenu } from "./components/AuthoringSessionMenu";
import { CourseAuthoringDrawer } from "./CourseAuthoringDrawer";
import { CourseGenerationSession } from "./CourseGenerationSession";

import type {
  AuthoringSessionSummary,
  CurriculumPreview,
  CurriculumPreviewActions,
} from "./courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

type Props = {
  courseId: string;
  language: SupportedLanguages;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestedSessionId?: string | null;
  onSessionChange?: (sessionId: string) => void;
  onPreviewProposalInCurriculum?: (
    preview: CurriculumPreview,
    actions: CurriculumPreviewActions,
  ) => void;
  onCurriculumPreviewChange?: (preview: CurriculumPreview | null) => void;
};

const SESSION_MENU_PAGE_SIZE = 8;

/** Opens or closes the UI only; generation control remains an explicit session command. */
export const CourseGenerationDrawer = ({
  courseId,
  language,
  open,
  onOpenChange,
  requestedSessionId,
  onSessionChange,
  onPreviewProposalInCurriculum,
  onCurriculumPreviewChange,
}: Props) => {
  const { t } = useTranslation();
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    requestedSessionId ?? null,
  );
  const [selectedSessionSummary, setSelectedSessionSummary] =
    useState<AuthoringSessionSummary | null>(null);
  const [sessionMenuOpen, setSessionMenuOpen] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const debouncedSessionSearch = useDebounce(sessionSearch, 300);
  const currentUserQuery = useCurrentUser();
  const tenantScope = currentUserQuery.data?.supportContext?.targetTenantId;
  const sessionsQuery = useCourseAuthoringSessionsQuery(courseId, tenantScope);
  const refetchSessions = sessionsQuery.refetch;
  const {
    data: infiniteSessionsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending: isSessionMenuLoading,
  } = useInfiniteCourseAuthoringSessionsQuery(
    { courseId, tenantScope, keyword: debouncedSessionSearch, perPage: SESSION_MENU_PAGE_SIZE },
    { enabled: sessionMenuOpen },
  );
  const menuSessions = infiniteSessionsData?.pages.flatMap((page) => page.data) ?? [];
  const createSession = useCreateCourseAuthoringSession(courseId, language);
  const drawerRef = useRef<HTMLDivElement>(null);
  const createSessionScopeRef = useRef<string | null>(null);
  const sessionSelectionKey = authoringSessionSelectionKey(courseId, language, tenantScope);
  const sessionCreateCommandKey = authoringSessionCreateCommandKey(sessionSelectionKey);
  useVisibleAuthoringSession(courseId, selectedSessionId, open);

  /** Opens newly linked conversations without resetting the drawer's size or expansion. */
  useEffect(() => {
    if (!requestedSessionId) return;
    setSelectedSessionId(requestedSessionId);
    setSelectedSessionSummary((current) =>
      current?.sessionId === requestedSessionId ? current : null,
    );
  }, [requestedSessionId]);

  /** Restores authors to their next message after leaving the read-only curriculum preview. */
  useEffect(() => {
    if (!open || !selectedSessionId) return;
    const frame = window.requestAnimationFrame(() => {
      drawerRef.current
        ?.querySelector<HTMLTextAreaElement>(
          `[data-testid="${COURSE_AUTHORING_HANDLES.BRIEF_INPUT}"]`,
        )
        ?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, selectedSessionId]);

  useEffect(() => {
    const sessions = sessionsQuery.data;
    if (!open || !sessions) return;
    const persistedSelection =
      selectedSessionId ?? readAuthoringSessionSelection(sessionSelectionKey);
    const nextSessionId = persistedSelection ?? selectAuthoringSession(sessions, null);
    if (nextSessionId !== selectedSessionId) setSelectedSessionId(nextSessionId);
    writeAuthoringSessionSelection(sessionSelectionKey, nextSessionId);
    if (nextSessionId || createSessionScopeRef.current === sessionSelectionKey) return;

    createSessionScopeRef.current = sessionSelectionKey;
    const commandId = getOrCreateAuthoringSessionCommand(sessionCreateCommandKey);
    void createSession
      .mutateAsync(commandId)
      .then((session) => {
        if (createSessionScopeRef.current !== sessionSelectionKey) return;
        writeAuthoringSessionSelection(sessionCreateCommandKey, null);
        writeAuthoringSessionSelection(sessionSelectionKey, session.sessionId);
        setSelectedSessionId(session.sessionId);
      })
      .catch(() => {
        if (createSessionScopeRef.current === sessionSelectionKey)
          createSessionScopeRef.current = null;
      });
  }, [
    createSession,
    open,
    selectedSessionId,
    sessionCreateCommandKey,
    sessionSelectionKey,
    sessionsQuery.data,
  ]);

  const startConversation = async () => {
    const session = await createSession.mutateAsync(undefined);
    setSelectedSessionId(session.sessionId);
    setSelectedSessionSummary(null);
    writeAuthoringSessionSelection(sessionSelectionKey, session.sessionId);
    setSessionMenuOpen(false);
    onSessionChange?.(session.sessionId);
  };

  /** Switches the full timeline and releases the old socket subscription through remount cleanup. */
  const selectConversation = (session: AuthoringSessionSummary) => {
    setSelectedSessionId(session.sessionId);
    setSelectedSessionSummary(session);
    writeAuthoringSessionSelection(sessionSelectionKey, session.sessionId);
    setSessionMenuOpen(false);
    onSessionChange?.(session.sessionId);
  };
  /** Prefers the explicitly chosen/created session so the trigger label stays correct while the popover's own list is search-filtered. */
  const selectedSession =
    selectedSessionSummary?.sessionId === selectedSessionId
      ? selectedSessionSummary
      : sessionsQuery.data?.find((session) => session.sessionId === selectedSessionId);
  /** Refreshes the picker after a missing session without silently switching or creating a conversation. */
  const recoverUnavailableSession = useCallback(
    async (_staleSessionId: string) => {
      writeAuthoringSessionSelection(sessionSelectionKey, null);
      await refetchSessions();
    },
    [refetchSessions, sessionSelectionKey],
  );

  return (
    <CourseAuthoringDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t("courseAuthoring.title")}
      description={t("courseAuthoring.conversation.drawerDescription")}
      contentRef={drawerRef}
      keepMounted
      headerAction={
        <AuthoringSessionMenu
          open={sessionMenuOpen}
          onOpenChange={(nextOpen) => {
            setSessionMenuOpen(nextOpen);
            if (!nextOpen) setSessionSearch("");
          }}
          sessions={menuSessions}
          selectedSessionId={selectedSessionId}
          selectedTitle={selectedSession?.title}
          search={sessionSearch}
          onSearchChange={setSessionSearch}
          onSelect={selectConversation}
          onNewChat={() => void startConversation()}
          creating={createSession.isPending}
          loading={isSessionMenuLoading}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          onLoadMore={() => void fetchNextPage()}
        />
      }
    >
      {selectedSessionId && (
        <CourseGenerationSession
          key={selectedSessionId}
          courseId={courseId}
          language={language}
          sessionId={selectedSessionId}
          embedded
          onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
          onCurriculumPreviewChange={onCurriculumPreviewChange}
          onSessionUnavailable={recoverUnavailableSession}
        />
      )}
    </CourseAuthoringDrawer>
  );
};
