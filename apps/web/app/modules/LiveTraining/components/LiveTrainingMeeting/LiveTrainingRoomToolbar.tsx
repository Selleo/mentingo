import { useParticipants, useRoomContext, useTrackToggle } from "@livekit/components-react";
import { LIVE_TRAINING_PARTICIPANT_ROLES } from "@repo/shared";
import { RoomEvent, Track } from "livekit-client";
import { Files, Mic, MicOff, PhoneOff, ScreenShare, Video, VideoOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

import {
  canPublishCamera,
  canPublishMicrophone,
  canPublishScreenShare,
} from "./LiveTrainingMeeting.utils";

import type { LiveTrainingRoomToolbarProps } from "./LiveTrainingMeeting.types";
import type { ReactNode } from "react";

type ToolbarToggleProps = {
  label: string;
  children: ReactNode;
};

type ToolbarButtonState = "default" | "active" | "muted";

type LiveTrainingParticipantMetadata = {
  role?: string;
};

type LiveKitParticipantWithMetadata = {
  metadata?: string;
};

const disconnectButtonClassName =
  "inline-flex size-10 items-center justify-center rounded-md border border-destructive bg-destructive text-primary-foreground shadow-sm transition-all hover:border-destructive hover:opacity-90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-primary-950 disabled:cursor-not-allowed disabled:opacity-50";

function toolbarButtonClassName(state: ToolbarButtonState = "default") {
  return cn(
    "inline-flex size-10 items-center justify-center rounded-md border text-white transition-colors",
    {
      "border-white/10 bg-white/10 hover:bg-white/15": state === "default",
      "border-white bg-white text-primary-800 shadow-sm hover:bg-white/90": state === "active",
      "border-danger-300/50 bg-danger-500/25 text-danger-50 hover:bg-danger-500/35":
        state === "muted",
    },
  );
}

function getTrackToggleButtonState(isMuted: boolean, isActive: boolean): ToolbarButtonState {
  if (isMuted) return "muted";
  if (isActive) return "active";

  return "default";
}

function ToolbarTooltip({ label, children }: ToolbarToggleProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="top"
        align="center"
        className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
      >
        {label}
        <TooltipArrow className="fill-black" />
      </TooltipContent>
    </Tooltip>
  );
}

const getParticipantMetadata = (metadata?: string): LiveTrainingParticipantMetadata => {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata) as LiveTrainingParticipantMetadata;
  } catch {
    return {};
  }
};

const getParticipantRole = (metadata?: string) => {
  const parsed = getParticipantMetadata(metadata);

  return typeof parsed.role === "string" ? parsed.role : null;
};

const isHostRole = (role: string | null | undefined) =>
  role === LIVE_TRAINING_PARTICIPANT_ROLES.HOST || role === LIVE_TRAINING_PARTICIPANT_ROLES.ADMIN;

const countActiveHosts = (
  participants: Iterable<LiveKitParticipantWithMetadata>,
  localParticipant: LiveKitParticipantWithMetadata,
) => {
  let hostCount = isHostRole(getParticipantRole(localParticipant.metadata)) ? 1 : 0;

  for (const participant of participants) {
    if (isHostRole(getParticipantRole(participant.metadata))) {
      hostCount += 1;
    }
  }

  return hostCount;
};

const countHostParticipants = (participants: Iterable<LiveKitParticipantWithMetadata>) => {
  let hostCount = 0;

  for (const participant of participants) {
    if (isHostRole(getParticipantRole(participant.metadata))) {
      hostCount += 1;
    }
  }

  return hostCount;
};

const getActiveHostCount = (room: ReturnType<typeof useRoomContext>, isHost: boolean) =>
  Math.max(
    countActiveHosts(room.remoteParticipants.values(), room.localParticipant),
    isHost ? 1 : 0,
  );

type MeetingTrackToggleButtonProps = {
  source: Track.Source.Microphone | Track.Source.Camera | Track.Source.ScreenShare;
  label: string;
  enabledIcon: ReactNode;
  disabledIcon?: ReactNode;
};

function MeetingTrackToggleButton({
  source,
  label,
  enabledIcon,
  disabledIcon,
}: MeetingTrackToggleButtonProps) {
  const { buttonProps, enabled, pending } = useTrackToggle({ source });
  const isMuted = Boolean(disabledIcon) && !enabled;
  const isActive = enabled && !isMuted;
  const buttonState = getTrackToggleButtonState(isMuted, isActive);

  return (
    <ToolbarTooltip label={label}>
      <button
        {...buttonProps}
        type="button"
        disabled={buttonProps.disabled || pending}
        className={toolbarButtonClassName(buttonState)}
        aria-label={label}
      >
        {isMuted ? (disabledIcon ?? enabledIcon) : enabledIcon}
      </button>
    </ToolbarTooltip>
  );
}

