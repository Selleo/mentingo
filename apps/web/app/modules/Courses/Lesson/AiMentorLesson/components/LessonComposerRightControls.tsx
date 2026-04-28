import { AudioLines, Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";

type LessonComposerRightControlsProps = {
  isVoiceMode: boolean;
  isVoiceMentorMode: boolean;
  canSubmit: boolean;
  canUseVoiceMentor: boolean;
  onStartVoiceMode: () => void;
  onStopVoiceMode: () => void;
  onStartVoiceMentor: () => void;
  onStopVoiceMentor: () => void;
  onSubmit: () => void;
  sendLabel: string;
  toggleVoiceInputLabel: string;
  startVoiceMentorLabel: string;
  stopVoiceRecordingLabel: string;
  primaryActionTestId?: string;
  micButtonTestId?: string;
};

export function LessonComposerRightControls({
  isVoiceMode,
  isVoiceMentorMode,
  canSubmit,
  canUseVoiceMentor,
  onStartVoiceMode,
  onStopVoiceMode,
  onStartVoiceMentor,
  onStopVoiceMentor,
  onSubmit,
  sendLabel,
  toggleVoiceInputLabel,
  startVoiceMentorLabel,
  stopVoiceRecordingLabel,
  primaryActionTestId,
  micButtonTestId,
}: LessonComposerRightControlsProps) {
  const buttonMode =
    isVoiceMode || isVoiceMentorMode
      ? "stop"
      : canSubmit
        ? "send"
        : canUseVoiceMentor
          ? "voice"
          : "send";

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
              data-testid={micButtonTestId}
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
        data-testid={primaryActionTestId}
        data-mode={buttonMode}
        type="button"
        variant="primary"
        size="sm"
        onClick={() => {
          if (isVoiceMode) {
            onStopVoiceMode();
            return;
          }
          if (isVoiceMentorMode) {
            onStopVoiceMentor();
            return;
          }
          if (!canSubmit) {
            onStartVoiceMentor();
            return;
          }
          onSubmit();
        }}
        className="flex items-center gap-x-2 rounded-full px-4 py-2 font-semibold text-white"
        aria-label={
          buttonMode === "stop"
            ? stopVoiceRecordingLabel
            : buttonMode === "voice"
              ? startVoiceMentorLabel
              : sendLabel
        }
        disabled={buttonMode === "send" && !canSubmit}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            key={buttonMode}
            initial={{ opacity: 0, scale: 0.7, rotate: 10 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.7, rotate: -10 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="inline-flex"
          >
            {buttonMode === "stop" ? (
              <Square className="size-3.5 fill-current" />
            ) : buttonMode === "voice" ? (
              <AudioLines className="size-4" />
            ) : (
              <Icon name="Send" className="size-4" />
            )}
          </motion.span>
        </AnimatePresence>
        {buttonMode === "send" ? sendLabel : null}
      </Button>
    </div>
  );
}
