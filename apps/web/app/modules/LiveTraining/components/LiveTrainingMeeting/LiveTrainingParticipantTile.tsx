import { isTrackReference, VideoTrack } from "@livekit/components-react";
import { Track } from "livekit-client";
import { MonitorUp, Mic, MicOff, Pin, Video, VideoOff } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { cn } from "~/lib/utils";

import { ParticipantAvatar } from "./ParticipantAvatar";
import { ParticipantStateIndicator } from "./ParticipantStateIndicator";
import { useParticipantAccentColor } from "./useParticipantAccentColor";

import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import type { KeyboardEvent } from "react";

type LiveTrainingParticipantTileProps = {
  profilePictureUrl?: string | null;
  trackRef: TrackReferenceOrPlaceholder;
  isSpeaking?: boolean;
  variant?: "grid" | "rail" | "stage" | "fullscreen";
  isMainStage?: boolean;
  onClick?: () => void;
  onPresentOnStage?: () => void;
};

const getParticipantName = (trackRef: TrackReferenceOrPlaceholder) =>
  trackRef.participant.name || trackRef.participant.identity;

const getParticipantInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstInitial = words[0]?.[0] ?? "?";
  const secondInitial = words[1]?.[0] ?? "";

  return `${firstInitial}${secondInitial}`.toUpperCase();
};

const isInteractiveElement = (element: EventTarget | null) =>
  element instanceof HTMLElement &&
  Boolean(element.closest("button, a, input, select, textarea, [role='button'], [tabindex]"));

export function LiveTrainingParticipantTile({
  profilePictureUrl,
  trackRef,
  isSpeaking = false,
  variant = "grid",
  isMainStage = false,
  onClick,
  onPresentOnStage,
}: LiveTrainingParticipantTileProps) {
  const { t } = useTranslation();
  const participantName = getParticipantName(trackRef);
  const participantInitials = getParticipantInitials(participantName);
  const accentColor = useParticipantAccentColor(profilePictureUrl);
  const isScreenShare = trackRef.source === Track.Source.ScreenShare;
  const hasVideoTrack = isTrackReference(trackRef);
  const isFullscreen = variant === "fullscreen";
  const isStage = variant === "stage";
  const isRail = variant === "rail";
  const emptyCameraAvatarSize = isFullscreen ? "fullscreen" : "lg";
  const isMicrophoneEnabled = trackRef.participant.isMicrophoneEnabled;
  const isCameraEnabled = trackRef.participant.isCameraEnabled;
  const isScreenShareEnabled = trackRef.participant.isScreenShareEnabled;
  const shouldShowVideoTrack =
    hasVideoTrack && (isScreenShare ? isScreenShareEnabled : isCameraEnabled);
  const shouldMirrorVideo = trackRef.participant.isLocal && !isScreenShare;
  const tileBackgroundColor = isScreenShare && shouldShowVideoTrack ? "#000" : accentColor;
  const interactiveProps = onClick
    ? {
        role: "button",
        tabIndex: 0,
        onClick,
        onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (isInteractiveElement(event.target) && event.target !== event.currentTarget) return;

          event.preventDefault();
          onClick();
        },
      }
    : {};

  return (
    <motion.div
      {...interactiveProps}
      className={cn(
        "group relative flex overflow-hidden rounded-md text-left shadow-sm transition-shadow duration-200",
        {
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200":
            Boolean(onClick),
          "shadow-[0_0_28px_rgba(16,185,129,0.28)]": isSpeaking && !isFullscreen,
          "size-full": variant === "grid",
          "aspect-[16/10] min-h-[9.5rem] w-full": isRail,
          "size-full min-h-[22rem]": isStage,
          "size-full min-h-0 cursor-default rounded-none bg-black ring-0": isFullscreen,
        },
      )}
      style={{
        backgroundColor: tileBackgroundColor,
        backgroundImage: shouldShowVideoTrack
          ? undefined
          : `radial-gradient(circle at 28% 18%, color-mix(in srgb, ${accentColor} 72%, white 28%), transparent 35%), linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 55%, black 45%))`,
      }}
    >
      {!isFullscreen && (
        <div
          className={cn("pointer-events-none absolute inset-0 z-20 rounded-md border", {
            "border-white/50": isMainStage,
            "border-primary-200/10": !isMainStage,
          })}
        />
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
        <div className="relative z-10 flex size-full items-center justify-center">
          <ParticipantAvatar
            accentColor={accentColor}
            participantName={participantName}
            participantInitials={participantInitials}
            profilePictureUrl={profilePictureUrl}
            size={emptyCameraAvatarSize}
          />
        </div>
      )}

      <div className="absolute right-3 top-3 z-30 flex gap-1.5">
        {!isScreenShare && (
          <>
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
          </>
        )}
        {isScreenShareEnabled && !isScreenShare && (
          <ParticipantStateIndicator
            enabled
            enabledIcon={<MonitorUp className="size-3.5" />}
            disabledIcon={<MonitorUp className="size-3.5" />}
            label={t("liveTrainingView.meeting.screen")}
          />
        )}
        {isScreenShare && onPresentOnStage && (
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded bg-black/45 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-primary-500 focus:bg-primary-500 focus-visible:outline-none"
            onClick={(event) => {
              event.stopPropagation();
              onPresentOnStage();
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
            }}
            aria-label={t("liveTrainingView.meeting.presentOnStage")}
            title={t("liveTrainingView.meeting.presentOnStage")}
          >
            <Pin className="size-3.5 rotate-45" />
          </button>
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
              accentColor={accentColor}
              participantName={participantName}
              participantInitials={participantInitials}
              profilePictureUrl={profilePictureUrl}
              size="sm"
            />
            {participantName}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isScreenShare && (
            <span className="inline-flex items-center gap-1 rounded bg-primary-400/20 px-2 py-1 text-[11px] font-medium text-primary-50 backdrop-blur-sm">
              <MonitorUp className="size-3" />
              {t("liveTrainingView.meeting.screen")}
            </span>
          )}
        </div>
      </div>

      {isSpeaking && !isFullscreen && (
        <div className="pointer-events-none absolute inset-0 z-40 rounded-md border-2 border-emerald-400 shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]" />
      )}
    </motion.div>
  );
}
