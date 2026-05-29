import { DisconnectButton, useTrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Files, Mic, MicOff, PhoneOff, ScreenShare, Video, VideoOff } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  onOpenMaterials,
}: LiveTrainingRoomToolbarProps) {
  const { t } = useTranslation();

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

        <ToolbarTooltip label={t("liveTrainingView.meeting.leave")}>
          <DisconnectButton
            className="inline-flex size-10 items-center justify-center rounded-md bg-danger-500/90 text-white transition-colors hover:bg-danger-500"
            aria-label={t("liveTrainingView.meeting.leave")}
          >
            <PhoneOff className="size-4" />
          </DisconnectButton>
        </ToolbarTooltip>
      </div>
    </TooltipProvider>
  );
}
