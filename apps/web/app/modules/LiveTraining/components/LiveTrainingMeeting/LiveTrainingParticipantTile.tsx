import { isTrackReference, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantStateIndicator } from "./ParticipantStateIndicator";

import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";

type LiveTrainingParticipantTileProps = {
  profilePictureUrl?: string | null;
  trackRef: TrackReferenceOrPlaceholder;
  isSpeaking?: boolean;
  variant?: "grid" | "fullscreen";
  onClick?: () => void;
};

const getParticipantName = (trackRef: TrackReferenceOrPlaceholder) =>
  trackRef.participant.name || trackRef.participant.identity;

const getParticipantInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstInitial = words[0]?.[0] ?? "?";
  const secondInitial = words[1]?.[0] ?? "";

  return `${firstInitial}${secondInitial}`.toUpperCase();
};

export function LiveTrainingParticipantTile({
  profilePictureUrl,
  trackRef,
  isSpeaking = false,
  variant = "grid",
  onClick,
}: LiveTrainingParticipantTileProps) {
  const { t } = useTranslation();
  const participantName = getParticipantName(trackRef);
  const participantInitials = getParticipantInitials(participantName);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const hasVideoTrack = isTrackReference(trackRef);
  const isFullscreen = variant === "fullscreen";
  const emptyCameraAvatarSize = isFullscreen ? "fullscreen" : "lg";
  const isMicrophoneEnabled = trackRef.participant.isMicrophoneEnabled;
  const isCameraEnabled = trackRef.participant.isCameraEnabled;
  const isScreenShareEnabled = trackRef.participant.isScreenShareEnabled;
  const shouldShowVideoTrack =
    hasVideoTrack && (isScreenShare ? isScreenShareEnabled : isCameraEnabled);
  const shouldMirrorVideo = trackRef.participant.isLocal && !isScreenShare;

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "group relative flex overflow-hidden rounded-md bg-primary-950 text-left shadow-sm transition-[background-color,box-shadow] duration-200",
        {
          "min-h-44 cursor-pointer hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200":
            Boolean(onClick),
          "shadow-[0_0_28px_rgba(16,185,129,0.28)]": isSpeaking && !isFullscreen,
          "aspect-video w-full min-h-0": !isFullscreen,
          "size-full min-h-0 cursor-default rounded-none bg-black ring-0": isFullscreen,
        },
      )}
    >
      {!isFullscreen && (
        <div className="pointer-events-none absolute inset-0 z-30 rounded-md border border-primary-200/10" />
      )}

      {shouldShowVideoTrack ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn("relative z-10 size-full object-cover", {
            "object-contain": isScreenShare || isFullscreen,
            "-scale-x-100": shouldMirrorVideo,
          })}
        />
      ) : (
        <div className="relative z-10 flex size-full items-center justify-center bg-primary-950">
          <ParticipantAvatar
            participantName={participantName}
            participantInitials={participantInitials}
            profilePictureUrl={profilePictureUrl}
            size={emptyCameraAvatarSize}
          />
        </div>
      )}

      <div className="absolute right-3 top-3 z-20 flex gap-1.5">
        <ParticipantStateIndicator
          enabled={isMicrophoneEnabled}
          enabledIcon={<Mic className="size-3.5" />}
          disabledIcon={<MicOff className="size-3.5" />}
          label={t("liveTrainingView.meeting.microphone")}
        />
        <ParticipantStateIndicator
          enabled={isCameraEnabled}
          enabledIcon={<Video className="size-3.5" />}
          disabledIcon={<VideoOff className="size-3.5" />}
          label={t("liveTrainingView.meeting.camera")}
        />
        {isScreenShareEnabled && (
          <ParticipantStateIndicator
            enabled
            enabledIcon={<MonitorUp className="size-3.5" />}
            disabledIcon={<MonitorUp className="size-3.5" />}
            label={t("liveTrainingView.meeting.screen")}
          />
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "inline-flex min-w-0 items-center gap-2 truncate rounded bg-black/45 py-1 pl-1 pr-2 text-sm font-medium text-white backdrop-blur-sm",
            )}
          >
            <ParticipantAvatar
              participantName={participantName}
              participantInitials={participantInitials}
              profilePictureUrl={profilePictureUrl}
              size="sm"
            />
            {participantName}
          </span>
        </div>

        {isScreenShare && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded bg-primary-400/20 px-2 py-1 text-[11px] font-medium text-primary-50 backdrop-blur-sm">
            <MonitorUp className="size-3" />
            {t("liveTrainingView.meeting.screen")}
          </span>
        )}
      </div>

      {isSpeaking && !isFullscreen && (
        <div className="pointer-events-none absolute inset-0 z-40 rounded-md border-2 border-emerald-400 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]" />
      )}
    </button>
  );
}
