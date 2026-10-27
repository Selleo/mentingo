import { VoiceLevelBars } from "@mentingo/voice";
import { ArrowUp, LoaderCircle, Mic, Square, X } from "lucide-react";
import { useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";
import { DICTATION_PHASES } from "~/modules/Voice/dictation.constants";
import { useTextDictation } from "~/modules/Voice/hooks/useTextDictation";

import { ASSISTANT_HANDLES } from "../../../../e2e/data/assistant/handles";

const MAX_MESSAGE_LENGTH = 8000;
type AssistantComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  running: boolean;
  submitting: boolean;
  cancelling: boolean;
  disabled?: boolean;
  compact?: boolean;
};

export function AssistantComposer({
  value,
  onChange,
  onSend,
  onCancel,
  running,
  submitting,
  cancelling,
  disabled,
  compact = false,
}: AssistantComposerProps) {
  const { t } = useTranslation();
  const composing = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  }, [value]);
  const {
    phase: voicePhase,
    voiceLevel,
    error: voiceError,
    isBusy: voiceBusy,
    isRecording: recording,
    showVoicePanel,
    isIdle,
    start: startVoice,
    stop: stopVoice,
    cancel: cancelVoice,
  } = useTextDictation({ value, onChange, blocked: disabled || running || submitting });
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend =
    Boolean(value.trim()) && !tooLong && !disabled && !submitting && !running && !voiceBusy;
  const submit = () => {
    if (canSend && isIdle() && valueRef.current.length <= MAX_MESSAGE_LENGTH) onSend();
  };

  useLayoutEffect(() => {
    const element = textareaRef.current;
    if (!element || showVoicePanel) return;
    const resize = () => {
      const styles = window.getComputedStyle(element);
      const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
      const verticalPadding =
        (Number.parseFloat(styles.paddingTop) || 0) +
        (Number.parseFloat(styles.paddingBottom) || 0);
      const maxHeight = lineHeight * 6 + verticalPadding;
      element.style.height = "auto";
      element.style.height = `${Math.min(element.scrollHeight, maxHeight)}px`;
      element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
    };
    resize();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", resize);
      return () => window.removeEventListener("resize", resize);
    }
    let width = element.getBoundingClientRect().width;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width === width) return;
      width = entry.contentRect.width;
      resize();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [showVoicePanel, value]);

  return (
    <div
      className={cn("mx-auto w-full", {
        "max-w-[800px] px-4 pb-5 pt-4 sm:px-10 sm:pb-8": !compact,
        "px-4 pb-4 pt-2": compact,
      })}
    >
      <form
        className="rounded-2xl border border-border bg-background px-3 py-3 shadow-md"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Textarea
              ref={textareaRef}
              data-testid={ASSISTANT_HANDLES.COMPOSER}
              aria-label={t("assistant.composerLabel")}
              aria-invalid={tooLong || undefined}
              placeholder={t("assistant.placeholder")}
              value={value}
              onChange={(event) => {
                valueRef.current = event.target.value;
                onChange(event.target.value);
              }}
              onCompositionStart={() => {
                composing.current = true;
              }}
              onCompositionEnd={() => {
                composing.current = false;
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !composing.current &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  submit();
                }
              }}
              disabled={disabled || submitting || voiceBusy}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={1}
              className={cn(
                "min-h-8 flex-1 resize-none border-0 bg-transparent px-2 py-1 text-sm leading-6 text-foreground placeholder:text-neutral-500 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
                { hidden: showVoicePanel },
              )}
            />
            {showVoicePanel && (
              <div
                role="status"
                aria-live="polite"
                className="flex min-h-8 items-center justify-center gap-2 py-1 text-sm text-muted-foreground"
              >
                {recording ? (
                  <VoiceLevelBars voiceLevel={voiceLevel} />
                ) : (
                  <>
                    <LoaderCircle
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {t("courseAuthoring.composer.voiceTranscribing")}
                  </>
                )}
              </div>
            )}
          </div>
          {showVoicePanel ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => void cancelVoice()}
              disabled={voicePhase === DICTATION_PHASES.CANCELLING}
              aria-label={t("studentCourseView.lesson.aiMentorLesson.closeVoiceMode")}
            >
              <X className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-lg"
              onClick={() => void startVoice()}
              disabled={disabled || submitting || running || voiceBusy}
              aria-label={t("studentCourseView.lesson.aiMentorLesson.toggleVoiceInput")}
            >
              {voicePhase === DICTATION_PHASES.STARTING ? (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          )}
          {running ? (
            <Button
              type="button"
              size="icon"
              variant="default"
              onClick={onCancel}
              disabled={cancelling}
              aria-label={t("assistant.stop")}
              data-testid={ASSISTANT_HANDLES.CANCEL}
              className="size-8 shrink-0 rounded-lg"
            >
              {cancelling ? (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              ) : (
                <Square className="size-3.5 fill-current" />
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={() => {
                if (recording) void stopVoice();
                else submit();
              }}
              disabled={recording ? false : !canSend}
              aria-label={
                recording
                  ? t("studentCourseView.lesson.aiMentorLesson.stopVoiceRecording")
                  : t("assistant.send")
              }
              data-testid={ASSISTANT_HANDLES.SEND}
              className="size-8 shrink-0 rounded-lg"
            >
              {recording && <Square className="size-3.5 fill-current" />}
              {!recording && submitting && (
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
              )}
              {!recording && !submitting && <ArrowUp className="size-4" />}
            </Button>
          )}
        </div>
        {voiceError && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {t("courseAuthoring.composer.voiceUnavailable")}
          </p>
        )}
        {tooLong && (
          <p role="alert" className="mt-2 text-xs text-destructive">
            {t("assistant.messageTooLong")}
          </p>
        )}
      </form>
      <p className="mx-auto mt-3 max-w-lg text-center text-[11px] leading-4 text-neutral-500 dark:text-neutral-400">
        {t("assistant.disclosure")}
      </p>
    </div>
  );
}
