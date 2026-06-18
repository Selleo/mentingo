import { useTrackVolume } from "@livekit/components-react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type {
  AgentState,
  TrackReference,
  TrackReferenceOrPlaceholder,
} from "@livekit/components-react";
import type { LocalAudioTrack, RemoteAudioTrack } from "livekit-client";
import type { AnimationPlaybackControlsWithThen, ValueAnimationTransition } from "motion/react";

const DEFAULT_SPEED = 10;
const DEFAULT_AMPLITUDE = 2;
const DEFAULT_FREQUENCY = 0.5;
const DEFAULT_SCALE = 0.2;
const DEFAULT_BRIGHTNESS = 1.5;
const DEFAULT_TRANSITION: ValueAnimationTransition = { duration: 0.5, ease: "easeOut" };
const DEFAULT_PULSE_TRANSITION: ValueAnimationTransition = {
  duration: 0.35,
  ease: "easeOut",
  repeat: Infinity,
  repeatType: "mirror",
};

function useAnimatedValue<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  const motionValue = useMotionValue(initialValue);
  const controlsRef = useRef<AnimationPlaybackControlsWithThen | null>(null);
  useMotionValueEvent(motionValue, "change", (value) => setValue(value as T));

  const animateFn = useCallback(
    (targetValue: T | T[], transition: ValueAnimationTransition) => {
      controlsRef.current = animate(motionValue, targetValue, transition);
    },
    [motionValue],
  );

  return { value, motionValue, controls: controlsRef, animate: animateFn };
}

export function useAgentAudioVisualizerAura(
  state: AgentState | undefined,
  audioTrack?: LocalAudioTrack | RemoteAudioTrack | TrackReferenceOrPlaceholder,
  volumeOverride?: number,
) {
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const {
    value: scale,
    animate: animateScale,
    motionValue: scaleMotionValue,
  } = useAnimatedValue(DEFAULT_SCALE);
  const { value: amplitude, animate: animateAmplitude } = useAnimatedValue(DEFAULT_AMPLITUDE);
  const { value: frequency, animate: animateFrequency } = useAnimatedValue(DEFAULT_FREQUENCY);
  const { value: brightness, animate: animateBrightness } = useAnimatedValue(DEFAULT_BRIGHTNESS);
  const { value: smoothedVolume, animate: animateSmoothedVolume } = useAnimatedValue(0);

  const trackVolume = useTrackVolume(audioTrack as TrackReference, {
    fftSize: 512,
    smoothingTimeConstant: 0.55,
  });
  const volume = volumeOverride ?? trackVolume;

  useEffect(() => {
    animateSmoothedVolume(Math.max(0, Math.min(1, volume)), { duration: 0.16, ease: "easeOut" });
  }, [volume, animateSmoothedVolume]);

  useEffect(() => {
    switch (state) {
      case "idle":
      case "failed":
      case "disconnected":
        setSpeed(10);
        animateScale(0.2, DEFAULT_TRANSITION);
        animateAmplitude(1.2, DEFAULT_TRANSITION);
        animateFrequency(0.4, DEFAULT_TRANSITION);
        animateBrightness(1.0, DEFAULT_TRANSITION);
        return;
      case "listening":
      case "pre-connect-buffering":
        setSpeed(20);
        animateScale(0.3, { type: "spring", duration: 1.0, bounce: 0.35 });
        animateAmplitude(1.0, DEFAULT_TRANSITION);
        animateFrequency(0.7, DEFAULT_TRANSITION);
        animateBrightness([1.5, 2.0], DEFAULT_PULSE_TRANSITION);
        return;
      case "thinking":
      case "connecting":
      case "initializing":
        setSpeed(18);
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.35, DEFAULT_TRANSITION);
        animateFrequency(0.75, DEFAULT_TRANSITION);
        animateBrightness([1.0, 1.45], {
          ...DEFAULT_PULSE_TRANSITION,
          duration: 0.9,
        });
        return;
      case "speaking":
        setSpeed(70);
        animateScale(0.3, DEFAULT_TRANSITION);
        animateAmplitude(0.75, DEFAULT_TRANSITION);
        animateFrequency(1.25, DEFAULT_TRANSITION);
        animateBrightness(1.5, DEFAULT_TRANSITION);
        return;
    }
  }, [state, animateScale, animateAmplitude, animateFrequency, animateBrightness]);

  useEffect(() => {
    if (state === "speaking" && smoothedVolume > 0 && !scaleMotionValue.isAnimating()) {
      animateScale(0.2 + 0.2 * smoothedVolume, { duration: 0.08, ease: "easeOut" });
    }
  }, [
    state,
    smoothedVolume,
    scaleMotionValue,
    animateScale,
    animateAmplitude,
    animateFrequency,
    animateBrightness,
  ]);

  return {
    speed,
    scale,
    amplitude,
    frequency,
    brightness,
  };
}
