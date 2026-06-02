import { useTracks } from "@livekit/components-react";
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

export function LiveTrainingParticipantGrid({
  liveTrainingId,
  onTrackSelect,
}: LiveTrainingParticipantGridProps) {
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);
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
  const { data: profilePictures = [] } = useLiveTrainingParticipantProfilePictures(
    liveTrainingId,
    participantUserIds,
    language,
    { enabled: tracks.length > 0 },
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

  return (
    <div className="live-training-room-grid grid size-full min-h-[20rem] grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] auto-rows-fr gap-3 lg:min-h-0">
      {tracks.map((trackRef) => (
        <LiveTrainingParticipantTile
          key={`${trackRef.participant.identity}-${trackRef.source}`}
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