export function LiveTrainingRoomToolbar({
  credentials,
  isFinishingSession,
  onOpenMaterials,
  onFinishSession,
  onUserLeave,
}: LiveTrainingRoomToolbarProps) {
  const { t } = useTranslation();
  const room = useRoomContext();
  const participants = useParticipants();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const isHost = isHostRole(credentials.role);
  const [activeHostCount, setActiveHostCount] = useState(() =>
    Math.max(getActiveHostCount(room, isHost), countHostParticipants(participants)),
  );
  const isLastHost = activeHostCount <= 1;

  useEffect(() => {
    const refreshActiveHostCount = () => {
      setActiveHostCount(
        Math.max(getActiveHostCount(room, isHost), countHostParticipants(participants)),
      );
    };

    refreshActiveHostCount();

    room
      .on(RoomEvent.Connected, refreshActiveHostCount)
      .on(RoomEvent.ParticipantConnected, refreshActiveHostCount)
      .on(RoomEvent.ParticipantDisconnected, refreshActiveHostCount)
      .on(RoomEvent.ParticipantMetadataChanged, refreshActiveHostCount);

    return () => {
      room
        .off(RoomEvent.Connected, refreshActiveHostCount)
        .off(RoomEvent.ParticipantConnected, refreshActiveHostCount)
        .off(RoomEvent.ParticipantDisconnected, refreshActiveHostCount)
        .off(RoomEvent.ParticipantMetadataChanged, refreshActiveHostCount);
    };
  }, [isHost, participants, room]);

  const handleLeave = () => {
    onUserLeave();
    room.disconnect();
  };

  const handleHostLeaveClick = () => {
    const nextActiveHostCount = Math.max(
      getActiveHostCount(room, isHost),
      countHostParticipants(participants),
    );
    setActiveHostCount(nextActiveHostCount);

    if (nextActiveHostCount <= 1) {
      setIsConfirmOpen(true);
      return;
    }

    handleLeave();
  };

  const handleHostConfirm = async () => {
    onUserLeave();

    if (isLastHost) {
      await onFinishSession();
      return;
    }

    room.disconnect();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-md bg-black/35 p-2 backdrop-blur-md">
        {canPublishMicrophone(credentials) && (
          <MeetingTrackToggleButton
            source={Track.Source.Microphone}
            label={t("liveTrainingView.meeting.microphone")}
            enabledIcon={<Mic className="size-4" />}
            disabledIcon={<MicOff className="size-4" />}
          />
        )}

        {canPublishCamera(credentials) && (
          <MeetingTrackToggleButton
            source={Track.Source.Camera}
            label={t("liveTrainingView.meeting.camera")}
            enabledIcon={<Video className="size-4" />}
            disabledIcon={<VideoOff className="size-4" />}
          />
        )}

        {canPublishScreenShare(credentials) && (
          <MeetingTrackToggleButton
            source={Track.Source.ScreenShare}
            label={t("liveTrainingView.meeting.screenShare")}
            enabledIcon={<ScreenShare className="size-4" />}
          />
        )}

        <ToolbarTooltip label={t("liveTrainingView.meeting.materials")}>
          <button
            type="button"
            className={toolbarButtonClassName()}
            aria-label={t("liveTrainingView.meeting.materials")}
            onClick={onOpenMaterials}
          >
            <Files className="size-4" />
          </button>
        </ToolbarTooltip>

        {isHost ? (
          <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <ToolbarTooltip label={t("liveTrainingView.meeting.finish")}>
              <button
                type="button"
                className={disconnectButtonClassName}
                aria-label={t("liveTrainingView.meeting.finish")}
                disabled={isFinishingSession}
                onClick={handleHostLeaveClick}
              >
                <PhoneOff className="size-4" />
              </button>
            </ToolbarTooltip>
            <AlertDialogContent overlayClassName="z-[90]" className="z-[91]">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("liveTrainingView.meeting.finishDialog.title")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    isLastHost
                      ? "liveTrainingView.meeting.finishDialog.lastHostDescription"
                      : "liveTrainingView.meeting.finishDialog.otherHostsDescription",
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>
                  {t("liveTrainingView.meeting.finishDialog.cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-primary-foreground hover:bg-destructive hover:text-primary-foreground hover:opacity-90"
                  disabled={isFinishingSession}
                  onClick={(event) => {
                    event.preventDefault();
                    void handleHostConfirm();
                  }}
                >
                  {t(
                    isLastHost
                      ? "liveTrainingView.meeting.finishDialog.confirmEnd"
                      : "liveTrainingView.meeting.finishDialog.confirmLeave",
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <ToolbarTooltip label={t("liveTrainingView.meeting.leave")}>
            <button
              type="button"
              className={disconnectButtonClassName}
              aria-label={t("liveTrainingView.meeting.leave")}
              onClick={handleLeave}
            >
              <PhoneOff className="size-4" />
            </button>
          </ToolbarTooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
