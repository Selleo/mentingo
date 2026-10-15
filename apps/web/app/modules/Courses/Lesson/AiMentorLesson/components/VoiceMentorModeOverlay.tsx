import {
  VOICE_TRANSCRIPT_ROLE,
  VoiceMentorModeOverlay as VoiceSessionOverlay,
  type VoiceSessionLabelsInput,
  type VoiceTranscriptMessage,
} from "@mentingo/voice";
import {
  getUiMessageText,
  MESSAGE_ROLE,
  VOICE_MODE_STATE,
  type VoiceModeState,
} from "@repo/shared";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { useCurrentUserSuspense } from "~/api/queries";
import Viewer from "~/components/RichText/Viever";

import type { UIMessage } from "@ai-sdk/react";
import type { VoiceConnectionState } from "~/modules/Voice/audio-stream.types";
import type {
  LearnerTranscriptRevision,
  MentorSpeechPresentation,
} from "~/modules/Voice/voice-mentor-presentation.types";

type VoiceMentorModeOverlayProps = {
  open: boolean;
  state: VoiceModeState;
  voiceLevel: number;
  mentorVoiceLevel: number;
  learnerTranscript: LearnerTranscriptRevision | null;
  response: string;
  mentorSpeech: MentorSpeechPresentation | null;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  messages?: UIMessage[];
  hasTaskDescription: boolean;
  taskDescription: string;
  onJudge: () => void;
  isJudgePending: boolean;
  canJudge?: boolean;
  isMicMuted: boolean;
  connectionState: VoiceConnectionState;
  isRestarting: boolean;
  onMicMutedChange: (muted: boolean) => void;
  onRestart: () => void;
  onExit: () => void;
};

const TRANSCRIPT_ROLES: Partial<Record<UIMessage["role"], VoiceTranscriptMessage["role"]>> = {
  [MESSAGE_ROLE.USER]: VOICE_TRANSCRIPT_ROLE.LEARNER,
  [MESSAGE_ROLE.MENTOR]: VOICE_TRANSCRIPT_ROLE.MENTOR,
};

export function VoiceMentorModeOverlay({
  messages,
  hasTaskDescription,
  taskDescription,
  ...props
}: VoiceMentorModeOverlayProps) {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUserSuspense();
  const learnerName =
    `${currentUser?.firstName ?? ""} ${currentUser?.lastName ?? ""}`.trim() ||
    t("studentCourseView.lesson.aiMentorLesson.userName");

  const transcriptMessages = useMemo(
    () =>
      messages?.flatMap((message) => {
        const role = TRANSCRIPT_ROLES[message.role];
        return role ? [{ id: message.id, role, text: getUiMessageText(message) }] : [];
      }),
    [messages],
  );

  const labels: VoiceSessionLabelsInput = {
    states: {
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
    },
    task: t("studentCourseView.lesson.aiMentorLesson.taskButton"),
    check: t("studentCourseView.lesson.aiMentorLesson.check"),
    micOn: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.micOn"),
    muted: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.muted"),
    mute: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.mute"),
    unmute: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.unmute"),
    exit: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.exit"),
    close: t("common.button.close"),
    recoveryFailedTitle: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.recovery.failedTitle",
    ),
    recoveryFailedDescription: t(
      "studentCourseView.lesson.aiMentorLesson.voiceOverlay.recovery.failedDescription",
    ),
    restart: t("studentCourseView.lesson.aiMentorLesson.voiceOverlay.recovery.restart"),
  };

  return (
    <VoiceSessionOverlay
      {...props}
      messages={transcriptMessages}
      learnerName={learnerName}
      learnerAvatarUrl={currentUser?.profilePictureUrl}
      taskContent={
        hasTaskDescription ? <Viewer content={taskDescription} style="prose" /> : undefined
      }
      labels={labels}
    />
  );
}
