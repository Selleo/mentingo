import { describe, expect, it } from "vitest";

import {
  advanceVadEndDeferral,
  beginVadEndDeferral,
  createVadEndDeferralState,
  VAD_END_DEFERRAL_CONFIG,
  VAD_END_DEFERRAL_PHASE,
  VAD_END_DEFERRAL_REASON,
} from "./vad-end-deferral";

const FRAME_MS = 32;

describe("VAD end deferral", () => {
  it("keeps the segment open while a sustained filler has energy", () => {
    let state = beginVadEndDeferral(createVadEndDeferralState());

    for (let index = 0; index < 30; index += 1) {
      const result = advanceVadEndDeferral(state, 0.02, FRAME_MS);
      state = result.state;
      expect(result.shouldFinalize).toBe(false);
    }

    expect(state.phase).toBe(VAD_END_DEFERRAL_PHASE.PENDING);
    expect(state.lowEnergyMs).toBe(0);
  });

  it("ends after a continuous low-energy window", () => {
    let state = beginVadEndDeferral(createVadEndDeferralState());
    const silentFrames = VAD_END_DEFERRAL_CONFIG.silenceWindowMs / FRAME_MS;

    for (let index = 0; index < 4; index += 1) {
      state = advanceVadEndDeferral(state, 0.02, FRAME_MS).state;
    }

    for (let index = 0; index < silentFrames - 1; index += 1) {
      const result = advanceVadEndDeferral(state, 0.001, FRAME_MS);
      state = result.state;
      expect(result.shouldFinalize).toBe(false);
    }

    const result = advanceVadEndDeferral(state, 0.001, FRAME_MS);

    expect(result.shouldFinalize).toBe(true);
    expect(result.reason).toBe(VAD_END_DEFERRAL_REASON.SILENCE);
    expect(result.state.phase).toBe(VAD_END_DEFERRAL_PHASE.COMPLETE);
  });

  it("ends at the maximum deferral when persistent noise stays energetic", () => {
    let state = beginVadEndDeferral(createVadEndDeferralState());
    let result = advanceVadEndDeferral(state, 0.02, FRAME_MS);

    while (!result.shouldFinalize) {
      state = result.state;
      result = advanceVadEndDeferral(state, 0.02, FRAME_MS);
    }

    expect(result.reason).toBe(VAD_END_DEFERRAL_REASON.MAX_DEFERRAL);
    expect(result.state.elapsedMs).toBeGreaterThanOrEqual(VAD_END_DEFERRAL_CONFIG.maxDeferralMs);
  });

  it("does not finalize twice after the gate completes", () => {
    let state = beginVadEndDeferral(createVadEndDeferralState());
    let result = advanceVadEndDeferral(state, 0.001, VAD_END_DEFERRAL_CONFIG.silenceWindowMs);

    expect(result.shouldFinalize).toBe(true);
    state = result.state;
    result = advanceVadEndDeferral(state, 0.001, FRAME_MS);

    expect(result.shouldFinalize).toBe(false);
    expect(result.state.phase).toBe(VAD_END_DEFERRAL_PHASE.COMPLETE);
  });
});
