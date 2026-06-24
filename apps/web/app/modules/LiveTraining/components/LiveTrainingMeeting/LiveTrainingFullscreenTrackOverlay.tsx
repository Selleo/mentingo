import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";

import { LiveTrainingParticipantTile } from "./LiveTrainingParticipantTile";

import type { LiveTrainingFullscreenTrackOverlayProps } from "./LiveTrainingMeeting.types";

export function LiveTrainingFullscreenTrackOverlay({
  layoutId,
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

  return (
    <AnimatePresence>
      {trackRef && (
        <motion.div
          key={layoutId ?? `${trackRef.participant.identity}-${trackRef.source}`}
          className="fixed inset-0 z-[80] grid h-[100dvh] w-[100dvw] min-w-0 grid-rows-[minmax(0,1fr)_auto] bg-black text-white"
          initial={{ backgroundColor: "rgba(0, 0, 0, 0)" }}
          animate={{ backgroundColor: "rgba(0, 0, 0, 1)" }}
          exit={{ backgroundColor: "rgba(0, 0, 0, 0)" }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.div
            layoutId={layoutId}
            className="min-h-0"
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <LiveTrainingParticipantTile
              profilePictureUrl={profilePictureUrl}
              trackRef={trackRef}
              variant="fullscreen"
            />
          </motion.div>
          <motion.div
            className="flex items-center justify-center bg-black/85 p-3 backdrop-blur-md"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
