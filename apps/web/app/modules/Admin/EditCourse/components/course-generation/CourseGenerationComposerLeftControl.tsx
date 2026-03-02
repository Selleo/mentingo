import { Paperclip, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "~/components/ui/button";

type CourseGenerationComposerLeftControlProps = {
  isVoiceMode: boolean;
  isUploadDisabled: boolean;
  onAttachFile: () => void;
  onCloseVoiceMode: () => void;
};

export function CourseGenerationComposerLeftControl({
  isVoiceMode,
  isUploadDisabled,
  onAttachFile,
  onCloseVoiceMode,
}: CourseGenerationComposerLeftControlProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={!isVoiceMode && isUploadDisabled}
      onClick={isVoiceMode ? onCloseVoiceMode : onAttachFile}
      className="size-8 rounded-lg p-0 text-neutral-700"
      aria-label={isVoiceMode ? "Close voice mode" : "Attach file"}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={isVoiceMode ? "close" : "attach"}
          initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.7, rotate: 10 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="inline-flex"
        >
          {isVoiceMode ? <X className="size-4" /> : <Paperclip className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
