export const VOICE_TURN_INACTIVITY_TIMEOUT_MS = 5000;

export type VoiceMentorTurnState = {
  activeTurnId: string | null;
  pendingCompletionTurnId: string | null;
  lastAcceptedSeq: number;
  lastChunkAtMs: number | null;
};

export type VoiceMentorChunkDecision = {
  nextState: VoiceMentorTurnState;
  accept: boolean;
  hardCut: boolean;
};

type VoiceMentorChunkParams = {
  turnId: string;
  seq: number;
  nowMs: number;
};

type VoiceMentorFinalizeParams = {
  nowMs: number;
  timeoutMs: number;
  isPlayerIdle: boolean;
};

export function createVoiceMentorTurnState(): VoiceMentorTurnState {
  return {
    activeTurnId: null,
    pendingCompletionTurnId: null,
    lastAcceptedSeq: -1,
    lastChunkAtMs: null,
  };
}

export function onVoiceMentorAudioChunk(
  state: VoiceMentorTurnState,
  params: VoiceMentorChunkParams,
): VoiceMentorChunkDecision {
  if (params.seq < 0) {
    return { nextState: state, accept: false, hardCut: false };
  }

  if (!state.activeTurnId) {
    return {
      accept: true,
      hardCut: false,
      nextState: {
        activeTurnId: params.turnId,
        pendingCompletionTurnId: null,
        lastAcceptedSeq: params.seq,
        lastChunkAtMs: params.nowMs,
      },
    };
  }

  if (state.activeTurnId !== params.turnId) {
    return { nextState: state, accept: false, hardCut: false };
  }

  if (params.seq <= state.lastAcceptedSeq) {
    return { nextState: state, accept: false, hardCut: false };
  }

  return {
    accept: true,
    hardCut: false,
    nextState: {
      ...state,
      lastAcceptedSeq: params.seq,
      lastChunkAtMs: params.nowMs,
    },
  };
}

export function onVoiceMentorAudioCompleted(
  state: VoiceMentorTurnState,
  turnId?: string,
): VoiceMentorTurnState {
  if (!state.activeTurnId) {
    return state;
  }

  if (turnId && state.activeTurnId !== turnId) {
    return state;
  }

  return {
    ...state,
    pendingCompletionTurnId: state.activeTurnId,
  };
}

export function shouldHandleVoiceMentorInterrupted(
  state: VoiceMentorTurnState,
  turnId?: string,
): boolean {
  if (!state.activeTurnId) {
    return false;
  }

  if (!turnId) {
    return true;
  }

  return state.activeTurnId === turnId;
}

export function finalizeVoiceMentorTurnIfReady(
  state: VoiceMentorTurnState,
  params: VoiceMentorFinalizeParams,
): { nextState: VoiceMentorTurnState; finalizedTurnId: string | null } {
  if (!state.activeTurnId) {
    return { nextState: state, finalizedTurnId: null };
  }

  const shouldFinalizeByCompletion =
    state.pendingCompletionTurnId === state.activeTurnId && params.isPlayerIdle;
  const shouldFinalizeByInactivity =
    !state.pendingCompletionTurnId &&
    params.isPlayerIdle &&
    state.lastChunkAtMs !== null &&
    params.nowMs - state.lastChunkAtMs >= params.timeoutMs;

  if (!shouldFinalizeByCompletion && !shouldFinalizeByInactivity) {
    return { nextState: state, finalizedTurnId: null };
  }

  return {
    nextState: createVoiceMentorTurnState(),
    finalizedTurnId: state.activeTurnId,
  };
}
