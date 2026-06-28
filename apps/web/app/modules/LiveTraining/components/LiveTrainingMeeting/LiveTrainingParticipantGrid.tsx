import { useRoomContext, useSpeakingParticipants, useTracks } from "@livekit/components-react";
import { LIVE_TRAINING_PARTICIPANT_ROLES } from "@repo/shared";
import { RoomEvent, Track } from "livekit-client";
import { Users } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLiveTrainingParticipantProfilePictures } from "~/api/queries/live-training/useLiveTrainingParticipantProfilePictures";
import { cn } from "~/lib/utils";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LiveTrainingParticipantTile } from "./LiveTrainingParticipantTile";

import type { LiveTrainingParticipantGridProps } from "./LiveTrainingMeeting.types";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import type { Transition } from "motion/react";
import type { CSSProperties } from "react";

type LiveTrainingParticipantMetadata = {
  role?: string;
  userId?: string;
};

type LiveTrainingTrackEntry = {
  key: string;
  trackRef: TrackReferenceOrPlaceholder;
  participantName: string;
  participantRole: string | null;
  userId?: string;
  profilePictureUrl?: string | null;
  isHost: boolean;
  isScreenShare: boolean;
  sortOrder: number;
};

const getParticipantMetadata = (metadata?: string): LiveTrainingParticipantMetadata => {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata) as LiveTrainingParticipantMetadata;
  } catch {
    return {};
  }
};

const getParticipantUserId = (trackRef: TrackReferenceOrPlaceholder) => {
  const attributesUserId = trackRef.participant.attributes.userId;

  if (attributesUserId) {
    return attributesUserId;
  }

  return getParticipantMetadata(trackRef.participant.metadata).userId;
};

const getParticipantRole = (trackRef: TrackReferenceOrPlaceholder) => {
  const attributesRole = trackRef.participant.attributes.role;

  if (attributesRole) {
    return attributesRole;
  }

  const metadataRole = getParticipantMetadata(trackRef.participant.metadata).role;

  return typeof metadataRole === "string" ? metadataRole : null;
};

const isHostRole = (role: string | null | undefined) =>
  role === LIVE_TRAINING_PARTICIPANT_ROLES.HOST || role === LIVE_TRAINING_PARTICIPANT_ROLES.ADMIN;

const getTrackEntryKey = (trackRef: TrackReferenceOrPlaceholder) =>
  `${trackRef.participant.identity}-${trackRef.source}`;

const getTrackEntryLayoutId = (trackKey: string) => `live-training-track-${trackKey}`;

const getTrackEntryPriority = (entry: LiveTrainingTrackEntry) => {
  if (entry.isScreenShare) return 0;
  if (entry.isHost) return 1;

  return 2;
};

const compareTrackEntries = (first: LiveTrainingTrackEntry, second: LiveTrainingTrackEntry) => {
  const firstPriority = getTrackEntryPriority(first);
  const secondPriority = getTrackEntryPriority(second);

  if (firstPriority !== secondPriority) return firstPriority - secondPriority;
  if (first.sortOrder !== second.sortOrder) return first.sortOrder - second.sortOrder;

  return first.key.localeCompare(second.key);
};

const getDesiredGridColumns = (trackCount: number) => {
  if (trackCount <= 0) return 1;
  if (trackCount <= 3) return trackCount;
  if (trackCount <= 4) return 2;
  if (trackCount <= 6) return 3;
  if (trackCount <= 8) return 4;

  return Math.min(5, Math.ceil(Math.sqrt(trackCount)));
};

const layoutTransition: Transition = {
  duration: 0.32,
  ease: [0.22, 1, 0.36, 1],
};

const stageSwapTransition: Transition = {
  duration: 0.52,
  ease: [0.22, 1, 0.36, 1],
};

const stageSwapIntoStageTransition: Transition = {
  ...stageSwapTransition,
  delay: 0.08,
};

const stageSwapIntoRailTransition: Transition = {
  ...stageSwapTransition,
  delay: 0,
};

