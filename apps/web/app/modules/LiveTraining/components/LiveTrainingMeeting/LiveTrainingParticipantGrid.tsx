import { GridLayout, ParticipantTile, useTracks } from "@livekit/components-react";
import { Track } from "livekit-client";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LiveTrainingParticipantGrid() {
  const { t } = useTranslation();
  const tracks = useTracks([
    { source: Track.Source.Camera, withPlaceholder: true },
    { source: Track.Source.ScreenShare, withPlaceholder: false },
  ]);

  if (tracks.length === 0) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-md border border-white/10 bg-black/25 text-white/70 lg:min-h-0">
        <div className="grid justify-items-center gap-2 text-center">
          <Users className="size-8 text-white/35" />
          <p className="text-sm">{t("liveTrainingView.meeting.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <GridLayout
      tracks={tracks}
      className="live-training-room-grid min-h-[20rem] rounded-md border border-white/10 bg-black/25 p-2 lg:min-h-0"
    >
      <ParticipantTile className="overflow-hidden rounded-md border border-white/10 bg-neutral-950" />
    </GridLayout>
  );
}
