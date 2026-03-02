import { VOICE_ACTION, VOICE_SOCKET_EVENT } from "@repo/shared";
import { useEffect, useRef, useState } from "react";

import { acquireSocket, releaseSocket } from "~/api/socket";

import { RealtimePCMStreamerWorklet } from "../audio-stream";
import { voiceSocketProtocol } from "../voiceSocketProtocol";

import type { StreamProtocol } from "../audio-stream";
import type { Dispatch, SetStateAction } from "react";
import type { Socket } from "socket.io-client";

type TranscriptionProps = {
  setInput: Dispatch<SetStateAction<string>>;
  onLevelChange: (level: number) => void;
};

export function useTranscription({ setInput, onLevelChange }: TranscriptionProps) {
  const streamerRef = useRef<RealtimePCMStreamerWorklet | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const onLevelChangeRef = useRef(onLevelChange);

  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    onLevelChangeRef.current = onLevelChange;
  }, [onLevelChange]);

  useEffect(() => {
    streamerRef.current = new RealtimePCMStreamerWorklet(
      voiceSocketProtocol as StreamProtocol<unknown, unknown>,
      (level) => onLevelChangeRef.current(level),
    );

    socketRef.current = acquireSocket();
    socketRef.current.connect();

    socketRef.current.on(VOICE_SOCKET_EVENT.STOP_AUDIO, (data) => {
      const payload = data?.payload;
      if (typeof payload === "string" && payload.length > 0) {
        setInput((prev) => prev + payload);
      }
    });

    return () => {
      socketRef.current?.off(VOICE_SOCKET_EVENT.STOP_AUDIO);
      void streamerRef.current?.stop().catch(() => undefined);
      streamerRef.current = null;
      socketRef.current = null;
      releaseSocket();
    };
  }, [setInput]);

  const startRecording = async () => {
    if (isRecording || !streamerRef.current) return false;

    try {
      await streamerRef.current.start({
        voiceAction: VOICE_ACTION.TRANSCRIPT,
      });

      setIsRecording(true);
      return true;
    } catch (error) {
      console.error("Failed to start transcription recording", error);
      return false;
    }
  };

  const stopRecording = async () => {
    if (!isRecording || !streamerRef.current) return;

    try {
      await streamerRef.current.stop();

      setIsRecording(false);
    } catch (error) {
      console.error("Failed to stop transcription recording", error);
    }
  };

  const cancelTranscription = async () => {
    if (!streamerRef.current) return;

    try {
      await streamerRef.current.cancel();
      setIsRecording(false);
    } catch (error) {
      console.error("Failed to cancel transcription recording", error);
    }
  };

  return { isRecording, startRecording, stopRecording, cancelTranscription };
}