export function LiveTrainingParticipantGrid({
  liveTrainingId,
  onTrackSelect,
}: LiveTrainingParticipantGridProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const room = useRoomContext();
  const [selectedStageTrackKey, setSelectedStageTrackKey] = useState<string | null>(null);
  const sortOrderByTrackKeyRef = useRef(new Map<string, number>());
  const participantRoleByIdentityRef = useRef(new Map<string, string>());
  const nextSortOrderRef = useRef(0);
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const activeSpeakers = useSpeakingParticipants();
  const activeSpeakerIdentities = useMemo(
    () => new Set(activeSpeakers.map((participant) => participant.identity)),
    [activeSpeakers],
  );
  const participantUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          tracks
            .map((trackRef) => getParticipantUserId(trackRef))
            .filter((userId): userId is string => Boolean(userId)),
        ),
      ).sort(),
    [tracks],
  );
  const participantUserIdsKey = participantUserIds.join(":");
  const { data: profilePictures = [], refetch: refetchProfilePictures } =
    useLiveTrainingParticipantProfilePictures(liveTrainingId, participantUserIds, language, {
      enabled: tracks.length > 0,
    });
  const profilePictureByUserId = useMemo(
    () =>
      new Map(
        profilePictures.map((profilePicture) => [
          profilePicture.userId,
          profilePicture.profilePictureUrl,
        ]),
      ),
    [profilePictures],
  );
  const getStableTrackOrder = useCallback((trackKey: string) => {
    const existingOrder = sortOrderByTrackKeyRef.current.get(trackKey);

    if (existingOrder !== undefined) {
      return existingOrder;
    }

    const nextOrder = nextSortOrderRef.current;
    nextSortOrderRef.current += 1;
    sortOrderByTrackKeyRef.current.set(trackKey, nextOrder);

    return nextOrder;
  }, []);
  const getStableParticipantRole = useCallback((trackRef: TrackReferenceOrPlaceholder) => {
    const participantIdentity = trackRef.participant.identity;
    const participantRole = getParticipantRole(trackRef);

    if (participantRole) {
      participantRoleByIdentityRef.current.set(participantIdentity, participantRole);

      return participantRole;
    }

    return participantRoleByIdentityRef.current.get(participantIdentity) ?? null;
  }, []);
  const orderedTrackEntries = useMemo<LiveTrainingTrackEntry[]>(() => {
    return tracks
      .map((trackRef) => {
        const key = getTrackEntryKey(trackRef);
        const participantRole = getStableParticipantRole(trackRef);
        const userId = getParticipantUserId(trackRef);

        return {
          key,
          trackRef,
          participantName: trackRef.participant.name || trackRef.participant.identity,
          participantRole,
          userId,
          profilePictureUrl: profilePictureByUserId.get(userId ?? ""),
          isHost: isHostRole(participantRole),
          isScreenShare: trackRef.source === Track.Source.ScreenShare,
          sortOrder: getStableTrackOrder(key),
        };
      })
      .sort(compareTrackEntries);
  }, [getStableParticipantRole, getStableTrackOrder, profilePictureByUserId, tracks]);
  const screenShareEntries = useMemo(
    () => orderedTrackEntries.filter((entry) => entry.isScreenShare),
    [orderedTrackEntries],
  );
  const participantEntries = useMemo(
    () => orderedTrackEntries.filter((entry) => !entry.isScreenShare),
    [orderedTrackEntries],
  );
  const defaultStageEntry = screenShareEntries[0] ?? null;
  const selectedStageEntry =
    screenShareEntries.find((entry) => entry.key === selectedStageTrackKey) ?? defaultStageEntry;
  const railEntries = selectedStageEntry
    ? [
        ...screenShareEntries.filter((entry) => entry.key !== selectedStageEntry.key),
        ...participantEntries,
      ]
    : [];
  const participantGridStyle = {
    "--participant-grid-columns": getDesiredGridColumns(participantEntries.length),
    "--participant-grid-mobile-columns": Math.min(2, Math.max(1, participantEntries.length)),
  } as CSSProperties;

  useEffect(() => {
    if (tracks.length === 0) return;

    void refetchProfilePictures();
  }, [participantUserIdsKey, refetchProfilePictures, tracks.length]);

  useEffect(() => {
    const refreshProfilePictures = () => {
      void refetchProfilePictures();
    };

    room
      .on(RoomEvent.ParticipantConnected, refreshProfilePictures)
      .on(RoomEvent.ParticipantDisconnected, refreshProfilePictures)
      .on(RoomEvent.ParticipantMetadataChanged, refreshProfilePictures)
      .on(RoomEvent.ParticipantAttributesChanged, refreshProfilePictures);

    return () => {
      room
        .off(RoomEvent.ParticipantConnected, refreshProfilePictures)
        .off(RoomEvent.ParticipantDisconnected, refreshProfilePictures)
        .off(RoomEvent.ParticipantMetadataChanged, refreshProfilePictures)
        .off(RoomEvent.ParticipantAttributesChanged, refreshProfilePictures);
    };
  }, [refetchProfilePictures, room]);

  if (tracks.length === 0) {
    return (
      <div className="flex size-full min-h-[20rem] items-center justify-center rounded-md bg-white/[0.03] text-white/70 lg:min-h-0">
        <div className="grid justify-items-center gap-2 text-center">
          <Users className="size-8 text-white/35" />
          <p className="text-sm">{t("liveTrainingView.meeting.empty")}</p>
        </div>
      </div>
    );
  }

  if (selectedStageEntry) {
    return (
      <motion.div
        layout
        className="grid size-full min-h-0 min-w-0 gap-3 overflow-hidden min-[760px]:grid-cols-[minmax(0,1fr)_minmax(14rem,18rem)] xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]"
      >
        <motion.div
          layout
          layoutId={getTrackEntryLayoutId(selectedStageEntry.key)}
          key={selectedStageEntry.key}
          className="flex min-h-0 min-w-0 items-center justify-center"
          transition={stageSwapIntoStageTransition}
        >
          <LiveTrainingParticipantTile
            isMainStage
            isSpeaking={activeSpeakerIdentities.has(
              selectedStageEntry.trackRef.participant.identity,
            )}
            onClick={() =>
              onTrackSelect(
                selectedStageEntry.trackRef,
                selectedStageEntry.profilePictureUrl,
                getTrackEntryLayoutId(selectedStageEntry.key),
              )
            }
            profilePictureUrl={selectedStageEntry.profilePictureUrl}
            trackRef={selectedStageEntry.trackRef}
            variant="stage"
          />
        </motion.div>
        <motion.div layout className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
          <motion.div
            layout
            className="grid min-w-0 grid-cols-2 content-start gap-3 pb-1 min-[760px]:grid-cols-1 min-[760px]:pb-0"
          >
            {railEntries.map((entry) => (
              <motion.div
                layout
                layoutId={getTrackEntryLayoutId(entry.key)}
                key={entry.key}
                className="w-full min-w-0"
                transition={stageSwapIntoRailTransition}
              >
                <LiveTrainingParticipantTile
                  isSpeaking={activeSpeakerIdentities.has(entry.trackRef.participant.identity)}
                  onClick={() =>
                    onTrackSelect(
                      entry.trackRef,
                      entry.profilePictureUrl,
                      getTrackEntryLayoutId(entry.key),
                    )
                  }
                  onPresentOnStage={
                    entry.isScreenShare ? () => setSelectedStageTrackKey(entry.key) : undefined
                  }
                  profilePictureUrl={entry.profilePictureUrl}
                  trackRef={entry.trackRef}
                  variant="rail"
                />
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <div className="flex size-full min-h-0 min-w-0 overflow-x-hidden overflow-y-auto">
      <motion.div
        layout
        className="grid min-h-full w-full min-w-0 items-center justify-center gap-3 [align-content:safe_center] [grid-template-columns:repeat(var(--participant-grid-mobile-columns),minmax(0,1fr))] lg:[grid-template-columns:repeat(var(--participant-grid-columns),minmax(0,1fr))]"
        style={participantGridStyle}
      >
        {participantEntries.map((entry) => (
          <motion.div
            layout
            layoutId={getTrackEntryLayoutId(entry.key)}
            key={entry.key}
            className={cn("aspect-[16/10] min-h-0 w-full min-w-0 justify-self-center", {
              "max-w-[min(100%,calc(160dvh_-_19.2rem))]": participantEntries.length === 1,
            })}
            transition={layoutTransition}
          >
            <LiveTrainingParticipantTile
              isSpeaking={activeSpeakerIdentities.has(entry.trackRef.participant.identity)}
              onClick={() =>
                onTrackSelect(
                  entry.trackRef,
                  entry.profilePictureUrl,
                  getTrackEntryLayoutId(entry.key),
                )
              }
              profilePictureUrl={entry.profilePictureUrl}
              trackRef={entry.trackRef}
            />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
