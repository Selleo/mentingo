import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "~/components/ui/drawer";

import { LiveTrainingMeetingMaterialsPanel } from "./LiveTrainingMeetingMaterialsPanel";
import { LiveTrainingParticipantGrid } from "./LiveTrainingParticipantGrid";
import { LiveTrainingRoomToolbar } from "./LiveTrainingRoomToolbar";

import type { LiveTrainingRoomProps } from "./LiveTrainingMeeting.types";

function LiveTrainingRoomContent({
  credentials,
  liveTraining,
  canViewAllMaterials,
}: Pick<LiveTrainingRoomProps, "credentials" | "liveTraining" | "canViewAllMaterials">) {
  const { t } = useTranslation();
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-[61] grid h-screen w-screen min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-3 overflow-hidden bg-primary-950 p-3 sm:p-4">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-white/45">
            {t("liveTrainingView.meeting.inSession")}
          </p>
          <h2 className="truncate text-base font-semibold text-white sm:text-lg">
            {liveTraining.title}
          </h2>
        </div>
        <Badge className="shrink-0 rounded bg-primary-400/20 text-primary-50 hover:bg-primary-400/20">
          {t("liveTrainingView.meeting.roomTitle")}
        </Badge>
      </div>

      <div className="min-h-0">
        <LiveTrainingParticipantGrid />
      </div>

      <RoomAudioRenderer />
      <LiveTrainingRoomToolbar
        credentials={credentials}
        onOpenMaterials={() => setIsMaterialsOpen(true)}
      />

      <Drawer
        direction="right"
        open={isMaterialsOpen}
        shouldScaleBackground={false}
        onOpenChange={setIsMaterialsOpen}
      >
        <DrawerContent
          overlayClassName="bg-transparent"
          className="bottom-0 left-auto right-0 top-0 z-[70] mt-0 h-full w-full max-w-[26rem] overflow-hidden rounded-none border-l border-primary-100 bg-white p-0 shadow-xl sm:max-w-[26rem] [&>div:first-child]:hidden"
        >
          <DrawerHeader className="border-b border-primary-100 px-5 py-4 text-left">
            <DrawerTitle className="body-base-md text-primary-950">
              {t("liveTrainingView.meeting.materials")}
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              {t("liveTrainingView.meeting.materials")}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">
            <LiveTrainingMeetingMaterialsPanel
              liveTraining={liveTraining}
              canViewAllMaterials={canViewAllMaterials}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export function LiveTrainingRoom({
  credentials,
  liveTraining,
  canViewAllMaterials,
  onLeave,
}: LiveTrainingRoomProps) {
  return (
    <LiveKitRoom
      token={credentials.token}
      serverUrl={credentials.livekitUrl}
      connect
      audio={false}
      video={false}
      onDisconnected={onLeave}
      className="fixed inset-0 z-[60] bg-primary-950 text-white"
      data-lk-theme="default"
    >
      <div className="fixed inset-0 z-[60] bg-primary-950" />
      <div className="fixed inset-0 z-[60] bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.14),transparent_28%),linear-gradient(135deg,var(--primary-800),var(--primary-950)_48%,var(--primary-900))]" />
      <div className="fixed inset-0 z-[61]">
        <LiveTrainingRoomContent
          credentials={credentials}
          liveTraining={liveTraining}
          canViewAllMaterials={canViewAllMaterials}
        />
      </div>
    </LiveKitRoom>
  );
}
