import { VOICE_MODE_STATE, type VoiceModeState } from "@repo/shared";
import { BookOpen, Mic, MicOff, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { AgentAudioVisualizerAura } from "~/components/agents-ui/agent-audio-visualizer-aura";
import { AgentAudioVisualizerWave } from "~/components/agents-ui/agent-audio-visualizer-wave";
import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

const VOICE_VISUALIZER_COLOR = "var(--primary)";

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
  onOpenTaskDescription: () => void;
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
  onOpenTaskDescription,
  isMicMuted,
  onMicMutedChange,
  onExit,
}: VoiceMentorModeOverlayProps) {
  const { t } = useTranslation();
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
  const isListening = state === VOICE_MODE_STATE.LISTENING && !isMicMuted;
  const voiceVolume = isListening ? Math.max(0, Math.min(1, voiceLevel)) : 0;
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
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-neutral-900">{mentorName}</h2>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {hasTaskDescription && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenTaskDescription}
                    className="h-10 min-w-28 gap-2 rounded-xl bg-white/85 px-4"
                  >
                    <BookOpen className="size-4" />
                    {t("studentCourseView.lesson.aiMentorLesson.taskButton")}
                  </Button>
                )}
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

            <div className="flex flex-1 flex-col justify-center gap-5">
              <motion.div
                key={state}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="text-center"
              >
                <h3 className="text-xl font-semibold text-neutral-900">{stateTitle[state]}</h3>
              </motion.div>

              <div className="relative flex min-h-56 items-center justify-center">
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
