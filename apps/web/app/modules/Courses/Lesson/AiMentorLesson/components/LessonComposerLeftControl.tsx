import { Smile, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "~/components/ui/button";

type LessonComposerLeftControlProps = {
  isVoiceMode: boolean;
  onCloseVoiceMode: () => void;
  onToggleEmojiPicker: () => void;
  closeVoiceModeLabel: string;
  addEmojiLabel: string;
};

export function LessonComposerLeftControl({
  isVoiceMode,
  onCloseVoiceMode,
  onToggleEmojiPicker,
  closeVoiceModeLabel,
  addEmojiLabel,
}: LessonComposerLeftControlProps) {
  return (
    <Button
      type="button"
      variant={isVoiceMode ? "ghost" : "default"}
      onClick={isVoiceMode ? onCloseVoiceMode : onToggleEmojiPicker}
      className="flex size-8 items-center justify-center rounded-full border-none bg-white p-0 text-neutral-700 shadow-sm"
      aria-label={isVoiceMode ? closeVoiceModeLabel : addEmojiLabel}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={isVoiceMode ? "close" : "emoji"}
          initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.7, rotate: 10 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="inline-flex"
        >
          {isVoiceMode ? <X className="size-4" /> : <Smile className="size-4" />}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
