import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_PARTICIPANT_ROLES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
} from "@repo/shared";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useJoinLiveTrainingSession } from "~/api/mutations/live-training/useJoinLiveTrainingSession";
import { useOpenLiveTrainingResource } from "~/api/mutations/live-training/useOpenLiveTrainingResource";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useToast } from "~/components/ui/use-toast";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingRoom } from "~/modules/LiveTraining/components/LiveTrainingMeeting/LiveTrainingRoom";
import { LIVE_TRAINING_FILE_TABS } from "~/modules/LiveTraining/liveTraining.types";
import { formatLiveTrainingDateRange } from "~/modules/LiveTraining/utils/liveTrainingFormat";

import { LIVE_TRAINING_LESSON_HANDLES } from "../../../../../e2e/data/live-training/handles";

import { LiveTrainingMaterialList } from "./LiveTrainingMaterialList";
import { LiveTrainingStatusPreview } from "./LiveTrainingStatusPreview";

import type { LiveTrainingMaterial } from "./LiveTrainingLesson.types";
import type { GetLessonByIdResponse, JoinCurrentSessionResponse } from "~/api/generated-api";

type LiveTrainingLessonProps = {
  lesson: GetLessonByIdResponse["data"];
};

export function LiveTrainingLesson({ lesson }: LiveTrainingLessonProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const language = useLanguageStore((state) => state.language);
  const liveTraining = lesson.liveTraining;
  const [meetingCredentials, setMeetingCredentials] = useState<
    JoinCurrentSessionResponse["data"] | null
  >(null);
  const { mutateAsync: joinSession, isPending: isJoining } = useJoinLiveTrainingSession();
  const { mutate: openResource } = useOpenLiveTrainingResource();

  if (!liveTraining) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-6 text-sm text-neutral-600">
        {t("studentLessonView.liveTraining.notAvailable")}
      </div>
    );
  }

  const currentSession = liveTraining.currentSession;
  const hasActiveSession =
    currentSession?.status === LIVE_TRAINING_SESSION_STATUSES.WAITING ||
    currentSession?.status === LIVE_TRAINING_SESSION_STATUSES.ACTIVE;
  const canJoin =
    liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.ONLINE && hasActiveSession;
  const isAfterTabLocked =
    liveTraining.status !== LIVE_TRAINING_STATUSES.ENDED &&
    liveTraining.materials.after.length === 0;
  const afterFilesEmptyMessage =
    liveTraining.status === LIVE_TRAINING_STATUSES.ENDED
      ? t("liveTrainingView.meeting.noMaterials")
      : t("liveTrainingView.files.afterLocked");
  const scheduleLabel = formatLiveTrainingDateRange(
    liveTraining.startsAt,
    liveTraining.endsAt,
    liveTraining.allDay,
    language,
  );

  const handleJoin = async () => {
    const credentials = await joinSession({ liveTrainingId: liveTraining.id, language });
    setMeetingCredentials(credentials);
  };

  const handleOpenMaterial = (material: LiveTrainingMaterial) => {
    openResource({
      liveTrainingId: liveTraining.id,
      resourceId: material.resourceId,
      language,
      filename: material.title,
    });
  };

  const handleLeaveSession = ({ userInitiated }: { userInitiated: boolean }) => {
    const shouldShowEndedToast =
      !userInitiated && meetingCredentials?.role === LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;

    if (shouldShowEndedToast) {
      toast({
        description: t("liveTrainingView.meeting.sessionEndedToast", {
          trainingName: liveTraining.title,
        }),
        duration: Number.MAX_SAFE_INTEGER,
      });
    }

    setMeetingCredentials(null);
  };

  return (
    <div className="grid gap-4" data-testid={LIVE_TRAINING_LESSON_HANDLES.ROOT}>
      <LiveTrainingStatusPreview
        liveTraining={liveTraining}
        scheduleLabel={scheduleLabel}
        canJoin={canJoin}
        isJoining={isJoining}
        onJoin={handleJoin}
      />

      <Tabs defaultValue={LIVE_TRAINING_FILE_TABS.BEFORE} className="grid gap-4">
        <TabsList className="h-auto w-fit bg-neutral-100 p-1">
          <TabsTrigger
            value={LIVE_TRAINING_FILE_TABS.BEFORE}
            data-testid={LIVE_TRAINING_LESSON_HANDLES.BEFORE_FILES_TAB}
          >
            {t("liveTrainingView.files.beforeHeading")}
          </TabsTrigger>
          <TabsTrigger
            value={LIVE_TRAINING_FILE_TABS.AFTER}
            disabled={isAfterTabLocked}
            data-testid={LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_TAB}
          >
            {t("liveTrainingView.files.afterHeading")}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value={LIVE_TRAINING_FILE_TABS.BEFORE}
          data-testid={LIVE_TRAINING_LESSON_HANDLES.BEFORE_FILES_PANEL}
        >
          <LiveTrainingMaterialList
            materials={liveTraining.materials.before}
            emptyMessage={t("liveTrainingView.meeting.noMaterials")}
            materialCardTestId={LIVE_TRAINING_LESSON_HANDLES.beforeFileCard}
            onOpen={handleOpenMaterial}
          />
        </TabsContent>

        <TabsContent
          value={LIVE_TRAINING_FILE_TABS.AFTER}
          data-testid={LIVE_TRAINING_LESSON_HANDLES.AFTER_FILES_PANEL}
        >
          <LiveTrainingMaterialList
            materials={liveTraining.materials.after}
            emptyMessage={afterFilesEmptyMessage}
            materialCardTestId={LIVE_TRAINING_LESSON_HANDLES.afterFileCard}
            onOpen={handleOpenMaterial}
          />
        </TabsContent>
      </Tabs>

      {meetingCredentials && (
        <LiveTrainingRoom
          credentials={meetingCredentials}
          liveTraining={liveTraining}
          canViewAllMaterials={false}
          isFinishingSession={false}
          onFinishSession={async () => undefined}
          onLeave={handleLeaveSession}
        />
      )}
    </div>
  );
}
