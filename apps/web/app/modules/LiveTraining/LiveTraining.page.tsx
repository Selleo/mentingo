import { Navigate, useLocation, useNavigate, useParams } from "@remix-run/react";
import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_PARTICIPANT_ROLES,
  LIVE_TRAINING_SESSION_STATUSES,
} from "@repo/shared";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useDeleteLiveTraining } from "~/api/mutations/live-training/useDeleteLiveTraining";
import { useEndLiveTrainingSession } from "~/api/mutations/live-training/useEndLiveTrainingSession";
import { useJoinLiveTrainingSession } from "~/api/mutations/live-training/useJoinLiveTrainingSession";
import { useStartLiveTrainingSession } from "~/api/mutations/live-training/useStartLiveTrainingSession";
import { useUpdateLiveTraining } from "~/api/mutations/live-training/useUpdateLiveTraining";
import { LIVE_TRAINING_QUERY_KEY } from "~/api/queries/live-training/useLiveTraining";
import { useLiveTrainingSuspense } from "~/api/queries/live-training/useLiveTrainingSuspense";
import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { useLiveKitConfigured } from "~/api/queries/useLiveKitConfigured";
import { usePublicGlobalSettingsSuspense } from "~/api/queries/usePublicGlobalSettingsSuspense";
import { acquireSocket, releaseSocket } from "~/api/socket";
import { invalidateLiveTrainingData } from "~/api/utils/invalidateLiveTrainingData";
import { PageWrapper } from "~/components/PageWrapper";
import { Skeleton } from "~/components/ui/skeleton";
import { useToast } from "~/components/ui/use-toast";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingDeleteDialog } from "~/modules/LiveTraining/components/LiveTrainingDeleteDialog";
import { LiveTrainingRoom } from "~/modules/LiveTraining/components/LiveTrainingMeeting/LiveTrainingRoom";
import { LiveTrainingSessionStage } from "~/modules/LiveTraining/components/LiveTrainingSessionStage";
import { LiveTrainingWorkspace } from "~/modules/LiveTraining/components/LiveTrainingWorkspace";
import { canReadLiveTrainingPage } from "~/modules/LiveTraining/utils/liveTrainingAccess";
import { deriveLiveTrainingUiActions } from "~/modules/LiveTraining/utils/liveTrainingActions";
import {
  buildLiveTrainingEditFormState,
  buildUpdateLiveTrainingPayload,
  isLiveTrainingEditFormDirty,
  isLiveTrainingEditFormValid,
} from "~/modules/LiveTraining/utils/liveTrainingEditForm";

import { LIVE_TRAINING_HANDLES } from "../../../e2e/data/live-training/handles";

import { LiveTrainingErrorBoundary } from "./components/LiveTrainingErrorBoundary";

import type { JoinCurrentSessionResponse } from "~/api/generated-api";
import type { LiveTrainingEditFormState } from "~/modules/LiveTraining/liveTrainingEdit.types";

const LIVE_TRAINING_SESSION_SOCKET_EVENT = "live-training:session";
const SESSION_ENDED_TOAST_DURATION_MS = 15000;
const REFRESHING_SESSION_STATUSES = new Set<string>([
  LIVE_TRAINING_SESSION_STATUSES.WAITING,
  LIVE_TRAINING_SESSION_STATUSES.ACTIVE,
  LIVE_TRAINING_SESSION_STATUSES.ENDED,
  LIVE_TRAINING_SESSION_STATUSES.FAILED,
]);

type LiveTrainingSessionSocketPayload = {
  liveTrainingId: string;
  sessionId: string;
  eventName: string;
};

function LiveTrainingPageSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-40 rounded-lg" />
      <Skeleton className="h-80 rounded-lg" />
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}

export default function LiveTrainingPage() {
  return (
    <RequireAuthenticatedUser>
      <LiveTrainingAccess />
    </RequireAuthenticatedUser>
  );
}

function LiveTrainingAccess() {
  const { id } = useParams();
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUserSuspense();
  const { data: globalSettings } = usePublicGlobalSettingsSuspense();

  if (
    !canReadLiveTrainingPage(currentUser.permissions, Boolean(globalSettings?.liveTrainingEnabled))
  ) {
    return <Navigate to="/" replace />;
  }

  if (!id) return <Navigate to="/calendar" replace />;

  return (
    <LiveTrainingErrorBoundary
      key={`${id}:${language}`}
      queryKey={[...LIVE_TRAINING_QUERY_KEY, id, language]}
    >
      <Suspense fallback={<LiveTrainingPageSkeleton />}>
        <LiveTrainingContent id={id} />
      </Suspense>
    </LiveTrainingErrorBoundary>
  );
}

