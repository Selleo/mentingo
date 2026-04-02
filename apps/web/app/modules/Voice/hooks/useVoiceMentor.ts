import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { acquireSocket, releaseSocket } from "~/api/socket";
import { useToast } from "~/components/ui/use-toast";

import { RealtimePCMPlayer } from "../audio-player";
import { RealtimePCMStreamerWorklet } from "../audio-stream";
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
import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

type VoiceMentorProps = {
  lessonId: string;
  setInput: Dispatch<SetStateAction<string>>;
  onLevelChange: (level: number) => void;
  onMentorTranscription?: (text: string) => void;
  onMentorResponseCompleted?: (text: string) => void;
  onAudioStarted?: () => void;
  onAudioOutputCompleted?: () => void;
  onAudioInterrupted?: () => void;
  onSpeechChunkSent?: () => void;
  onAudioChunkReceived?: () => void;
};

export function useVoiceMentor({
  lessonId,
  setInput,
  onLevelChange,
  onMentorTranscription,
  onMentorResponseCompleted,
  onAudioStarted,
  onAudioOutputCompleted,
  onAudioInterrupted,
  onSpeechChunkSent,
  onAudioChunkReceived,
}: VoiceMentorProps) {
  const streamerRef = useRef<RealtimePCMStreamerWorklet | null>(null);
  const audioPlayerRef = useRef<RealtimePCMPlayer | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const turnStateRef = useRef(createVoiceMentorTurnState());
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLevelChangeRef = useRef(onLevelChange);
  const setInputRef = useRef(setInput);
  const onMentorTranscriptionRef = useRef(onMentorTranscription);
  const onMentorResponseCompletedRef = useRef(onMentorResponseCompleted);
  const onAudioStartedRef = useRef(onAudioStarted);
  const onAudioOutputCompletedRef = useRef(onAudioOutputCompleted);
  const onAudioInterruptedRef = useRef(onAudioInterrupted);
  const onSpeechChunkSentRef = useRef(onSpeechChunkSent);
  const onAudioChunkReceivedRef = useRef(onAudioChunkReceived);
  const showErrorToastRef = useRef<(translationKey: string) => void>(() => undefined);
  const { t } = useTranslation();
  const { toast } = useToast();

  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);

  useEffect(() => {
    setInputRef.current = setInput;
  }, [setInput]);

  useEffect(() => {
    onMentorTranscriptionRef.current = onMentorTranscription;
  }, [onMentorTranscription]);

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
    onAudioChunkReceivedRef.current = onAudioChunkReceived;
  }, [onAudioChunkReceived]);

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
      setIsRecording(false);
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
    );
    audioPlayerRef.current = new RealtimePCMPlayer({ sampleRate: 44100, channels: 1 });
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
      onAudioChunkReceived: () => onAudioChunkReceivedRef.current?.(),
      onMentorTranscription: (text) => onMentorTranscriptionRef.current?.(text),
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
      audioPlayerRef.current = null;
      streamerRef.current = null;
      socketRef.current = null;
      releaseSocket();
    };
  }, [teardownVoiceMentorCapture]);

  const startVoiceMentor = async () => {
    if (isRecording || !streamerRef.current || !audioPlayerRef.current) return false;

    try {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      turnStateRef.current = createVoiceMentorTurnState();
      await audioPlayerRef.current.start();
      await streamerRef.current.start({
        voiceAction: VOICE_ACTION.VOICE_MENTOR,
        lessonId,
      });

      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Failed to start voice mentor recording", error);
      return false;
    }
  };

  const stopVoiceMentor = async () => {
    if (!isRecording || !streamerRef.current) return false;

    try {
      await streamerRef.current.stop();
      setIsRecording(false);
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
      return true;
    } catch (error) {
      console.error("Failed to cancel voice mentor recording", error);
      return false;
    }
  };

  return {
    isRecording,
    startVoiceMentor,
    stopVoiceMentor,
    cancelVoiceMentor,
    triggerWelcomeMessage,
  };
}
