import { Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

type LessonComposerRightControlsProps = {
  isVoiceMode: boolean;
  canSubmit: boolean;
  onStartVoiceMode: () => void;
  onStopVoiceMode: () => void;
  onSubmit: () => void;
  sendLabel: string;
  toggleVoiceInputLabel: string;
  stopVoiceRecordingLabel: string;
};

export function LessonComposerRightControls({
  isVoiceMode,
  canSubmit,
  onStartVoiceMode,
  onStopVoiceMode,
  onSubmit,
  sendLabel,
  toggleVoiceInputLabel,
  stopVoiceRecordingLabel,
}: LessonComposerRightControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="size-8">
        {!isVoiceMode && (
          <motion.div
            key="mic-toggle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
          >
            <Button
              type="button"
              variant="ghost"
              onClick={onStartVoiceMode}
              className="size-8 rounded-lg p-0 text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
              aria-label={toggleVoiceInputLabel}
            >
              <Mic className="size-4" />
            </Button>
          </motion.div>
        )}
      </div>

      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          if (isVoiceMode) {
            onStopVoiceMode();
            return;
          }
          onSubmit();
        }}
        disabled={!isVoiceMode && !canSubmit}
        className="flex items-center gap-x-2 rounded-full px-4 py-2 font-semibold text-white disabled:opacity-50"
        aria-label={isVoiceMode ? stopVoiceRecordingLabel : sendLabel}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={isVoiceMode ? "stop" : "send"}
            initial={{ opacity: 0, scale: 0.7, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: -10 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="inline-flex"
          >
            {isVoiceMode ? (
              <Square className="size-3.5 fill-current" />
            ) : (
              <Icon name="Send" className="size-4" />
            )}
          </motion.span>
        </AnimatePresence>
        {!isVoiceMode && sendLabel}
      </Button>
    </div>
  );
}
