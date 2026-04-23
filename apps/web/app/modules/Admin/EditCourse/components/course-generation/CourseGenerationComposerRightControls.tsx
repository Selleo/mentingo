import { Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

type CourseGenerationComposerRightControlsProps = {
  isVoiceMode: boolean;
  onStartVoiceMode: () => void;
  onStopVoiceMode: () => void;
  onSubmit: () => void;
  voiceButtonTestId?: string;
  sendButtonTestId?: string;
};

export function CourseGenerationComposerRightControls({
  isVoiceMode,
  onStartVoiceMode,
  onStopVoiceMode,
  onSubmit,
  voiceButtonTestId,
  sendButtonTestId,
}: CourseGenerationComposerRightControlsProps) {
  return (
    <>
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
              data-testid={voiceButtonTestId}
              type="button"
              variant="ghost"
              onClick={onStartVoiceMode}
              className="size-8 rounded-lg p-0 text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
              aria-label="Toggle voice input"
            >
              <Mic className="size-4" />
            </Button>
          </motion.div>
        )}
      </div>

      <Button
        data-testid={sendButtonTestId}
        type="button"
        variant="default"
        onClick={() => {
          if (isVoiceMode) {
            onStopVoiceMode();
            return;
          }
          onSubmit();
        }}
        className="size-8 rounded-lg p-0"
        aria-label={isVoiceMode ? "Stop voice recording" : "Send"}
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
      </Button>
    </>
  );
}
