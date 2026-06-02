import { X } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { LiveTrainingParticipantTile } from "./LiveTrainingParticipantTile";

import type { LiveTrainingFullscreenTrackOverlayProps } from "./LiveTrainingMeeting.types";

export function LiveTrainingFullscreenTrackOverlay({
  profilePictureUrl,
  trackRef,
  onClose,
}: LiveTrainingFullscreenTrackOverlayProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (!trackRef) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, trackRef]);

  if (!trackRef) return null;

  return (
    <div className="fixed inset-0 z-[80] grid h-screen w-screen grid-rows-[minmax(0,1fr)_auto] bg-black text-white">
      <div className="min-h-0">
        <LiveTrainingParticipantTile
          profilePictureUrl={profilePictureUrl}
          trackRef={trackRef}
          variant="fullscreen"
        />
      </div>
      <div className="flex items-center justify-center bg-black/85 p-3 backdrop-blur-md">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-10 rounded-md bg-white/10 text-white hover:bg-white/20 hover:text-white"
          onClick={onClose}
          aria-label={t("common.button.close")}
        >
          <X className="size-5" />
        </Button>
      </div>
    </div>
  );
}
