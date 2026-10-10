/** Adapts the shared voice transport to text input with explicit recording ownership and cleanup. */
import { VOICE_ACTION, VOICE_ENDPOINTING_MODE, VOICE_SOCKET_EVENT } from "@repo/shared";
import { useEffect, useRef, useState } from "react";

import { acquireSocket, releaseSocket } from "~/api/socket";

import { RealtimePCMStreamerWorklet } from "../audio-stream";
import { voiceSocketProtocol } from "../voiceSocketProtocol";

import type { StreamProtocol } from "../audio-stream";
import type { Dispatch, SetStateAction } from "react";

type TranscriptionProps = {
  setInput: Dispatch<SetStateAction<string>>;
  onLevelChange: (level: number) => void;
};

type StopAudioEventPayload = {
  payload?: string;
  voiceAction?: string | null;
};

/** Accepts transcripts only after local recording starts and cancels pending microphone setup on disposal. */
export function useTranscription({ setInput, onLevelChange }: TranscriptionProps) {
  const streamerRef = useRef<RealtimePCMStreamerWorklet | null>(null);
  const onLevelChangeRef = useRef(onLevelChange);
  const setInputRef = useRef(setInput);
  const recordingRef = useRef(false);
  const acceptsTranscriptRef = useRef(false);
  const startingRef = useRef<Promise<boolean> | null>(null);
  const stoppingRef = useRef<Promise<void> | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
    setInputRef.current = setInput;
  }, [onLevelChange, setInput]);

  useEffect(() => {
    const streamer = new RealtimePCMStreamerWorklet(
      voiceSocketProtocol as StreamProtocol<unknown, unknown>,
      (level) => onLevelChangeRef.current(level),
    );
    streamerRef.current = streamer;
    const socket = acquireSocket();
    socket.connect();

    /** Ignores unrelated voice operations and discarded or unsolicited transcript deliveries. */
    const handleStopAudio = (data: StopAudioEventPayload) => {
      if (!acceptsTranscriptRef.current || data?.voiceAction !== VOICE_ACTION.TRANSCRIPT) return;
      if (typeof data.payload === "string" && data.payload.length > 0) {
        setInputRef.current((previous) => previous + data.payload);
        if (!recordingRef.current) acceptsTranscriptRef.current = false;
      }
    };
    socket.on(VOICE_SOCKET_EVENT.STOP_AUDIO, handleStopAudio);

    return () => {
      socket.off(VOICE_SOCKET_EVENT.STOP_AUDIO, handleStopAudio);
      acceptsTranscriptRef.current = false;
      streamerRef.current = null;
      // Pending starts detect disposal and cancel their captured streamer after setup settles.
      if (recordingRef.current && !startingRef.current && !stoppingRef.current) {
        void streamer.cancel().catch(() => undefined);
      }
      recordingRef.current = false;
      releaseSocket();
    };
  }, []);

  /** Serializes microphone startup and cleans resources if permission resolves after unmount. */
  const startRecording = async () => {
    const streamer = streamerRef.current;
    if (recordingRef.current || startingRef.current || stoppingRef.current || !streamer)
      return false;
    acceptsTranscriptRef.current = true;
    const pending = (async () => {
      try {
        await streamer.start({
          voiceAction: VOICE_ACTION.TRANSCRIPT,
          endpointingMode: VOICE_ENDPOINTING_MODE.CLIENT_VAD,
        });
        if (streamerRef.current !== streamer || !acceptsTranscriptRef.current) {
          await streamer.cancel();
          return false;
        }
        recordingRef.current = true;
        setIsRecording(true);
        return true;
      } catch {
        acceptsTranscriptRef.current = false;
        await streamer.cancel().catch(() => undefined);
        return false;
      }
    })();
    startingRef.current = pending;
    try {
      return await pending;
    } finally {
      if (startingRef.current === pending) startingRef.current = null;
    }
  };

  /** Stops an active recording while accepting its final asynchronous transcript. */
  const stopRecording = async () => {
    const streamer = streamerRef.current;
    if (!recordingRef.current || !streamer || stoppingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);
    const pending = streamer.stop().then(() => undefined);
    stoppingRef.current = pending;
    try {
      await pending;
    } finally {
      if (stoppingRef.current === pending) stoppingRef.current = null;
    }
  };

  /** Discards the current utterance, including delayed transcript events after cancellation. */
  const cancelTranscription = async () => {
    acceptsTranscriptRef.current = false;
    if (startingRef.current) {
      await startingRef.current;
      return;
    }
    const streamer = streamerRef.current;
    if (!recordingRef.current || !streamer || stoppingRef.current) return;
    recordingRef.current = false;
    setIsRecording(false);
    const pending = streamer.cancel();
    stoppingRef.current = pending;
    try {
      await pending;
    } finally {
      if (stoppingRef.current === pending) stoppingRef.current = null;
    }
  };

  return { isRecording, startRecording, stopRecording, cancelTranscription };
}