function LiveTrainingContent({ id }: { id: string }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editFormState, setEditFormState] = useState<LiveTrainingEditFormState | null>(null);
  const [hasAttemptedRoomJoin, setHasAttemptedRoomJoin] = useState(false);
  const [meetingCredentials, setMeetingCredentials] = useState<
    JoinCurrentSessionResponse["data"] | null
  >(null);
  const language = useLanguageStore((state) => state.language);
  const { data: currentUser } = useCurrentUserSuspense();
  const { data: liveTraining, refetch: refetchLiveTraining } = useLiveTrainingSuspense(
    id,
    language,
  );
  const { data: liveKitConfigured } = useLiveKitConfigured();
  const isOnlineDeliveryAvailable = Boolean(liveKitConfigured?.enabled);
  const { mutateAsync: deleteLiveTraining, isPending: isDeleting } = useDeleteLiveTraining();
  const { mutateAsync: updateLiveTraining, isPending: isUpdating } = useUpdateLiveTraining();
  const { mutateAsync: startSession, isPending: isStartingSession } = useStartLiveTrainingSession();
  const { mutateAsync: joinSession, isPending: isJoiningSession } = useJoinLiveTrainingSession();
  const { mutateAsync: endSession, isPending: isFinishingSession } = useEndLiveTrainingSession();
  const isRoomRoute = location.pathname.endsWith("/room");

  const actions = useMemo(
    () =>
      liveTraining
        ? deriveLiveTrainingUiActions({
            liveTraining,
            currentUserId: currentUser.id,
            permissions: currentUser.permissions,
          })
        : null,
    [currentUser.id, currentUser.permissions, liveTraining],
  );
  const visibleActions = useMemo(
    () =>
      liveTraining && actions
        ? {
            ...actions,
            canShowStart:
              actions.canShowStart &&
              (isOnlineDeliveryAvailable ||
                liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE),
            canShowJoin: actions.canShowJoin && isOnlineDeliveryAvailable,
          }
        : null,
    [actions, isOnlineDeliveryAvailable, liveTraining],
  );

  useEffect(() => {
    if (!liveTraining) return;

    setEditFormState(buildLiveTrainingEditFormState(liveTraining));
  }, [language, liveTraining]);

  useEffect(() => {
    setHasAttemptedRoomJoin(false);
    setMeetingCredentials(null);
  }, [id, isRoomRoute]);

  const updateEditFormState = <Key extends keyof LiveTrainingEditFormState>(
    key: Key,
    value: LiveTrainingEditFormState[Key],
  ) => {
    setEditFormState((current) => {
      if (!current) return current;

      return { ...current, [key]: value };
    });
  };

  const commitEditFormState = async (nextFormState: LiveTrainingEditFormState) => {
    setEditFormState(nextFormState);

    if (!id || !liveTraining || isUpdating) return;
    if (!isLiveTrainingEditFormDirty(liveTraining, nextFormState)) return;
    if (!isLiveTrainingEditFormValid(nextFormState)) return;

    await updateLiveTraining({
      id,
      data: buildUpdateLiveTrainingPayload(nextFormState, liveTraining.timezone, language),
    });
  };

  const handleDeleteLiveTraining = async () => {
    if (!id) return;

    await deleteLiveTraining({ id });
    setIsDeleteDialogOpen(false);
    navigate("/calendar");
  };

  const handleStartSession = useCallback(async () => {
    if (!id) return;

    await startSession({ liveTrainingId: id, language });
    await refetchLiveTraining();
  }, [id, language, refetchLiveTraining, startSession]);

  const handleJoinSession = useCallback(async () => {
    if (!id) return;

    if (!isRoomRoute) {
      navigate(`/live-training/${id}/room`);
      return;
    }

    const credentials = await joinSession({ liveTrainingId: id, language });
    setMeetingCredentials(credentials);
  }, [id, isRoomRoute, joinSession, language, navigate]);

  const handleFinishSession = useCallback(async () => {
    if (!id || !liveTraining?.currentSession?.id) return;

    await endSession({
      liveTrainingId: id,
      sessionId: liveTraining.currentSession.id,
      language,
    });
    setMeetingCredentials(null);
    if (isRoomRoute) {
      navigate(`/live-training/${id}`);
    }
  }, [endSession, id, isRoomRoute, language, liveTraining?.currentSession?.id, navigate]);

  const handleLeaveSession = useCallback(
    ({ userInitiated }: { userInitiated: boolean }) => {
      if (!userInitiated) {
        void invalidateLiveTrainingData({
          includeCalendar: true,
          includeCoursesAndLessons: true,
          includeSessions: true,
        });
      }

      const shouldShowEndedToast =
        !userInitiated && meetingCredentials?.role === LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;

      if (shouldShowEndedToast && liveTraining) {
        toast({
          description: t("liveTrainingView.meeting.sessionEndedToast", {
            trainingName: liveTraining.title,
          }),
          duration: SESSION_ENDED_TOAST_DURATION_MS,
        });
      }

      setMeetingCredentials(null);
      if (id && isRoomRoute) {
        navigate(`/live-training/${id}`);
      }
    },
    [id, isRoomRoute, liveTraining, meetingCredentials?.role, navigate, t, toast],
  );

  const handleRemoteSessionEnded = useCallback(async () => {
    await invalidateLiveTrainingData({
      includeCalendar: true,
      includeCoursesAndLessons: true,
      includeSessions: true,
    });

    if (meetingCredentials?.role === LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER && liveTraining) {
      toast({
        description: t("liveTrainingView.meeting.sessionEndedToast", {
          trainingName: liveTraining.title,
        }),
        duration: SESSION_ENDED_TOAST_DURATION_MS,
      });
    }

    setMeetingCredentials(null);

    if (id && isRoomRoute) {
      navigate(`/live-training/${id}`);
    }
  }, [id, isRoomRoute, liveTraining, meetingCredentials?.role, navigate, t, toast]);

  useEffect(() => {
    if (!id) return;

    const socket = acquireSocket();

    const joinRoom = () => {
      socket.emit("join:live-training", { liveTrainingId: id });
    };

    const handleSessionEvent = (payload: LiveTrainingSessionSocketPayload) => {
      if (payload.liveTrainingId !== id) return;

      if (REFRESHING_SESSION_STATUSES.has(payload.eventName)) {
        void invalidateLiveTrainingData({
          includeCalendar: true,
          includeCoursesAndLessons: true,
          includeSessions: true,
        });
      }

      if (payload.eventName === LIVE_TRAINING_SESSION_STATUSES.ENDED) {
        void handleRemoteSessionEnded();
      }
    };

    socket.on("connect", joinRoom);
    socket.on(LIVE_TRAINING_SESSION_SOCKET_EVENT, handleSessionEvent);
    socket.connect();

    if (socket.connected) {
      joinRoom();
    }

    return () => {
      socket.off("connect", joinRoom);
      socket.off(LIVE_TRAINING_SESSION_SOCKET_EVENT, handleSessionEvent);

      if (socket.connected) {
        socket.emit("leave:live-training", { liveTrainingId: id });
      }

      releaseSocket();
    };
  }, [handleRemoteSessionEnded, id]);

  useEffect(() => {
    if (!isRoomRoute || hasAttemptedRoomJoin || meetingCredentials) return;
    if (!id || !liveTraining || !visibleActions) return;

    if (!visibleActions.canShowJoin) {
      navigate(`/live-training/${id}`, { replace: true });
      return;
    }

    setHasAttemptedRoomJoin(true);
    void joinSession({ liveTrainingId: id, language })
      .then(setMeetingCredentials)
      .catch(() => navigate(`/live-training/${id}`, { replace: true }));
  }, [
    hasAttemptedRoomJoin,
    id,
    isRoomRoute,
    joinSession,
    language,
    liveTraining,
    meetingCredentials,
    navigate,
    visibleActions,
  ]);

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("calendarView.title"), href: "/calendar" },
        { title: t("liveTrainingView.title"), href: `/live-training/${id ?? ""}` },
      ]}
      data-testid={LIVE_TRAINING_HANDLES.PAGE}
    >
      {liveTraining && visibleActions && (
        <div className="grid gap-5">
          <LiveTrainingSessionStage
            liveTraining={liveTraining}
            actions={visibleActions}
            editFormState={editFormState}
            isStartingSession={isStartingSession}
            isJoiningSession={isJoiningSession}
            isFinishingSession={isFinishingSession}
            isOnlineDeliveryAvailable={isOnlineDeliveryAvailable}
            onDeleteClick={() => setIsDeleteDialogOpen(true)}
            onStartSession={handleStartSession}
            onJoinSession={handleJoinSession}
            onFinishSession={handleFinishSession}
            onEditFormStateCommit={commitEditFormState}
            onEditFormStateChange={updateEditFormState}
          />
          <LiveTrainingWorkspace liveTraining={liveTraining} actions={visibleActions} />
          <LiveTrainingDeleteDialog
            open={isDeleteDialogOpen}
            isDeleting={isDeleting}
            linkedLessonCount={liveTraining.linkedLessonCount}
            onOpenChange={setIsDeleteDialogOpen}
            onConfirm={handleDeleteLiveTraining}
          />
        </div>
      )}
      {meetingCredentials && liveTraining && visibleActions && (
        <LiveTrainingRoom
          credentials={meetingCredentials}
          liveTraining={liveTraining}
          canViewAllMaterials={visibleActions.canViewAllMaterials}
          isFinishingSession={isFinishingSession}
          onFinishSession={handleFinishSession}
          onLeave={handleLeaveSession}
        />
      )}
    </PageWrapper>
  );
}
