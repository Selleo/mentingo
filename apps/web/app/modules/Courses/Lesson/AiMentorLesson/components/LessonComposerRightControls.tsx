import { AudioLines, Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Tooltip, TooltipArrow, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";

import {
  LESSON_COMPOSER_PRIMARY_ACTION_MODE,
  type LessonComposerRightControlsProps,
} from "./LessonComposerRightControls.types";
import { resolveLessonComposerPrimaryAction } from "./LessonComposerRightControls.utils";

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
  dictateVoiceInputLabel,
  startVoiceMentorLabel,
  stopVoiceRecordingLabel,
  primaryActionTestId,
  micButtonTestId,
}: LessonComposerRightControlsProps) {
  const primaryAction = resolveLessonComposerPrimaryAction({
    canSubmit,
    canUseVoiceMentor,
    isVoiceMentorMode,
    isVoiceMode,
    sendLabel,
    startVoiceMentorLabel,
    stopVoiceRecordingLabel,
  });
  const primaryButton = (
    <Button
      data-testid={primaryActionTestId}
      data-mode={primaryAction.mode}
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
        if (primaryAction.mode === LESSON_COMPOSER_PRIMARY_ACTION_MODE.VOICE) {
          onStartVoiceMentor();
          return;
        }
        onSubmit();
      }}
      className="flex items-center gap-x-2 rounded-full px-4 py-2 font-semibold text-white"
      aria-label={primaryAction.ariaLabel}
      disabled={primaryAction.disabled}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={primaryAction.mode}
          initial={{ opacity: 0, scale: 0.7, rotate: 10 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, scale: 0.7, rotate: -10 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="inline-flex"
        >
          {primaryAction.mode === LESSON_COMPOSER_PRIMARY_ACTION_MODE.STOP && (
            <Square className="size-3.5 fill-current" />
          )}
          {primaryAction.mode === LESSON_COMPOSER_PRIMARY_ACTION_MODE.SEND && (
            <Icon name="Send" className="size-4" />
          )}
          {primaryAction.mode === LESSON_COMPOSER_PRIMARY_ACTION_MODE.VOICE && (
            <AudioLines className="size-4" />
          )}
        </motion.span>
      </AnimatePresence>
      {primaryAction.showText && primaryAction.label}
    </Button>
  );

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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-testid={micButtonTestId}
                  type="button"
                  variant="ghost"
                  onClick={onStartVoiceMode}
                  className="size-8 rounded-lg p-0 text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
                  aria-label={dictateVoiceInputLabel || toggleVoiceInputLabel}
                >
                  <Mic className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
              >
                {dictateVoiceInputLabel}
                <TooltipArrow className="fill-black" />
              </TooltipContent>
            </Tooltip>
          </motion.div>
        )}
      </div>

      {primaryAction.mode === LESSON_COMPOSER_PRIMARY_ACTION_MODE.VOICE ? (
        <Tooltip>
          <TooltipTrigger asChild>{primaryButton}</TooltipTrigger>
          <TooltipContent
            side="top"
            className="rounded bg-black px-2 py-1 text-sm text-white shadow-md"
          >
            {primaryAction.ariaLabel}
            <TooltipArrow className="fill-black" />
          </TooltipContent>
        </Tooltip>
      ) : (
        primaryButton
      )}
    </div>
  );
}
