import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

import { RealtimePCMPlayer } from "../audio-player";
import { RealtimePCMStreamerWorklet } from "../audio-stream";
import { VOICE_CONNECTION_STATE, type VoiceConnectionState } from "../audio-stream.types";
import { acceptMentorSpeechAlignment, resolveActiveWordIndex } from "../voice-mentor-presentation";
import { voiceSocketProtocol } from "../voiceSocketProtocol";

import {
  createVoiceMentorSocketHandlers,
  SUPPORTED_VOICE_MENTOR_SOCKET_EVENTS,
} from "./voiceMentorSocketHandlers";
import {
  createVoiceMentorTurnState,
  finalizeVoiceMentorTurnIfReady,
  VOICE_TURN_INACTIVITY_TIMEOUT_MS,
} from "./voiceMentorTurnState";

import type { StreamProtocol } from "../audio-stream";
import type {
  LearnerTranscriptRevision,
  MentorSpeechAlignment,
  MentorSpeechPresentation,
} from "../voice-mentor-presentation.types";
import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

type VoiceMentorProps = {
  lessonId: string;
  setInput: Dispatch<SetStateAction<string>>;
  onLevelChange: (level: number) => void;
  onLearnerTranscription?: (revision: LearnerTranscriptRevision) => void;
  onMentorResponseDelta?: (text: string) => void;
  onMentorResponseCompleted?: (text: string) => void;
  onAudioStarted?: () => void;
  onAudioOutputCompleted?: () => void;
  onAudioInterrupted?: () => void;
  onSpeechChunkSent?: () => void;
  onMentorAudioLevel?: (level: number) => void;
};

