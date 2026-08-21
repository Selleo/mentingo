export const VAD_END_DEFERRAL_CONFIG = {
  energyThreshold: 0.02,
  silenceWindowMs: 192,
  maxDeferralMs: 1024,
} as const;

export const VAD_END_DEFERRAL_PHASE = {
  IDLE: "idle",
  PENDING: "pending",
  COMPLETE: "complete",
} as const;

export type VadEndDeferralPhase =
  (typeof VAD_END_DEFERRAL_PHASE)[keyof typeof VAD_END_DEFERRAL_PHASE];

export const VAD_END_DEFERRAL_REASON = {
  SILENCE: "silence",
  MAX_DEFERRAL: "max_deferral",
} as const;

export type VadEndDeferralReason =
  (typeof VAD_END_DEFERRAL_REASON)[keyof typeof VAD_END_DEFERRAL_REASON];

export type VadEndDeferralState = {
  phase: VadEndDeferralPhase;
  elapsedMs: number;
  lowEnergyMs: number;
};

export type VadEndDeferralResult = {
  state: VadEndDeferralState;
  shouldFinalize: boolean;
  reason: VadEndDeferralReason | null;
};

export function createVadEndDeferralState(): VadEndDeferralState {
  return {
    phase: VAD_END_DEFERRAL_PHASE.IDLE,
    elapsedMs: 0,
    lowEnergyMs: 0,
  };
}

export function beginVadEndDeferral(state: VadEndDeferralState): VadEndDeferralState {
  if (state.phase !== VAD_END_DEFERRAL_PHASE.IDLE) {
    return state;
  }

  return {
    phase: VAD_END_DEFERRAL_PHASE.PENDING,
    elapsedMs: 0,
    lowEnergyMs: 0,
  };
}

export function advanceVadEndDeferral(
  state: VadEndDeferralState,
  frameRms: number,
  frameDurationMs: number,
): VadEndDeferralResult {
  if (state.phase !== VAD_END_DEFERRAL_PHASE.PENDING) {
    return { state, shouldFinalize: false, reason: null };
  }

  const durationMs = Math.max(0, frameDurationMs);
  const elapsedMs = state.elapsedMs + durationMs;
  const lowEnergyMs = shouldForwardVadEndFrame(frameRms) ? 0 : state.lowEnergyMs + durationMs;
  const reachedSilenceWindow = lowEnergyMs >= VAD_END_DEFERRAL_CONFIG.silenceWindowMs;
  const reachedMaximum = elapsedMs >= VAD_END_DEFERRAL_CONFIG.maxDeferralMs;

  if (!reachedSilenceWindow && !reachedMaximum) {
    return {
      state: {
        phase: VAD_END_DEFERRAL_PHASE.PENDING,
        elapsedMs,
        lowEnergyMs,
      },
      shouldFinalize: false,
      reason: null,
    };
  }

  return {
    state: {
      phase: VAD_END_DEFERRAL_PHASE.COMPLETE,
      elapsedMs,
      lowEnergyMs,
    },
    shouldFinalize: true,
    reason: reachedSilenceWindow
      ? VAD_END_DEFERRAL_REASON.SILENCE
      : VAD_END_DEFERRAL_REASON.MAX_DEFERRAL,
  };
}

export function shouldForwardVadEndFrame(frameRms: number): boolean {
  return frameRms >= VAD_END_DEFERRAL_CONFIG.energyThreshold;
}
