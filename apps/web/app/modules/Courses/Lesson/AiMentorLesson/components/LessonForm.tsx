import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useLumaConfigured } from "~/api/queries/useLumaConfigured";
import { LessonComposerCenterContent } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerCenterContent";
import { LessonComposerLeftControl } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerLeftControl";
import { LessonComposerRightControls } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonComposerRightControls";
import { LessonEmojiPicker } from "~/modules/Courses/Lesson/AiMentorLesson/components/LessonEmojiPicker";
import { VoiceMentorModeOverlay } from "~/modules/Courses/Lesson/AiMentorLesson/components/VoiceMentorModeOverlay";
import { useTranscription } from "~/modules/Voice/hooks/useTranscription";
import { useVoiceMentor } from "~/modules/Voice/hooks/useVoiceMentor";
import { useVoiceModeUIState } from "~/modules/Voice/hooks/useVoiceModeUIState";

import type { Message } from "@ai-sdk/react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";

interface LessonFormProps {
  lessonId: string;
  mentorName: string;
  mentorAvatarUrl?: string | null;
  handleSubmit: () => void;
  onMentorTranscription?: (text: string) => void;
  onMentorResponseCompleted?: (text: string) => void;
  onAudioOutputCompleted?: () => void;
  onAudioInterrupted?: () => void;
  input: string;
  handleInputChange: (e: ChangeEvent<HTMLInputElement> | ChangeEvent<HTMLTextAreaElement>) => void;
  setInput: Dispatch<SetStateAction<string>>;
  messages: Message[];
}

