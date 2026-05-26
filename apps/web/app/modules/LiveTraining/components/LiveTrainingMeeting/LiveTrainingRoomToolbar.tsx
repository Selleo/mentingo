import { DisconnectButton, TrackToggle } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Files, Mic, PhoneOff, ScreenShare, Video } from "lucide-react";
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

function toolbarButtonClassName() {
  return cn(
    "inline-flex size-10 items-center justify-center rounded-md border border-white/10 bg-white/10 text-white transition-colors hover:border-primary-300/50 hover:bg-primary-400/25",
    "data-[lk-muted=true]:border-danger-300/30 data-[lk-muted=true]:bg-danger-500/80 data-[lk-muted=true]:hover:bg-danger-500",
  );
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

export function LiveTrainingRoomToolbar({
  credentials,
  onOpenMaterials,
}: LiveTrainingRoomToolbarProps) {
  const { t } = useTranslation();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex flex-wrap items-center justify-center gap-2 rounded-md border border-white/10 bg-black/25 p-2 backdrop-blur">
        {canPublishMicrophone(credentials) && (
          <ToolbarTooltip label={t("liveTrainingView.meeting.microphone")}>
            <TrackToggle
              source={Track.Source.Microphone}
              showIcon={false}
              className={toolbarButtonClassName()}
              aria-label={t("liveTrainingView.meeting.microphone")}
            >
              <Mic className="size-4" />
            </TrackToggle>
          </ToolbarTooltip>
        )}

        {canPublishCamera(credentials) && (
          <ToolbarTooltip label={t("liveTrainingView.meeting.camera")}>
            <TrackToggle
              source={Track.Source.Camera}
              showIcon={false}
              className={toolbarButtonClassName()}
              aria-label={t("liveTrainingView.meeting.camera")}
            >
              <Video className="size-4" />
            </TrackToggle>
          </ToolbarTooltip>
        )}

        {canPublishScreenShare(credentials) && (
          <ToolbarTooltip label={t("liveTrainingView.meeting.screenShare")}>
            <TrackToggle
              source={Track.Source.ScreenShare}
              showIcon={false}
              className={toolbarButtonClassName()}
              aria-label={t("liveTrainingView.meeting.screenShare")}
            >
              <ScreenShare className="size-4" />
            </TrackToggle>
          </ToolbarTooltip>
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
            className="inline-flex size-10 items-center justify-center rounded-md border border-danger-300/25 bg-danger-500/90 text-white transition-colors hover:bg-danger-500"
            aria-label={t("liveTrainingView.meeting.leave")}
          >
            <PhoneOff className="size-4" />
          </DisconnectButton>
        </ToolbarTooltip>
      </div>
    </TooltipProvider>
  );
}
