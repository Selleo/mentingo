/** Keeps an already opened session observable while its drawer is closed. */
import { useQuery } from "@tanstack/react-query";
import { MessageCircleQuestion } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import {
  authoringSessionKey,
  authoringSessionQueryOptions,
  refreshAuthoringSession,
} from "~/api/queries/useCourseAuthoringSessionQuery";
import { queryClient } from "~/api/queryClient";
import { Button } from "~/components/ui/button";

import { projectWorkspaceRecords } from "../courseAuthoring.records";
import { useCourseAuthoringSocket } from "../hooks/useCourseAuthoringSocket";

import type { AuthoringSession } from "../courseAuthoring.types";
import type { SupportedLanguages } from "@repo/shared";

type Props = { courseId: string; language: SupportedLanguages; onOpen: () => void };

/** Receives durable updates without opening a new session or navigating away from the editor. */
export const AuthoringAttentionNotice = ({ courseId, language, onOpen }: Props) => {
  const { t } = useTranslation();
  const { data: session } = useQuery({
    ...authoringSessionQueryOptions(courseId, language),
    enabled: false,
  });
  /** Accepts only forward snapshot progress for this localized course. */
  const onSnapshot = useCallback(
    (snapshot: AuthoringSession) => {
      queryClient.setQueryData<AuthoringSession>(
        authoringSessionKey(courseId, language),
        (current) =>
          !current || snapshot.snapshotSequence >= current.snapshotSequence ? snapshot : current,
      );
    },
    [courseId, language],
  );
  /** Recovers missed events from the existing session without paid polling. */
  const onRefresh = useCallback(async () => {
    if (!session?.sessionId) return undefined;
    return refreshAuthoringSession(courseId, session.sessionId);
  }, [courseId, session?.sessionId]);
  const connection = useCourseAuthoringSocket({ courseId, session, onSnapshot, onRefresh });
  const projection = projectWorkspaceRecords(session?.records ?? [], session?.tasks ?? []);
  const needsInput =
    projection.questions.length > 0 ||
    projection.assetTasks.some((task) => task.status === "waiting_author");
  // An offline socket includes permission revocation. Do not expose cached session data after access is lost.
  if (!needsInput || connection === "offline") return null;
  return (
    <div className="fixed bottom-5 right-5 z-40" role="status" aria-live="polite">
      <Button type="button" onClick={onOpen} className="gap-2 shadow-lg">
        <MessageCircleQuestion className="size-4" aria-hidden="true" />
        {t("courseAuthoring.activityRail.needsInput")}
      </Button>
    </div>
  );
};
