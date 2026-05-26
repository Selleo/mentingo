import { isTrackReference, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Mic, MicOff, MonitorUp, Video, VideoOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import type { ReactNode } from "react";

type LiveTrainingParticipantTileProps = {
  profilePictureUrl?: string | null;
  trackRef: TrackReferenceOrPlaceholder;
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

type ParticipantStateIndicatorProps = {
  enabled: boolean;
  enabledIcon: ReactNode;
  disabledIcon: ReactNode;
  label: string;
};

function ParticipantStateIndicator({
  enabled,
  enabledIcon,
  disabledIcon,
  label,
}: ParticipantStateIndicatorProps) {
  return (
    <span
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-white shadow-sm",
        {
          "bg-primary-500/90": enabled,
          "bg-danger-500/90": !enabled,
        },
      )}
      aria-label={label}
      title={label}
    >
      {enabled && enabledIcon}
      {!enabled && disabledIcon}
    </span>
  );
}

type ParticipantAvatarProps = {
  participantName: string;
  participantInitials: string;
  profilePictureUrl?: string | null;
  size: "sm" | "lg" | "fullscreen";
};

function ParticipantAvatar({
  participantName,
  participantInitials,
  profilePictureUrl,
  size,
}: ParticipantAvatarProps) {
  return (
    <Avatar
      className={cn("shrink-0 bg-primary-800 ring-1 ring-primary-200/20", {
        "size-7": size === "sm",
        "size-20": size === "lg",
        "size-32": size === "fullscreen",
      })}
    >
      {profilePictureUrl && (
        <AvatarImage
          src={profilePictureUrl}
          alt={`${participantName} profile`}
          className="size-full object-cover"
        />
      )}
      <AvatarFallback
        className={cn("bg-primary-800 font-semibold text-primary-50", {
          "text-xs": size === "sm",
          "text-2xl": size !== "sm",
        })}
      >
        {participantInitials}
      </AvatarFallback>
    </Avatar>
  );
}

export function LiveTrainingParticipantTile({
  profilePictureUrl,
  trackRef,
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

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        "group relative flex overflow-hidden rounded-md bg-primary-950 text-left shadow-sm ring-1 ring-primary-200/10 transition-colors",
        {
          "min-h-44 cursor-pointer hover:bg-primary-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200":
            Boolean(onClick),
          "h-full min-h-44": !isFullscreen,
          "size-full min-h-0 cursor-default rounded-none bg-black ring-0": isFullscreen,
        },
      )}
    >
      {hasVideoTrack ? (
        <VideoTrack
          trackRef={trackRef}
          className={cn("relative z-10 size-full object-cover", {
            "object-contain": isScreenShare || isFullscreen,
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
          <span className="inline-flex min-w-0 items-center gap-2 truncate rounded bg-black/45 py-1 pl-1 pr-2 text-sm font-medium text-white backdrop-blur-sm">
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
    </button>
  );
}
