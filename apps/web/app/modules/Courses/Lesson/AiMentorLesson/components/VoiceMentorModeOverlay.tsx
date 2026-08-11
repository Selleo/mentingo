import { VOICE_MODE_STATE, type VoiceModeState } from "@repo/shared";
import { BookOpen, ClipboardCheck, Mic, MicOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { AgentAudioVisualizerAura } from "~/components/agents-ui/agent-audio-visualizer-aura";
import { AgentAudioVisualizerWave } from "~/components/agents-ui/agent-audio-visualizer-wave";
import { Icon } from "~/components/Icon";
import Viewer from "~/components/RichText/Viever";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

const VOICE_VISUALIZER_COLOR = "var(--primary)";
const VOICE_ACTIVITY_THRESHOLD = 0.04;
const MOBILE_CONTROL_CLASS_NAME =
  "size-12 rounded-full bg-white text-primary-800 shadow-none transition-transform hover:scale-105 hover:bg-primary-50 hover:text-primary-800";
const MOBILE_CHECK_CLASS_NAME =
  "size-12 rounded-full shadow-none transition-transform hover:scale-105";

type VoiceMentorModeOverlayProps = {
  open: boolean;
  state: VoiceModeState;
  voiceLevel: number;
  mentorVoiceLevel: number;
  transcript: string;
  response: string;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  hasTaskDescription: boolean;
  taskDescription: string;
  onJudge: () => void;
  isJudgePending: boolean;
  isMicMuted: boolean;
  onMicMutedChange: (muted: boolean) => void;
  onExit: () => void;
};

type VoiceConversationMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function VoiceMentorAvatar({
  mentorName,
  mentorAvatarUrl,
}: {
  mentorName: string;
  mentorAvatarUrl?: string | null;
}) {
  if (mentorAvatarUrl) {
    return (
      <img src={mentorAvatarUrl} alt={mentorName} className="size-8 rounded-full object-cover" />
    );
  }

  return (
    <div className="flex size-10 items-center justify-center rounded-full bg-primary-100 shadow-sm ring-1 ring-primary-100">
      <Icon name="AiMentor" className="size-7 p-1 text-primary-600" aria-label={mentorName} />
    </div>
  );
}

function VoiceConversationBubble({
  message,
  mentorName,
  mentorAvatarUrl,
}: {
  message: VoiceConversationMessage;
  mentorName: string;
  mentorAvatarUrl?: string | null;
}) {
  if (message.role === "user") {
    return (
      <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary-700 px-4 py-3 text-sm leading-relaxed text-contrast shadow-sm">
        {message.content}
      </div>
    );
  }

  return (
    <div className="flex max-w-[86%] items-start gap-3">
      <div className="mt-1 shrink-0">
        <VoiceMentorAvatar mentorName={mentorName} mentorAvatarUrl={mentorAvatarUrl} />
      </div>
      <div className="rounded-2xl rounded-bl-md bg-white/90 px-4 py-3 text-sm leading-relaxed text-neutral-900 shadow-sm ring-1 ring-primary-100/80">
        {message.content}
      </div>
    </div>
  );
}

export function VoiceMentorModeOverlay({
  open,
  state,
  voiceLevel,
  mentorVoiceLevel,
  transcript,
  response,
  mentorName,
  mentorAvatarUrl,
  hasTaskDescription,
  taskDescription,
  onJudge,
  isJudgePending,
  isMicMuted,
  onMicMutedChange,
  onExit,
}: VoiceMentorModeOverlayProps) {
  const { t } = useTranslation();
  const [isTaskPanelOpen, setIsTaskPanelOpen] = useState(false);
  const stateTitle: Record<VoiceModeState, string> = {
    [VOICE_MODE_STATE.IDLE]: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.idle.title",
    ),
    [VOICE_MODE_STATE.LISTENING]: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.listening.title",
    ),
    [VOICE_MODE_STATE.THINKING]: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.thinking.title",
    ),
    [VOICE_MODE_STATE.SPEAKING]: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.speaking.title",
    ),
  };
  const isLocalVoiceActive = voiceLevel >= VOICE_ACTIVITY_THRESHOLD;
  const isListening =
    !isMicMuted && (state === VOICE_MODE_STATE.LISTENING || isLocalVoiceActive);
  const voiceVolume = !isMicMuted ? Math.max(0, Math.min(1, voiceLevel)) : 0;
  const mentorVolume =
    state === VOICE_MODE_STATE.SPEAKING ? Math.max(0, Math.min(1, mentorVoiceLevel)) : 0;
  const auraState = state === VOICE_MODE_STATE.SPEAKING ? "speaking" : "thinking";
  const micButtonVariant = isMicMuted ? "outline" : "primary";
  const micButtonLabel = isMicMuted
    ? t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.muted")
    : t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.micOn");
  const visibleBottomMessages = [
    transcript && {
      id: "voice-transcript",
      role: "user" as const,
      content: transcript,
    },
    response && {
      id: "voice-response",
      role: "assistant" as const,
      content: response,
    },
  ].filter((message): message is VoiceConversationMessage => Boolean(message));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="voice-mentor-overlay"
          data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-[radial-gradient(circle_at_top,var(--primary-100),transparent_52%),linear-gradient(180deg,var(--primary-50)_0%,#FFFFFF_100%)]"
        >
          <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 py-6 md:px-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="min-w-0 pr-56 sm:pr-0">
                <h2 className="truncate text-lg font-semibold text-neutral-900">{mentorName}</h2>
              </div>
              <div className="hidden shrink-0 flex-wrap items-center gap-2 sm:flex sm:justify-end">
                {hasTaskDescription && (
                  <Button
                    data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_TASK_BUTTON}
                    type="button"
                    variant="outline"
                    onClick={() => setIsTaskPanelOpen((open) => !open)}
                    className="h-10 min-w-28 gap-2 rounded-xl bg-white/85 px-4"
                    aria-pressed={isTaskPanelOpen}
                  >
                    <BookOpen className="size-4" />
                    {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                  </Button>
                )}
                <Button
                  data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_CHECK_BUTTON}
                  type="button"
                  variant="primary"
                  onClick={onJudge}
                  disabled={isJudgePending}
                  className="h-10 min-w-28 gap-2 rounded-xl px-4"
                >
                  <ClipboardCheck className="size-4" />
                  {t("studentCourseView.lesson.aiMentorLesson.check")}
                </Button>
                <Button
                  type="button"
                  variant={micButtonVariant}
                  aria-pressed={!isMicMuted}
                  aria-label={
                    isMicMuted
                      ? t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.unmute")
                      : t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.mute")
                  }
                  onClick={() => onMicMutedChange(!isMicMuted)}
                  className={cn("h-10 min-w-28 gap-2 rounded-xl px-4", {
                    "bg-white/85": isMicMuted,
                  })}
                >
                  {isMicMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                  {micButtonLabel}
                </Button>
                <Button
                  data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_EXIT_BUTTON}
                  variant="outline"
                  onClick={onExit}
                  className="h-10 min-w-28 gap-2 rounded-xl bg-white/85 px-4"
                >
                  <X className="size-4" />
                  {t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.exit")}
                </Button>
              </div>
            </div>

            <div className="relative flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
                <motion.div
                  key={state}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-center"
                >
                  <h3 className="text-xl font-semibold text-neutral-900">{stateTitle[state]}</h3>
                </motion.div>

                <div className="relative flex min-h-56 w-full items-center justify-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="relative flex size-64 items-center justify-center"
                  >
                    <motion.div
                      aria-hidden={!isListening}
                      animate={{ opacity: isListening ? 1 : 0 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <AgentAudioVisualizerWave
                        state="speaking"
                        size="lg"
                        color={VOICE_VISUALIZER_COLOR}
                        colorShift={0.08}
                        lineWidth={2}
                        blur={0.75}
                        volumeOverride={voiceVolume}
                        className="w-80"
                      />
                    </motion.div>
                    <motion.div
                      aria-hidden={isListening}
                      animate={{ opacity: isListening ? 0 : 1 }}
                      transition={{ duration: 0.22, ease: "easeOut" }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <AgentAudioVisualizerAura
                        state={auraState}
                        size="lg"
                        color={VOICE_VISUALIZER_COLOR}
                        colorShift={0}
                        themeMode="light"
                        volumeOverride={mentorVolume}
                        className="scale-110"
                      />
                    </motion.div>
                  </motion.div>
                </div>

                <div className="mx-auto grid w-full max-w-3xl gap-4">
                  {visibleBottomMessages.map((message) => (
                    <VoiceConversationBubble
                      key={message.id}
                      message={message}
                      mentorName={mentorName}
                      mentorAvatarUrl={mentorAvatarUrl}
                    />
                  ))}
                </div>
              </div>

              <AnimatePresence initial={false}>
                {isTaskPanelOpen && hasTaskDescription && (
                  <motion.aside
                    data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_TASK_PANEL}
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    transformTemplate={(_, generated) =>
                      `translateY(var(--task-panel-offset-y)) ${generated}`
                    }
                    className="fixed bottom-0 left-0 right-0 top-auto z-50 flex max-h-[85dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-t-xl border-x-0 border-b-0 border-neutral-200 bg-background p-0 shadow-lg [--task-panel-offset-y:0px] md:bottom-auto md:left-auto md:right-4 md:top-1/2 md:max-h-[82vh] md:w-[28rem] md:max-w-[calc(100vw-2rem)] md:rounded-lg md:border md:[--task-panel-offset-y:-50%]"
                  >
                    <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
                      <h3 className="text-lg font-semibold leading-none tracking-tight text-neutral-950">
                        {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsTaskPanelOpen(false)}
                        aria-label={t("common.button.close")}
                        className="size-8 rounded-lg p-0"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                    <div className="min-h-0 overflow-y-auto px-6 py-5 text-left text-sm leading-relaxed text-neutral-800">
                      <Viewer content={taskDescription} />
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="fixed right-5 top-5 z-[60] flex items-center gap-2 sm:hidden">
            {hasTaskDescription && (
              <Button
                data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_TASK_BUTTON}
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={isTaskPanelOpen}
                aria-label={t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                onClick={() => setIsTaskPanelOpen((open) => !open)}
                className={MOBILE_CONTROL_CLASS_NAME}
              >
                <BookOpen className="size-5" />
              </Button>
            )}
            <Button
              data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_CHECK_BUTTON}
              type="button"
              variant="primary"
              size="icon"
              aria-label={t("studentCourseView.lesson.aiMentorLesson.check")}
              onClick={onJudge}
              disabled={isJudgePending}
              className={MOBILE_CHECK_CLASS_NAME}
            >
              <ClipboardCheck className="size-5" />
            </Button>
            <Button
              data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MUTE_BUTTON}
              type="button"
              variant="ghost"
              size="icon"
              aria-pressed={!isMicMuted}
              aria-label={
                isMicMuted
                  ? t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.unmute")
                  : t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.mute")
              }
              onClick={() => onMicMutedChange(!isMicMuted)}
              className={MOBILE_CONTROL_CLASS_NAME}
            >
              {isMicMuted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </Button>
            <Button
              data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_MOBILE_EXIT_BUTTON}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.exit")}
              onClick={onExit}
              className={MOBILE_CONTROL_CLASS_NAME}
            >
              <X className="size-5" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
