import { VOICE_MODE_STATE, type VoiceModeState } from "@repo/shared";
import { AudioLines, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslation } from "react-i18next";

import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { VoiceLevelBars } from "~/modules/Voice/components/VoiceLevelBars";

import { LEARNING_HANDLES } from "../../../../../../e2e/data/learning/handles";

type VoiceMentorModeOverlayProps = {
  open: boolean;
  state: VoiceModeState;
  voiceLevel: number;
  transcript: string;
  response: string;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  onExit: () => void;
};

export function VoiceMentorModeOverlay({
  open,
  state,
  voiceLevel,
  transcript,
  response,
  mentorName,
  mentorAvatarUrl,
  onExit,
}: VoiceMentorModeOverlayProps) {
  const { t } = useTranslation();
  const stateMeta: Record<VoiceModeState, { title: string; subtitle: string }> = {
    [VOICE_MODE_STATE.IDLE]: {
      title: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.idle.title"),
      subtitle: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.idle.subtitle"),
    },
    [VOICE_MODE_STATE.LISTENING]: {
      title: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.listening.title"),
      subtitle: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.listening.subtitle"),
    },
    [VOICE_MODE_STATE.THINKING]: {
      title: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.thinking.title"),
      subtitle: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.thinking.subtitle"),
    },
    [VOICE_MODE_STATE.SPEAKING]: {
      title: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.speaking.title"),
      subtitle: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.states.speaking.subtitle"),
    },
  };
  const meta = stateMeta[state];
  const isSpeaking = state === VOICE_MODE_STATE.SPEAKING;
  const isThinking = state === VOICE_MODE_STATE.THINKING;
  const showVoiceBars = state === VOICE_MODE_STATE.LISTENING || state === VOICE_MODE_STATE.SPEAKING;
  const speakingPulsePeak = 1 + Math.min(0.06, voiceLevel / 1000);

  return (
    <AnimatePresence>
      {open ? (
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
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700/70">
                  {t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.headerEyebrow")}
                </p>
                <h2 className="text-lg font-semibold text-neutral-900">{mentorName}</h2>
              </div>
              <Button
                data-testid={LEARNING_HANDLES.AI_MENTOR_VOICE_OVERLAY_EXIT_BUTTON}
                variant="outline"
                onClick={onExit}
                className="gap-2 rounded-xl bg-white/85"
              >
                <X className="size-4" />
                {t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.exit")}
              </Button>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8">
              <div className="relative flex items-center justify-center py-4">
                <motion.div
                  className="absolute size-56 rounded-full border-2 border-primary/70"
                  animate={
                    isSpeaking || isThinking
                      ? {
                          scale: isThinking
                            ? [1, 1, 1.03, 1.03, 1.06, 1.06, 1]
                            : [1, speakingPulsePeak, 1.01, speakingPulsePeak + 0.01, 1],
                          opacity: isThinking
                            ? [0.36, 0.36, 0.46, 0.46, 0.56, 0.56, 0.36]
                            : [0.45, 0.62, 0.5, 0.62, 0.45],
                        }
                      : undefined
                  }
                  transition={
                    isSpeaking || isThinking
                      ? {
                          duration: isThinking ? 2.4 : 0.58,
                          repeat: Infinity,
                          ease: "linear",
                          times: isThinking
                            ? [0, 0.12, 0.28, 0.42, 0.58, 0.72, 1]
                            : [0, 0.18, 0.45, 0.72, 1],
                        }
                      : undefined
                  }
                />
                <motion.div
                  className="absolute size-48 rounded-full border-2 border-primary/50"
                  animate={
                    isSpeaking || isThinking
                      ? {
                          scale: isThinking
                            ? [1, 1, 1.04, 1.04, 1.08, 1.08, 1]
                            : [1, speakingPulsePeak + 0.02, 1.01, speakingPulsePeak + 0.015, 1],
                          opacity: isThinking
                            ? [0.22, 0.22, 0.32, 0.32, 0.42, 0.42, 0.22]
                            : [0.32, 0.5, 0.36, 0.5, 0.32],
                        }
                      : undefined
                  }
                  transition={
                    isSpeaking || isThinking
                      ? {
                          duration: isThinking ? 2.4 : 0.58,
                          repeat: Infinity,
                          ease: "linear",
                          times: isThinking
                            ? [0, 0.12, 0.28, 0.42, 0.58, 0.72, 1]
                            : [0, 0.18, 0.45, 0.72, 1],
                          delay: isThinking ? 0.2 : 0.07,
                        }
                      : undefined
                  }
                />

                <motion.div
                  className={cn(
                    "relative z-10 flex size-44 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary-500 via-primary-600 to-primary-800 shadow-xl shadow-primary-100",
                  )}
                  animate={
                    isThinking
                      ? {
                          scale: [1, 1, 1.02, 1.02, 1.035, 1.035, 1],
                        }
                      : undefined
                  }
                  transition={
                    isThinking
                      ? {
                          duration: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          times: [0, 0.12, 0.28, 0.42, 0.58, 0.72, 1],
                        }
                      : undefined
                  }
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    animate={{ x: ["-100%", "220%"] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                  />

                  <div className="relative z-10">
                    {showVoiceBars ? (
                      <div className="w-24">
                        <VoiceLevelBars voiceLevel={voiceLevel} barClassName="bg-contrast" />
                      </div>
                    ) : state === VOICE_MODE_STATE.THINKING ? (
                      <motion.div
                        animate={{
                          scale: [1, 1, 1.1, 1.1, 1.16, 1.16, 1],
                          opacity: [0.82, 0.82, 0.92, 0.92, 1, 1, 0.82],
                        }}
                        transition={{
                          duration: 2.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          times: [0, 0.12, 0.28, 0.42, 0.58, 0.72, 1],
                        }}
                      >
                        <Sparkles className="size-12 text-white" />
                      </motion.div>
                    ) : (
                      <AudioLines className="size-12 text-white" />
                    )}
                  </div>
                </motion.div>
              </div>

              <motion.div
                key={state}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className="text-center"
              >
                <h3 className="text-4xl font-semibold text-neutral-900">{meta.title}</h3>
                <p className="mt-2 text-base text-neutral-600">{meta.subtitle}</p>
              </motion.div>

              <div className="grid w-full max-w-3xl gap-3">
                {transcript ? (
                  <Card className="rounded-2xl border-primary-200/80 bg-white/85 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">
                      {t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.youSaid")}
                    </p>
                    <p className="text-sm leading-relaxed text-neutral-900">{transcript}</p>
                  </Card>
                ) : null}

                {response ? (
                  <Card className="rounded-2xl border-primary-300/80 bg-primary-50/90 p-4">
                    <div className="mb-2 flex items-center gap-2">
                      {mentorAvatarUrl ? (
                        <img
                          src={mentorAvatarUrl}
                          alt={mentorName}
                          className="size-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="size-6 rounded-full bg-primary-300" />
                      )}
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-700">
                        {mentorName}
                      </p>
                    </div>
                    <p className="text-sm leading-relaxed text-neutral-900">{response}</p>
                  </Card>
                ) : (
                  <Card className="rounded-2xl border-dashed border-primary-300/70 bg-white/65 p-4">
                    <p className="text-sm text-neutral-600">
                      {state === VOICE_MODE_STATE.THINKING
                        ? t(
                            "studentCourseView.lesson.aiMentorLesson.voiceOverlay.responsePlaceholder.thinking",
                          )
                        : state === VOICE_MODE_STATE.LISTENING
                          ? t(
                              "studentCourseView.lesson.aiMentorLesson.voiceOverlay.responsePlaceholder.listening",
                            )
                          : t(
                              "studentCourseView.lesson.aiMentorLesson.voiceOverlay.responsePlaceholder.default",
                            )}
                    </p>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
