/** Hosts the shared generation conversation in the existing bottom-drawer pattern. */
import { Maximize2, Minimize2, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";

import { useCreateCourseAuthoringSession } from "~/api/mutations/useCreateCourseAuthoringSession";
import { authoringSessionKey } from "~/api/queries/useCourseAuthoringSessionQuery";
import { useCourseAuthoringSessionsQuery } from "~/api/queries/useCourseAuthoringSessionsQuery";
import { useCurrentUser } from "~/api/queries/useCurrentUser";
import { useInfiniteCourseAuthoringSessionsQuery } from "~/api/queries/useInfiniteCourseAuthoringSessionsQuery";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "~/components/ui/drawer";
import { useDebounce } from "~/hooks/useDebounce";
import { cn } from "~/lib/utils";

import { COURSE_AUTHORING_HANDLES } from "../../../e2e/data/curriculum/handles";

import {
  authoringSessionSelectionKey,
  authoringSessionCreateCommandKey,
  getOrCreateAuthoringSessionCommand,
  readAuthoringSessionSelection,
  selectAuthoringSession,
  writeAuthoringSessionSelection,
} from "./authoringSessionSelection";
import { AuthoringSessionMenu } from "./components/AuthoringSessionMenu";
import { CourseGenerationSession } from "./CourseGenerationSession";

import type {
  AuthoringSessionSummary,
  CurriculumPreview,
  CurriculumPreviewActions,
  PreviewView,
} from "./courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

type Props = {
  courseId: string;
  language: SupportedLanguages;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPreviewInCurriculum?: (preview: PreviewView) => void;
  onPreviewProposalInCurriculum?: (
    preview: CurriculumPreview,
    actions: CurriculumPreviewActions,
  ) => void;
  onCurriculumPreviewChange?: (preview: CurriculumPreview | null) => void;
};

const MIN_DRAWER_HEIGHT = 360;
const MAX_DRAWER_HEIGHT_RATIO = 0.9;
const RESIZE_STEP = 48;
const SESSION_MENU_PAGE_SIZE = 8;

/** Opens or closes the UI only; generation control remains an explicit session command. */
export const CourseGenerationDrawer = ({
  courseId,
  language,
  open,
  onOpenChange,
  onPreviewInCurriculum,
  onPreviewProposalInCurriculum,
  onCurriculumPreviewChange,
}: Props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const createSessionScopeRef = useRef<string | null>(null);
  const sessionSelectionKey = authoringSessionSelectionKey(courseId, language, tenantScope);
  const sessionCreateCommandKey = authoringSessionCreateCommandKey(sessionSelectionKey);

  useEffect(
    () => () => {
      resizeCleanupRef.current?.();
    },
    [],
  );
  useEffect(() => {
    if (!open) resizeCleanupRef.current?.();
  }, [open]);

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
    const nextSessionId = selectAuthoringSession(
      sessions,
      selectedSessionId ?? readAuthoringSessionSelection(sessionSelectionKey),
    );
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
  };

  /** Switches the full timeline and releases the old socket subscription through remount cleanup. */
  const selectConversation = (session: AuthoringSessionSummary) => {
    setSelectedSessionId(session.sessionId);
    setSelectedSessionSummary(session);
    writeAuthoringSessionSelection(sessionSelectionKey, session.sessionId);
    setSessionMenuOpen(false);
  };
  /** Prefers the explicitly chosen/created session so the trigger label stays correct while the popover's own list is search-filtered. */
  const selectedSession =
    selectedSessionSummary?.sessionId === selectedSessionId
      ? selectedSessionSummary
      : sessionsQuery.data?.find((session) => session.sessionId === selectedSessionId);
  /** Drops an inaccessible cached timeline and chooses only from a fresh authorized list. */
  const recoverUnavailableSession = useCallback(
    async (staleSessionId: string) => {
      queryClient.removeQueries({ queryKey: authoringSessionKey(courseId, staleSessionId) });
      createSessionScopeRef.current = null;
      setSelectedSessionId((current) => (current === staleSessionId ? null : current));
      writeAuthoringSessionSelection(sessionSelectionKey, null);
      const result = await refetchSessions();
      const nextSessionId = selectAuthoringSession(result.data ?? [], null);
      setSelectedSessionId(nextSessionId);
      writeAuthoringSessionSelection(sessionSelectionKey, nextSessionId);
    },
    [courseId, refetchSessions, sessionSelectionKey],
  );

  /** Caps the drawer at ninety percent of the viewport while remaining usable on short screens. */
  const getMaxDrawerHeight = () =>
    Math.min(
      window.innerHeight,
      Math.max(MIN_DRAWER_HEIGHT, Math.round(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO)),
    );

  /** Clamps a requested drawer height to the current viewport bounds. */
  const clampDrawerHeight = (height: number) =>
    Math.min(Math.max(height, MIN_DRAWER_HEIGHT), getMaxDrawerHeight());

  /** Starts pointer resizing from the grab handle and restores global interaction styles on exit. */
  const handleResizeStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || event.isPrimary === false) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    setExpanded(false);
    setDrawerHeight(clampDrawerHeight(window.innerHeight - event.clientY));
    const previousBodyCursor = document.body.style.cursor;
    const previousHtmlCursor = document.documentElement.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "ns-resize";
    document.documentElement.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    const handlePointerMove = (moveEvent: PointerEvent) => {
      setDrawerHeight(clampDrawerHeight(window.innerHeight - moveEvent.clientY));
    };
    /** Ends pointer resizing for both normal release and browser cancellation. */
    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      document.body.style.cursor = previousBodyCursor;
      document.documentElement.style.cursor = previousHtmlCursor;
      document.body.style.userSelect = previousUserSelect;
      resizeCleanupRef.current = null;
    };

    resizeCleanupRef.current = handlePointerUp;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  /** Adjusts the drawer height from the keyboard without starting Vaul’s swipe gesture. */
  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextHeight: number | null = null;
    const currentHeight =
      drawerHeight ?? drawerRef.current?.getBoundingClientRect().height ?? getMaxDrawerHeight();
    switch (event.key) {
      case "ArrowUp":
        nextHeight = currentHeight + RESIZE_STEP;
        break;
      case "ArrowDown":
        nextHeight = currentHeight - RESIZE_STEP;
        break;
      case "Home":
        nextHeight = MIN_DRAWER_HEIGHT;
        break;
      case "End":
        nextHeight = getMaxDrawerHeight();
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    setExpanded(false);
    setDrawerHeight(clampDrawerHeight(nextHeight));
  };

  /** Lets the focused authoring popup consume Escape before Vaul dismisses the drawer. */
  const handleDrawerEscape = (event: KeyboardEvent) => {
    if (!(event.target instanceof Element)) return;
    const popup = event.target.closest("[data-course-authoring-popup]");
    if (!popup) return;
    event.preventDefault();
    popup.dispatchEvent(new Event("course-authoring-popup-escape"));
  };

  return (
    <>
      <Drawer open={open} modal={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent
          ref={drawerRef}
          forceMount
          renderOverlay={open}
          data-testid={COURSE_AUTHORING_HANDLES.DRAWER}
          overlayClassName="z-[49] bg-black/30"
          onEscapeKeyDown={handleDrawerEscape}
          style={!expanded && drawerHeight !== null ? { height: `${drawerHeight}px` } : undefined}
          className={cn(
            "scrollbar-hide overflow-visible rounded-t-2xl border-neutral-200 bg-white p-0 shadow-2xl [&>div:first-child]:hidden",
            !open && "pointer-events-none invisible",
            expanded ? "h-[90dvh]" : "h-[min(32rem,82dvh)]",
          )}
          aria-hidden={!open}
        >
          <DrawerTitle className="sr-only">{t("courseAuthoring.title")}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {t("courseAuthoring.conversation.drawerDescription")}
          </DrawerDescription>
          <div
            data-vaul-no-drag
            className="relative flex h-10 shrink-0 items-center justify-center border-b border-neutral-100"
          >
            <button
              type="button"
              data-vaul-no-drag
              data-testid={COURSE_AUTHORING_HANDLES.RESIZE_HANDLE}
              aria-label={t("courseAuthoring.conversation.resize", {
                defaultValue: "Resize drawer",
              })}
              onPointerDown={handleResizeStart}
              onKeyDown={handleResizeKeyDown}
              className="group absolute inset-0 flex h-10 w-full cursor-ns-resize touch-none items-center justify-center"
            >
              <span
                aria-hidden="true"
                className="h-1 w-10 rounded-full bg-neutral-300 transition-colors group-hover:bg-neutral-500"
              />
            </button>
            <div className="pointer-events-auto absolute left-2 z-10 max-w-[calc(100%-7rem)]">
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
            </div>
            <div className="pointer-events-auto absolute right-2 z-10 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                data-testid={COURSE_AUTHORING_HANDLES.RESIZE_TOGGLE}
                onClick={() => setExpanded((value) => !value)}
                aria-label={t(
                  expanded
                    ? "courseAuthoring.conversation.collapse"
                    : "courseAuthoring.conversation.expand",
                )}
              >
                {expanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => onOpenChange(false)}
                aria-label={t("courseAuthoring.conversation.close")}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <div
            data-vaul-no-drag
            className={cn("min-h-0 flex-1 overflow-hidden", !open && "hidden")}
          >
            <div className="h-full min-w-0">
              {selectedSession && (
                <CourseGenerationSession
                  key={selectedSession.sessionId}
                  courseId={courseId}
                  language={language}
                  sessionId={selectedSession.sessionId}
                  embedded
                  onPreviewInCurriculum={onPreviewInCurriculum}
                  onPreviewProposalInCurriculum={onPreviewProposalInCurriculum}
                  onCurriculumPreviewChange={onCurriculumPreviewChange}
                  onSessionUnavailable={recoverUnavailableSession}
                />
              )}
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
