import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
} from "@repo/shared";
import { CalendarClock, CheckCircle2, Download, FileText, Play, Video } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useJoinLiveTrainingSession } from "~/api/mutations/live-training/useJoinLiveTrainingSession";
import { useOpenLiveTrainingResource } from "~/api/mutations/live-training/useOpenLiveTrainingResource";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { LiveTrainingRoom } from "~/modules/LiveTraining/components/LiveTrainingMeeting/LiveTrainingRoom";
import { LIVE_TRAINING_FILE_TABS } from "~/modules/LiveTraining/liveTraining.types";
import { formatLiveTrainingDateRange } from "~/modules/LiveTraining/utils/liveTrainingFormat";
import { getReadableFileTypeLabel } from "~/utils/fileDisplay";

import type { GetLessonByIdResponse, JoinCurrentSessionResponse } from "~/api/generated-api";

type LiveTrainingLessonProps = {
  lesson: GetLessonByIdResponse["data"];
};

type LiveTrainingDetails = NonNullable<GetLessonByIdResponse["data"]["liveTraining"]>;
type LiveTrainingMaterial = LiveTrainingDetails["materials"]["before"][number];

type LiveTrainingMaterialListProps = {
  materials: LiveTrainingMaterial[];
  emptyMessage: string;
  onOpen: (material: LiveTrainingMaterial) => void;
};

type LiveTrainingStatusPreviewProps = {
  liveTraining: LiveTrainingDetails;
  scheduleLabel: string;
  canJoin: boolean;
  isJoining: boolean;
  onJoin: () => void;
};

function LiveTrainingMaterialList({
  materials,
  emptyMessage,
  onOpen,
}: LiveTrainingMaterialListProps) {
  const { t } = useTranslation();

  if (materials.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
      {materials.map((material) => (
        <div
          key={material.resourceId}
          className="flex min-w-0 flex-col justify-between rounded-md border border-neutral-200 bg-white p-3 shadow-sm"
        >
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-neutral-100 text-neutral-600">
                <FileText className="size-4" />
              </span>
              <Badge variant="outline" fontWeight="normal" className="rounded px-2 py-0.5 text-xs">
                {getReadableFileTypeLabel(material.contentType)}
              </Badge>
            </div>
            <p className="truncate text-sm font-medium text-neutral-950" title={material.title}>
              {material.title}
            </p>
          </div>

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded px-2 text-xs text-neutral-600 hover:text-primary-700"
              aria-label={t("liveTrainingView.files.download")}
              onClick={() => onOpen(material)}
            >
              <Download className="size-3.5" />
              {t("liveTrainingView.files.download")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function LiveTrainingStatusPreview({
  liveTraining,
  scheduleLabel,
  canJoin,
  isJoining,
  onJoin,
}: LiveTrainingStatusPreviewProps) {
  const { t } = useTranslation();
  const isEnded = liveTraining.status === LIVE_TRAINING_STATUSES.ENDED;
  const isScheduled = liveTraining.status === LIVE_TRAINING_STATUSES.SCHEDULED;

  if (canJoin) {
    return (
      <section className="overflow-hidden rounded-md border border-primary-100 bg-white shadow-sm">
        <div className="relative bg-primary-950 p-4 text-white">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--primary-800),var(--primary-950)_55%,var(--primary-900))]" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/10">
                <Video className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-white/50">
                  {t("studentLessonView.liveTraining.activeLabel")}
                </p>
                <h2 className="text-base font-semibold text-white">
                  {t("studentLessonView.liveTraining.activeTitle")}
                </h2>
                <p className="mt-1 truncate text-sm text-white/65">{scheduleLabel}</p>
              </div>
            </div>

            <Button
              type="button"
              className="h-9 gap-2 rounded bg-white text-primary-950 hover:bg-white/90"
              disabled={isJoining}
              onClick={onJoin}
            >
              <Play className="size-4" />
              {t("liveTrainingView.actions.join")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (isEnded) {
    return (
      <section className="rounded-md border border-neutral-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-success-50 text-success-700">
            <CheckCircle2 className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t("studentLessonView.liveTraining.endedLabel")}
            </p>
            <h2 className="text-base font-semibold text-neutral-950">
              {t("studentLessonView.liveTraining.endedTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
          </div>
        </div>
      </section>
    );
  }

  if (isScheduled) {
    return (
      <section className="rounded-md border border-primary-100 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary-700">
            <CalendarClock className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              {t("studentLessonView.liveTraining.scheduledLabel")}
            </p>
            <h2 className="text-base font-semibold text-neutral-950">
              {t("studentLessonView.liveTraining.scheduledTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white text-neutral-500">
          <Video className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            {t("studentLessonView.liveTraining.inactiveLabel")}
          </p>
          <h2 className="text-base font-semibold text-neutral-950">
            {t("studentLessonView.liveTraining.inactiveTitle")}
          </h2>
          <p className="mt-1 text-sm text-neutral-600">{scheduleLabel}</p>
        </div>
      </div>
    </section>
  );
}

export function LiveTrainingLesson({ lesson }: LiveTrainingLessonProps) {
  const { t } = useTranslation();
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

  return (
    <div className="grid gap-4">
      <LiveTrainingStatusPreview
        liveTraining={liveTraining}
        scheduleLabel={scheduleLabel}
        canJoin={canJoin}
        isJoining={isJoining}
        onJoin={handleJoin}
      />

      <Tabs defaultValue={LIVE_TRAINING_FILE_TABS.BEFORE} className="grid gap-4">
        <TabsList className="h-auto w-fit bg-neutral-100 p-1">
          <TabsTrigger value={LIVE_TRAINING_FILE_TABS.BEFORE}>
            {t("liveTrainingView.files.beforeHeading")}
          </TabsTrigger>
          <TabsTrigger value={LIVE_TRAINING_FILE_TABS.AFTER} disabled={isAfterTabLocked}>
            {t("liveTrainingView.files.afterHeading")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={LIVE_TRAINING_FILE_TABS.BEFORE}>
          <LiveTrainingMaterialList
            materials={liveTraining.materials.before}
            emptyMessage={t("liveTrainingView.meeting.noMaterials")}
            onOpen={handleOpenMaterial}
          />
        </TabsContent>

        <TabsContent value={LIVE_TRAINING_FILE_TABS.AFTER}>
          <LiveTrainingMaterialList
            materials={liveTraining.materials.after}
            emptyMessage={afterFilesEmptyMessage}
            onOpen={handleOpenMaterial}
          />
        </TabsContent>
      </Tabs>

      {meetingCredentials && (
        <LiveTrainingRoom
          credentials={meetingCredentials}
          liveTraining={liveTraining}
          canViewAllMaterials={false}
          onLeave={() => setMeetingCredentials(null)}
        />
      )}
    </div>
  );
}