export function useVoiceMentor({
  lessonId,
  setInput,
  onLevelChange,
  onLearnerTranscription,
  onMentorResponseDelta,
  onMentorResponseCompleted,
  onAudioStarted,
  onAudioOutputCompleted,
  onAudioInterrupted,
  onSpeechChunkSent,
  onMentorAudioLevel,
}: VoiceMentorProps) {
  const streamerRef = useRef<RealtimePCMStreamerWorklet | null>(null);
  const audioPlayerRef = useRef<RealtimePCMPlayer | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const turnStateRef = useRef(createVoiceMentorTurnState());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLevelChangeRef = useRef(onLevelChange);
  const setInputRef = useRef(setInput);
  const onLearnerTranscriptionRef = useRef(onLearnerTranscription);
  const onMentorResponseDeltaRef = useRef(onMentorResponseDelta);
  const onMentorResponseCompletedRef = useRef(onMentorResponseCompleted);
  const onAudioStartedRef = useRef(onAudioStarted);
  const onAudioOutputCompletedRef = useRef(onAudioOutputCompleted);
  const onAudioInterruptedRef = useRef(onAudioInterrupted);
  const onSpeechChunkSentRef = useRef(onSpeechChunkSent);
  const onMentorAudioLevelRef = useRef(onMentorAudioLevel);
  const mentorSpeechAlignmentRef = useRef<MentorSpeechAlignment | null>(null);
  const showErrorToastRef = useRef<(translationKey: string) => void>(() => undefined);
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionState, setConnectionState] = useState<VoiceConnectionState>(
    VOICE_CONNECTION_STATE.CONNECTED,
  );
  const [recoveryErrorCode, setRecoveryErrorCode] = useState<string | null>(null);
  const [mentorSpeechPresentation, setMentorSpeechPresentation] =
    useState<MentorSpeechPresentation | null>(null);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);

  useEffect(() => {
    setInputRef.current = setInput;
  }, [setInput]);

  useEffect(() => {
    onLearnerTranscriptionRef.current = onLearnerTranscription;
  }, [onLearnerTranscription]);

  useEffect(() => {
    onMentorResponseDeltaRef.current = onMentorResponseDelta;
  }, [onMentorResponseDelta]);

  useEffect(() => {
    onMentorResponseCompletedRef.current = onMentorResponseCompleted;
  }, [onMentorResponseCompleted]);

  useEffect(() => {
    onAudioStartedRef.current = onAudioStarted;
  }, [onAudioStarted]);

  useEffect(() => {
    onAudioOutputCompletedRef.current = onAudioOutputCompleted;
  }, [onAudioOutputCompleted]);

  useEffect(() => {
    onAudioInterruptedRef.current = onAudioInterrupted;
  }, [onAudioInterrupted]);

  useEffect(() => {
    onSpeechChunkSentRef.current = onSpeechChunkSent;
  }, [onSpeechChunkSent]);

  useEffect(() => {
    onMentorAudioLevelRef.current = onMentorAudioLevel;
  }, [onMentorAudioLevel]);

  useEffect(() => {
    showErrorToastRef.current = (translationKey: string) => {
      toast({
        variant: "destructive",
        description: t(translationKey),
      });
    };
  }, [t, toast]);

  const clearTurnState = () => {
    turnStateRef.current = createVoiceMentorTurnState();
  };

  const clearInactivityTimer = () => {
    if (!inactivityTimerRef.current) {
      return;
    }

    clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = null;
  };

  const teardownVoiceMentorCapture = useCallback(async () => {
    try {
      if (streamerRef.current) {
        await streamerRef.current.cancel();
      }
    } finally {
      audioPlayerRef.current?.reset();
      clearInactivityTimer();
      clearTurnState();
      mentorSpeechAlignmentRef.current = null;
      setMentorSpeechPresentation(null);
      setIsRecording(false);
      setIsMuted(false);
    }
  }, []);

  useEffect(() => {
    const finalizeTurnIfReady = () => {
      const next = finalizeVoiceMentorTurnIfReady(turnStateRef.current, {
        nowMs: Date.now(),
        timeoutMs: VOICE_TURN_INACTIVITY_TIMEOUT_MS,
        isPlayerIdle: audioPlayerRef.current?.isIdle() ?? true,
      });

      turnStateRef.current = next.nextState;
      if (!next.finalizedTurnId) {
        return;
      }

      clearInactivityTimer();
      onAudioOutputCompletedRef.current?.();
    };

    const restartInactivityTimer = () => {
      clearInactivityTimer();
      inactivityTimerRef.current = setTimeout(() => {
        finalizeTurnIfReady();
      }, VOICE_TURN_INACTIVITY_TIMEOUT_MS);
    };

    const handleChunkSent = () => {
      onSpeechChunkSentRef.current?.();

      if (!turnStateRef.current.activeTurnId) {
        return;
      }

      audioPlayerRef.current?.reset();
      clearInactivityTimer();
      clearTurnState();
      onAudioInterruptedRef.current?.();
    };

    streamerRef.current = new RealtimePCMStreamerWorklet(
      voiceSocketProtocol as StreamProtocol<unknown, unknown>,
      (level) => onLevelChangeRef.current(level),
      handleChunkSent,
      (code) => {
        audioPlayerRef.current?.reset();
        clearInactivityTimer();
        clearTurnState();
        onAudioInterruptedRef.current?.();
        setRecoveryErrorCode(code);
      },
      (state) => {
        setConnectionState(state);
        if (state !== VOICE_CONNECTION_STATE.FAILED) {
          setRecoveryErrorCode(null);
        }
      },
    );
    audioPlayerRef.current = new RealtimePCMPlayer({
      sampleRate: 44100,
      channels: 1,
      onLevelChange: (level) => onMentorAudioLevelRef.current?.(level),
      onPlaybackProgress: (progress) => {
        const alignment = mentorSpeechAlignmentRef.current;
        if (!alignment) {
          return;
        }

        const activeWordIndex = progress
          ? resolveActiveWordIndex(alignment, progress.turnId, progress.elapsedMs)
          : null;
        setMentorSpeechPresentation((current) => {
          if (
            current?.turnId === alignment.turnId &&
            current.sequence === alignment.sequence &&
            current.activeWordIndex === activeWordIndex
          ) {
            return current;
          }

          return { ...alignment, activeWordIndex };
        });
      },
    });
    audioPlayerRef.current.setOnIdle(() => {
      finalizeTurnIfReady();
    });

    socketRef.current = acquireSocket();
    socketRef.current.connect();

    const handlers = createVoiceMentorSocketHandlers({
      setInput: setInputRef.current,
      stopCaptureFromServer: teardownVoiceMentorCapture,
      showErrorToast: (translationKey) => showErrorToastRef.current(translationKey),
      audioPlayerRef,
      turnStateRef,
      clearTurnState,
      restartInactivityTimer,
      clearInactivityTimer,
      finalizeTurnIfReady,
      closeLearnerTurn: () => streamerRef.current?.closeLearnerTurn(),
      onLearnerTranscription: (text) => onLearnerTranscriptionRef.current?.(text),
      onAudioOutputAlignment: (incoming) => {
        const alignment = acceptMentorSpeechAlignment(mentorSpeechAlignmentRef.current, incoming);
        mentorSpeechAlignmentRef.current = alignment;
        setMentorSpeechPresentation((current) => ({
          ...alignment,
          activeWordIndex: current?.turnId === alignment.turnId ? current.activeWordIndex : null,
        }));
      },
      onMentorResponseDelta: (text) => onMentorResponseDeltaRef.current?.(text),
      onMentorResponseCompleted: (text) => onMentorResponseCompletedRef.current?.(text),
      onAudioStarted: () => onAudioStartedRef.current?.(),
      onAudioInterrupted: () => onAudioInterruptedRef.current?.(),
    });

    for (const event of SUPPORTED_VOICE_MENTOR_SOCKET_EVENTS) {
      socketRef.current.on(event, handlers[event]);
    }

    return () => {
      for (const event of SUPPORTED_VOICE_MENTOR_SOCKET_EVENTS) {
        socketRef.current?.off(event, handlers[event]);
      }
      void streamerRef.current?.stop().catch(() => undefined);
      void audioPlayerRef.current?.destroy().catch(() => undefined);
      clearInactivityTimer();
      clearTurnState();
      mentorSpeechAlignmentRef.current = null;
      audioPlayerRef.current = null;
      streamerRef.current = null;
      socketRef.current = null;
      releaseSocket();
    };
  }, [teardownVoiceMentorCapture]);

  const beginVoiceMentorCapture = async () => {
    if (!streamerRef.current || !audioPlayerRef.current) return false;
    setIsStarting(true);
    setConnectionState(VOICE_CONNECTION_STATE.CONNECTED);
    setRecoveryErrorCode(null);
    try {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      turnStateRef.current = createVoiceMentorTurnState();
      mentorSpeechAlignmentRef.current = null;
      setMentorSpeechPresentation(null);
      await audioPlayerRef.current.start();
      await streamerRef.current.start({
        voiceAction: VOICE_ACTION.VOICE_MENTOR,
        lessonId,
      });

      setIsRecording(true);
      setIsMuted(false);
      return true;
    } catch (error) {
      console.error("Failed to start voice mentor recording", error);
      return false;
    } finally {
      setIsStarting(false);
    }
  };

  const startVoiceMentor = async () => {
    if (isRecording || isStarting) return false;

    return beginVoiceMentorCapture();
  };

  const restartVoiceMentor = async () => {
    if (connectionState !== VOICE_CONNECTION_STATE.FAILED || isStarting) {
      return false;
    }

    return beginVoiceMentorCapture();
  };

  const stopVoiceMentor = async () => {
    if (!isRecording || !streamerRef.current) return false;

    try {
      await streamerRef.current.stop();
      setIsRecording(false);
      setIsMuted(false);
      return true;
    } catch (error) {
      console.error("Failed to stop voice mentor recording", error);
      return false;
    }
  };

  const triggerWelcomeMessage = async (message: string) => {
    try {
      const socket = acquireSocket();
      socket.connect();

      socket.emit(VOICE_SOCKET_EVENT.TRIGGER_TTS, {
        payload: {
          content: message,
        },
      });

      return true;
    } catch (error) {
      console.error("Failed to send trigger for welcome message", error);
      return false;
    }
  };

  const cancelVoiceMentor = async () => {
    try {
      await teardownVoiceMentorCapture();
      setConnectionState(VOICE_CONNECTION_STATE.CONNECTED);
      setRecoveryErrorCode(null);
      return true;
    } catch (error) {
      console.error("Failed to cancel voice mentor recording", error);
      return false;
    }
  };

  const setVoiceMentorMuted = async (muted: boolean) => {
    if (!isRecording || !streamerRef.current) return false;

    try {
      await streamerRef.current.setMuted(muted);
      setIsMuted(muted);
      return true;
    } catch (error) {
      console.error("Failed to toggle voice mentor mute", error);
      return false;
    }
  };

  return {
    isRecording,
    isStarting,
    isMuted,
    connectionState,
    recoveryErrorCode,
    mentorSpeechPresentation,
    startVoiceMentor,
    restartVoiceMentor,
    stopVoiceMentor,
    cancelVoiceMentor,
    triggerWelcomeMessage,
    setVoiceMentorMuted,
  };
}
