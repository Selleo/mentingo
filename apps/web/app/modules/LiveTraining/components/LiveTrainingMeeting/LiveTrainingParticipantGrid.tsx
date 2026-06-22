import { useSpeakingParticipants, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Users } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useLiveTrainingParticipantProfilePictures } from "~/api/queries/live-training/useLiveTrainingParticipantProfilePictures";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { LiveTrainingParticipantTile } from "./LiveTrainingParticipantTile";

import type { LiveTrainingParticipantGridProps } from "./LiveTrainingMeeting.types";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";

type LiveTrainingParticipantMetadata = {
  userId?: string;
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

const isFocusedSpeakerCameraTrack = (
  trackRef: TrackReferenceOrPlaceholder,
  focusedSpeakerIdentity?: string,
) =>
  trackRef.participant.identity === focusedSpeakerIdentity &&
  trackRef.source === Track.Source.Camera;

export function LiveTrainingParticipantGrid({
  hasPinnedTrack,
  liveTrainingId,
  onTrackSelect,
}: LiveTrainingParticipantGridProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
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
  const focusedSpeakerIdentity = hasPinnedTrack ? undefined : activeSpeakers[0]?.identity;
  const sortedTracks = useMemo(() => {
    if (!focusedSpeakerIdentity) return tracks;

    return [...tracks].sort((trackA, trackB) => {
      const trackAFocusScore = isFocusedSpeakerCameraTrack(trackA, focusedSpeakerIdentity) ? 1 : 0;
      const trackBFocusScore = isFocusedSpeakerCameraTrack(trackB, focusedSpeakerIdentity) ? 1 : 0;

      return trackBFocusScore - trackAFocusScore;
    });
  }, [focusedSpeakerIdentity, tracks]);
  const participantUserIds = useMemo(
    () =>
      Array.from(
        new Set(
          sortedTracks
            .map((trackRef) => getParticipantUserId(trackRef))
            .filter((userId): userId is string => Boolean(userId)),
        ),
      ).sort(),
    [sortedTracks],
  );
  const { data: profilePictures = [] } = useLiveTrainingParticipantProfilePictures(
    liveTrainingId,
    participantUserIds,
    language,
    { enabled: sortedTracks.length > 0 },
  );
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

  if (sortedTracks.length === 0) {
    return (
      <div className="flex size-full min-h-[20rem] items-center justify-center rounded-md bg-white/[0.03] text-white/70 lg:min-h-0">
        <div className="grid justify-items-center gap-2 text-center">
          <Users className="size-8 text-white/35" />
          <p className="text-sm">{t("liveTrainingView.meeting.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="live-training-room-grid grid size-full min-h-0 auto-rows-[minmax(10rem,1fr)] grid-cols-[repeat(auto-fit,minmax(min(100%,16rem),1fr))] gap-3 overflow-y-auto">
      {sortedTracks.map((trackRef) => (
        <LiveTrainingParticipantTile
          key={`${trackRef.participant.identity}-${trackRef.source}`}
          isSpeaking={activeSpeakerIdentities.has(trackRef.participant.identity)}
          onClick={() =>
            onTrackSelect(
              trackRef,
              profilePictureByUserId.get(getParticipantUserId(trackRef) ?? ""),
            )
          }
          profilePictureUrl={profilePictureByUserId.get(getParticipantUserId(trackRef) ?? "")}
          trackRef={trackRef}
        />
      ))}
    </div>
  );
}