export const LessonForm = ({
  lessonId,
  mentorName,
  mentorAvatarUrl,
  handleSubmit,
  onMentorTranscription,
  onMentorResponseCompleted,
  onAudioOutputCompleted,
  onAudioInterrupted,
  input,
  handleInputChange,
  setInput,
  messages,
}: LessonFormProps) => {
  const { t } = useTranslation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [isVoiceMentorAudioStarted, setIsVoiceMentorAudioStarted] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0);
  const [latestTranscript, setLatestTranscript] = useState("");
  const [latestResponse, setLatestResponse] = useState("");
  const { data: lumaConfigured } = useLumaConfigured();
  const canUseVoiceMentor = Boolean(lumaConfigured?.voiceMentorEnabled);
  const voiceModeUI = useVoiceModeUIState();

  const emojiRef = useRef<HTMLDivElement | null>(null);
  const hasTriggeredWelcomeRef = useRef(false);
  const triggerWelcomeMessageRef = useRef<(message: string) => Promise<boolean>>(async () => false);
  const toggleEmojiPicker = () => setShowEmojiPicker((prev) => !prev);

  const { startRecording, stopRecording, cancelTranscription } = useTranscription({
    setInput,
    onLevelChange: setVoiceLevel,
  });
  const {
    isRecording: isVoiceMentorMode,
    startVoiceMentor,
    cancelVoiceMentor,
    triggerWelcomeMessage,
  } = useVoiceMentor({
    lessonId,
    setInput,
    onLevelChange: setVoiceLevel,
    onMentorTranscription: (text) => {
      setLatestTranscript(text);
      voiceModeUI.onMentorTranscriptionReceived();
      onMentorTranscription?.(text);
    },
    onMentorResponseCompleted: (text) => {
      setLatestResponse(text);
      onMentorResponseCompleted?.(text);
    },
    onAudioStarted: () => {
      setIsVoiceMentorAudioStarted(true);
    },
    onAudioOutputCompleted: () => {
      voiceModeUI.onAudioOutputCompleted(isVoiceMentorMode);
      onAudioOutputCompleted?.();
    },
    onAudioInterrupted: () => {
      voiceModeUI.onAudioInterrupted(isVoiceMentorMode);
      onAudioInterrupted?.();
    },
    onSpeechChunkSent: () => {
      voiceModeUI.onUserSpeechChunkSent();
    },
    onAudioChunkReceived: () => {
      voiceModeUI.onAudioChunkReceived();
    },
  });

  useEffect(() => {
    if (!showEmojiPicker) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    triggerWelcomeMessageRef.current = triggerWelcomeMessage;
  }, [triggerWelcomeMessage]);

  useEffect(() => {
    if (!isVoiceMentorMode || !isVoiceMentorAudioStarted) {
      return;
    }

    if (hasTriggeredWelcomeRef.current) {
      return;
    }

    if (messages.length !== 1 || messages[0]?.role !== "assistant") {
      return;
    }

    hasTriggeredWelcomeRef.current = true;
    void triggerWelcomeMessageRef.current(messages[0].content);
  }, [isVoiceMentorAudioStarted, isVoiceMentorMode, messages]);

  const startVoiceMode = async () => {
    if (isVoiceMentorMode) {
      const canceledMentor = await cancelVoiceMentor();
      if (canceledMentor) {
        voiceModeUI.onMicCaptureStopped();
      }
    }
    setShowEmojiPicker(false);
    const hasStarted = await startRecording();
    if (!hasStarted) return;

    setIsVoiceMode(true);
    setLatestTranscript("");
    setLatestResponse("");
    voiceModeUI.onMicCaptureStarted();
  };

  const stopVoiceMode = async () => {
    await stopRecording();
    setIsVoiceMode(false);
    setVoiceLevel(0);
    voiceModeUI.onMicCaptureStopped();
  };

  const cancelVoiceMode = async () => {
    await cancelTranscription();
    setIsVoiceMode(false);
    setVoiceLevel(0);
    voiceModeUI.onMicCaptureStopped();
  };

  const startVoiceMentorMode = async () => {
    if (!canUseVoiceMentor) {
      return;
    }

    if (isVoiceMode) {
      await cancelVoiceMode();
    }
    hasTriggeredWelcomeRef.current = false;
    setIsVoiceMentorAudioStarted(false);
    setShowEmojiPicker(false);
    const started = await startVoiceMentor();
    if (!started) {
      return;
    }

    setLatestTranscript("");
    setLatestResponse("");
    voiceModeUI.onMicCaptureStarted();
  };

  const stopVoiceMentorMode = async () => {
    const canceled = await cancelVoiceMentor();
    if (!canceled) {
      return;
    }

    voiceModeUI.onMicCaptureStopped();
    setVoiceLevel(0);
  };

  const closeVoiceOverlay = async () => {
    if (isVoiceMentorMode) {
      await stopVoiceMentorMode();
      return;
    }

    if (isVoiceMode) {
      await cancelVoiceMode();
    }
  };

  return (
    <div className="mt-8 w-full relative">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isVoiceMode) {
            void stopVoiceMode();
            return;
          }
          handleSubmit();
        }}
      >
        <div className="flex w-full flex-col rounded-2xl border border-[#E4E6EB] bg-[#F5F6F7] px-6 py-4">
          <div>
            <LessonComposerCenterContent
              isVoiceMode={isVoiceMode}
              input={input}
              placeholder={t("studentCourseView.lesson.aiMentorLesson.sendMessage")}
              voiceLevel={voiceLevel}
              onInputChange={handleInputChange as (e: ChangeEvent<HTMLTextAreaElement>) => void}
              onSubmit={handleSubmit}
            />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LessonComposerLeftControl
                isVoiceMode={isVoiceMode}
                onCloseVoiceMode={() => void cancelVoiceMode()}
                onToggleEmojiPicker={toggleEmojiPicker}
                closeVoiceModeLabel={t("studentCourseView.lesson.aiMentorLesson.closeVoiceMode")}
                addEmojiLabel={t("studentCourseView.lesson.aiMentorLesson.addEmoji")}
              />
            </div>
            <LessonComposerRightControls
              isVoiceMode={isVoiceMode}
              isVoiceMentorMode={isVoiceMentorMode}
              canSubmit={Boolean(input.trim())}
              canUseVoiceMentor={canUseVoiceMentor}
              onStartVoiceMode={() => void startVoiceMode()}
              onStopVoiceMode={() => void stopVoiceMode()}
              onStartVoiceMentor={() => void startVoiceMentorMode()}
              onStopVoiceMentor={() => void stopVoiceMentorMode()}
              onSubmit={handleSubmit}
              sendLabel={t("studentCourseView.lesson.aiMentorLesson.send")}
              toggleVoiceInputLabel={t("studentCourseView.lesson.aiMentorLesson.toggleVoiceInput")}
              startVoiceMentorLabel={t("studentCourseView.lesson.aiMentorLesson.startVoiceMentor")}
              stopVoiceRecordingLabel={t(
                "studentCourseView.lesson.aiMentorLesson.stopVoiceRecording",
              )}
            />
          </div>

          {showEmojiPicker && !isVoiceMode && (
            <div className="absolute bottom-16 left-0" ref={emojiRef}>
              <LessonEmojiPicker setInput={setInput} input={input} />
            </div>
          )}
        </div>
      </form>

      <VoiceMentorModeOverlay
        open={isVoiceMentorMode}
        state={voiceModeUI.voiceModeState}
        voiceLevel={voiceLevel}
        transcript={latestTranscript}
        response={latestResponse}
        mentorName={mentorName}
        mentorAvatarUrl={mentorAvatarUrl}
        onExit={() => void closeVoiceOverlay()}
      />
    </div>
  );
};
