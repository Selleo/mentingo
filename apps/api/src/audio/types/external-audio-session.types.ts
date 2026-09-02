import type {
  AudioChunkPayload,
  AudioOutputErrorData,
  ClientSpeechBoundaryPayload,
  EXTERNAL_AUDIO_OPERATION,
  EXTERNAL_AUDIO_RECOVERY_STATE,
  LumaSocket,
} from "@japro/luma-sdk";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

export type ExternalAudioRecoveryState =
  (typeof EXTERNAL_AUDIO_RECOVERY_STATE)[keyof typeof EXTERNAL_AUDIO_RECOVERY_STATE];

export type ExternalAudioChunkOperation = {
  type: (typeof EXTERNAL_AUDIO_OPERATION)["CHUNK"];
  payload: AudioChunkPayload;
  bytes: Buffer;
};

export type ExternalAudioSpeechBoundaryOperation = {
  type:
    | (typeof EXTERNAL_AUDIO_OPERATION)["SPEECH_START"]
    | (typeof EXTERNAL_AUDIO_OPERATION)["SPEECH_END"];
  payload: ClientSpeechBoundaryPayload;
};

export type ExternalAudioOperation =
  | ExternalAudioChunkOperation
  | ExternalAudioSpeechBoundaryOperation;

export type ExternalAudioTimeout = ReturnType<typeof setTimeout> | null;

export type ExternalAudioSession = {
  sessionId: string;
  socket: LumaSocket;
  currentUser: CurrentUserType;
  threadId: UUIDType;
  lessonId: UUIDType;
  userId: UUIDType;
  sessionRunId: string | null;
  recoveryState: ExternalAudioRecoveryState;
  recoveryAttempt: number;
  recoveryRequestPending: boolean;
  lastSentAudioSeq: number;
  unacknowledgedChunks: Map<number, ExternalAudioChunkOperation>;
  deferredOperations: ExternalAudioOperation[];
  recoveryTimeout: ExternalAudioTimeout;
  recoveryRetryTimeout: ExternalAudioTimeout;
  clientDisconnectTimeout: ExternalAudioTimeout;
  activeTurnId: string | null;
  audioOutputErrors: Map<string, AudioOutputErrorData>;
  pendingInterruption: boolean;
  interruptedTurnIds: Set<string>;
  activeMentorStream: {
    turnId: string;
    abortController: AbortController;
  } | null;
};
