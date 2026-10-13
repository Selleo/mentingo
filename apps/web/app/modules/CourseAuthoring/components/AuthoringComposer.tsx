/** Provides the default text-first entry point for an AI course generation request. */
import { ArrowUp, LoaderCircle, Mic, Square, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { VoiceLevelBars } from "~/modules/Voice/components/VoiceLevelBars";
import { useTranscription } from "~/modules/Voice/hooks/useTranscription";

import { COURSE_AUTHORING_HANDLES } from "../../../../e2e/data/curriculum/handles";

const VOICE_PHASE = {
  LISTENING: "listening",
  TRANSCRIBING: "transcribing",
} as const;

type VoicePhase = (typeof VOICE_PHASE)[keyof typeof VOICE_PHASE];

const VoiceRecordingPanel = ({ phase, level }: { phase: VoicePhase; level: number }) => {
  const { t } = useTranslation();
  const shouldReduceMotion = useReducedMotion();
  const transcribing = phase === VOICE_PHASE.TRANSCRIBING;
  return (
    <div
      className="relative flex min-h-8 w-full items-center justify-center py-1"
      data-testid="course-authoring-voice-panel"
      data-state={phase}
      aria-live="polite"
    >
      <motion.div
        animate={{ opacity: transcribing ? 0 : 1, scale: transcribing ? 0.92 : 1 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.25, ease: "easeOut" }}
      >
        <VoiceLevelBars voiceLevel={transcribing ? 0 : level} />
      </motion.div>
      <AnimatePresence>
        {transcribing && (
          <motion.span
            key="transcribing"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.2,
              delay: shouldReduceMotion ? 0 : 0.1,
            }}
            className="absolute inset-0 flex items-center justify-center gap-1.5 text-sm text-neutral-600"
          >
            <LoaderCircle
              className={cn("size-3.5 text-primary-600", !shouldReduceMotion && "animate-spin")}
              aria-hidden="true"
            />
            <span className="loading-text-shimmer">
              {t("courseAuthoring.composer.voiceTranscribing")}
            </span>
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
};

type Props = {
  instruction: string;
  disabled?: boolean;
  isSubmitting?: boolean;
  sendBlocked?: boolean;
  hasActiveGeneration?: boolean;
  onStopGeneration?: () => void;
  showExamples?: boolean;
  onInstructionChange: (value: string) => void;
  onSubmit: () => void;
  onPasteFile?: (file: File) => void;
  tools?: ReactNode;
  reasoningControl?: ReactNode;
  attachments?: ReactNode;
};

/** Renders the instruction field, examples, and send affordance without owning request state. */
export const AuthoringComposer = ({
  instruction,
  disabled,
  isSubmitting,
  sendBlocked = false,
  hasActiveGeneration = false,
  onStopGeneration,
  onInstructionChange,
  onSubmit,
  onPasteFile,
  tools,
  reasoningControl,
  attachments,
}: Props) => {
  const { t } = useTranslation();
  const inputId = useId();
  const shouldReduceMotion = useReducedMotion();
  const canStopGeneration = Boolean(hasActiveGeneration && onStopGeneration);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const instructionRef = useRef(instruction);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || isVoiceMode) return;
    // Match the previous composer: grow to four lines, then scroll longer instructions.
    textarea.style.height = "auto";
    const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
    const maxHeight = lineHeight * 4 + 8;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [instruction, isVoiceMode]);
  useEffect(() => {
    instructionRef.current = instruction;
  }, [instruction]);
  const setTranscribedInput = useCallback(
    (next: string | ((current: string) => string)) => {
      const value = typeof next === "function" ? next(instructionRef.current) : next;
      instructionRef.current = value;
      onInstructionChange(value);
    },
    [onInstructionChange],
  );
  const { startRecording, stopRecording, cancelTranscription } = useTranscription({
    setInput: setTranscribedInput,
    onLevelChange: setVoiceLevel,
  });
  const placeholders = useMemo(
    () => [
      t("courseAuthoring.composer.exampleOne"),
      t("courseAuthoring.composer.exampleTwo"),
      t("courseAuthoring.composer.exampleThree"),
    ],
    [t],
  );
  const currentPlaceholder = placeholders[placeholderIndex] ?? placeholders[0] ?? "";

  useEffect(() => {
    if (instruction.trim().length > 0 || isFocused || placeholders.length < 2) return;
    const interval = window.setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % placeholders.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [instruction, isFocused, placeholders.length]);

  /** Starts transcription without changing or submitting the typed author draft. */
  const startVoiceMode = async () => {
    setVoiceError(null);
    setVoiceBusy(true);
    const started = await startRecording();
    setVoiceBusy(false);
    if (started) {
      setIsVoiceMode(true);
      return;
    }
    setVoiceError(t("courseAuthoring.composer.voiceUnavailable"));
  };

  /** Stops transcription so its final transcript can be appended to the draft. */
  const stopVoiceMode = async () => {
    setVoiceBusy(true);
    try {
      await stopRecording();
    } catch {
      setVoiceError(t("courseAuthoring.composer.voiceUnavailable"));
    } finally {
      setVoiceBusy(false);
      setIsVoiceMode(false);
      setVoiceLevel(0);
    }
  };

  /** Cancels transcription and discards the in-progress utterance. */
  const cancelVoiceMode = async () => {
    setVoiceBusy(true);
    try {
      await cancelTranscription();
    } catch {
      setVoiceError(t("courseAuthoring.composer.voiceUnavailable"));
    } finally {
      setVoiceBusy(false);
      setIsVoiceMode(false);
      setVoiceLevel(0);
    }
  };

  const showReasoningControl = Boolean(reasoningControl) && !isVoiceMode;
  const canSend =
    !disabled &&
    !isSubmitting &&
    !sendBlocked &&
    !isVoiceMode &&
    !voiceBusy &&
    !hasActiveGeneration &&
    instruction.trim().length > 0;
  const submit = () => {
    if (canSend) onSubmit();
  };
  const primaryAction = match({ isVoiceMode, canStopGeneration })
    .with({ isVoiceMode: true }, () => ({
      onClick: () => void stopVoiceMode(),
      label: t("studentCourseView.lesson.aiMentorLesson.stopVoiceRecording"),
    }))
    .with({ canStopGeneration: true }, () => ({
      onClick: () => onStopGeneration?.(),
      label: t("courseAuthoring.conversation.stop"),
    }))
    .otherwise(() => ({ onClick: submit, label: t("courseAuthoring.composer.send") }));
  const voicePhase = voiceBusy ? VOICE_PHASE.TRANSCRIBING : VOICE_PHASE.LISTENING;
  const modeTransition = {
    initial: shouldReduceMotion ? false : { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" },
  } as const;

  return (
    <form
      className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 shadow-md"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`authoring-instruction-${inputId}`} className="sr-only">
        {t("courseAuthoring.composer.label")}
      </label>
      {attachments}
      <div className="grid grid-cols-[2rem_minmax(0,1fr)_auto_2rem_2rem] items-end gap-2">
        {isVoiceMode ? (
          <div className="size-8">
            <Button
              type="button"
              variant="ghost"
              className="size-8 rounded-lg p-0 text-neutral-700"
              disabled={voiceBusy}
              onClick={() => void cancelVoiceMode()}
              aria-label={t("studentCourseView.lesson.aiMentorLesson.closeVoiceMode")}
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <div className="size-8">{tools}</div>
        )}
        <div className={cn("relative min-h-0 min-w-0", !isVoiceMode && "pl-2")}>
          <motion.div
            className={cn("relative min-h-8", isVoiceMode && "pointer-events-none")}
            aria-hidden={isVoiceMode || undefined}
            initial={false}
            animate={isVoiceMode ? modeTransition.exit : modeTransition.animate}
            transition={modeTransition.transition}
          >
            <Textarea
              ref={textareaRef}
              data-testid={COURSE_AUTHORING_HANDLES.BRIEF_INPUT}
              id={`authoring-instruction-${inputId}`}
              value={instruction}
              disabled={disabled || isSubmitting || voiceBusy}
              tabIndex={isVoiceMode ? -1 : undefined}
              maxLength={20_000}
              rows={1}
              placeholder=""
              className="relative z-10 min-h-8 resize-none border-0 bg-transparent px-0 py-1 text-sm leading-6 shadow-none focus-visible:ring-0"
              onChange={(event) => onInstructionChange(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onPaste={(event) => {
                const file = event.clipboardData.files[0];
                if (!file || !onPasteFile) return;
                event.preventDefault();
                onPasteFile(file);
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing &&
                  !disabled &&
                  !isSubmitting &&
                  !sendBlocked &&
                  !voiceBusy &&
                  !hasActiveGeneration &&
                  instruction.trim()
                ) {
                  event.preventDefault();
                  onSubmit();
                }
              }}
            />
            {!instruction.trim() && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden py-1">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={currentPlaceholder}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: shouldReduceMotion ? 0 : 0.2 }}
                    className="block w-full overflow-hidden whitespace-pre-wrap break-words text-sm leading-6 text-neutral-500"
                  >
                    {shouldReduceMotion
                      ? currentPlaceholder
                      : currentPlaceholder.split("").map((char, index) => (
                          <motion.span
                            key={`${char}-${index}`}
                            initial={{ opacity: 0, x: -2 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.16, delay: index * 0.018 }}
                          >
                            {char}
                          </motion.span>
                        ))}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </motion.div>
          <AnimatePresence initial={false}>
            {isVoiceMode && (
              <motion.div
                key="voice"
                className="absolute inset-0 flex items-center justify-center"
                initial={modeTransition.initial}
                animate={modeTransition.animate}
                exit={modeTransition.exit}
                transition={modeTransition.transition}
              >
                <VoiceRecordingPanel phase={voicePhase} level={voiceLevel} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.div
          className="overflow-hidden"
          initial={false}
          animate={
            showReasoningControl
              ? { width: "auto", opacity: 1, visibility: "visible" }
              : { width: 0, opacity: 0, transitionEnd: { visibility: "hidden" } }
          }
          transition={{ duration: shouldReduceMotion ? 0 : 0.2, ease: "easeOut" }}
          aria-hidden={!showReasoningControl || undefined}
        >
          {reasoningControl}
        </motion.div>
        <div className="size-8">
          {!isVoiceMode && (
            <Button
              type="button"
              variant="ghost"
              className="size-8 rounded-lg p-0 text-neutral-700 hover:bg-primary-50 hover:text-primary-700"
              disabled={disabled || isSubmitting || voiceBusy}
              onClick={() => void startVoiceMode()}
              aria-label={t("studentCourseView.lesson.aiMentorLesson.toggleVoiceInput")}
            >
              <Mic className="size-4" />
            </Button>
          )}
        </div>
        <Button
          data-testid={COURSE_AUTHORING_HANDLES.BRIEF_SUBMIT_BUTTON}
          type="button"
          size="icon"
          variant="default"
          className="size-8 shrink-0 rounded-lg"
          disabled={
            disabled ||
            (!canStopGeneration && isSubmitting) ||
            (!canStopGeneration && sendBlocked) ||
            voiceBusy ||
            (!isVoiceMode && !hasActiveGeneration && instruction.trim().length === 0)
          }
          onClick={primaryAction.onClick}
          aria-label={primaryAction.label}
          title={
            !isVoiceMode && hasActiveGeneration && onStopGeneration
              ? t("courseAuthoring.conversation.stop")
              : undefined
          }
        >
          {isVoiceMode || canStopGeneration ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <ArrowUp className="size-4" />
          )}
        </Button>
      </div>
      {voiceError && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {voiceError}
        </p>
      )}
    </form>
  );
};
