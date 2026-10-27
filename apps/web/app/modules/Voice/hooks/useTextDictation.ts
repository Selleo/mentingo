import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { DICTATION_PHASES, DICTATION_TIMEOUT_MS } from "../dictation.constants";

import { useTranscription } from "./useTranscription";

import type {
  TextDictationOptions,
  TextDictationPhase,
  TextDictationResult,
} from "./useTextDictation.types";

type Operation = {
  cancelled: boolean;
  received: boolean;
  stopped: boolean;
  timer?: ReturnType<typeof setTimeout>;
};
type Snapshot = { phase: TextDictationPhase; voiceLevel: number; error: boolean };

/** Coordinates text dictation; useTranscription remains the owner of microphone and socket resources. */
export function useTextDictation({
  value,
  onChange,
  blocked = false,
  timeoutMs = DICTATION_TIMEOUT_MS,
}: TextDictationOptions): TextDictationResult {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    phase: DICTATION_PHASES.IDLE,
    voiceLevel: 0,
    error: false,
  });
  const runtime = useRef({
    mounted: false,
    phase: DICTATION_PHASES.IDLE as TextDictationPhase,
    operation: null as Operation | null,
    value,
    onChange,
    blocked,
    timeoutMs,
    transport: null as ReturnType<typeof useTranscription> | null,
  });
  useLayoutEffect(() => {
    Object.assign(runtime.current, { value, onChange, blocked, timeoutMs });
  }, [value, onChange, blocked, timeoutMs]);

  const publish = useCallback((patch: Partial<Snapshot>) => {
    if (patch.phase) runtime.current.phase = patch.phase;
    if (runtime.current.mounted) setSnapshot((current) => ({ ...current, ...patch }));
  }, []);
  const isCurrent = useCallback(
    (operation: Operation) => runtime.current.mounted && runtime.current.operation === operation,
    [],
  );
  const finish = useCallback(
    (operation: Operation, error = false) => {
      if (!isCurrent(operation)) return;
      clearTimeout(operation.timer);
      runtime.current.operation = null;
      publish({ phase: DICTATION_PHASES.IDLE, voiceLevel: 0, ...(error ? { error: true } : {}) });
    },
    [isCurrent, publish],
  );

  useEffect(() => {
    const current = runtime.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      if (current.operation) {
        current.operation.cancelled = true;
        clearTimeout(current.operation.timer);
      }
      current.operation = null;
      current.phase = DICTATION_PHASES.IDLE;
    };
  }, []);

  const setInput = useCallback(
    (next: string | ((current: string) => string)) => {
      const current = runtime.current;
      const operation = current.operation;
      if (!operation || !isCurrent(operation) || operation.cancelled || current.blocked) return;
      // Apply functional transport updates to the latest draft, including external edits.
      const nextValue = typeof next === "function" ? next(current.value) : next;
      current.value = nextValue;
      current.onChange(nextValue);
      if (current.phase === DICTATION_PHASES.TRANSCRIBING) {
        operation.received = true;
        if (operation.stopped) finish(operation);
      }
    },
    [finish, isCurrent],
  );
  const onLevelChange = useCallback(
    (voiceLevel: number) => {
      const operation = runtime.current.operation;
      if (operation && isCurrent(operation) && !operation.cancelled) publish({ voiceLevel });
    },
    [isCurrent, publish],
  );
  const transport = useTranscription({ setInput, onLevelChange });
  useLayoutEffect(() => {
    runtime.current.transport = transport;
  }, [transport]);

  const cancel = useCallback(async () => {
    const operation = runtime.current.operation;
    if (!operation || operation.cancelled) return;
    operation.cancelled = true;
    clearTimeout(operation.timer);
    publish({ phase: DICTATION_PHASES.CANCELLING });
    try {
      await runtime.current.transport?.cancelTranscription();
      finish(operation);
    } catch {
      finish(operation, true);
    }
  }, [finish, publish]);
  useEffect(() => {
    if (blocked) void cancel();
  }, [blocked, cancel]);

  const start = useCallback(async () => {
    const current = runtime.current;
    if (!current.mounted || current.blocked || current.phase !== DICTATION_PHASES.IDLE) return;
    const operation: Operation = { cancelled: false, received: false, stopped: false };
    current.operation = operation;
    publish({ phase: DICTATION_PHASES.STARTING, voiceLevel: 0, error: false });
    try {
      const started = await current.transport?.startRecording();
      if (!isCurrent(operation) || operation.cancelled) return;
      if (started) publish({ phase: DICTATION_PHASES.RECORDING });
      else finish(operation, true);
    } catch {
      if (!operation.cancelled) finish(operation, true);
    }
  }, [finish, isCurrent, publish]);
  const stop = useCallback(async () => {
    const current = runtime.current;
    const operation = current.operation;
    if (!operation || current.phase !== DICTATION_PHASES.RECORDING) return;
    publish({ phase: DICTATION_PHASES.TRANSCRIBING });
    operation.timer = setTimeout(() => {
      if (!isCurrent(operation) || operation.cancelled) return;
      publish({ error: true });
      void cancel();
    }, current.timeoutMs);
    try {
      await current.transport?.stopRecording();
      if (!isCurrent(operation) || operation.cancelled) return;
      operation.stopped = true;
      if (operation.received) finish(operation);
    } catch {
      if (!operation.cancelled) finish(operation, true);
    }
  }, [cancel, finish, isCurrent, publish]);
  const isIdle = useCallback(() => runtime.current.phase === DICTATION_PHASES.IDLE, []);
  const isRecording = snapshot.phase === DICTATION_PHASES.RECORDING;
  return {
    ...snapshot,
    isBusy: snapshot.phase !== DICTATION_PHASES.IDLE,
    isRecording,
    showVoicePanel:
      isRecording ||
      snapshot.phase === DICTATION_PHASES.TRANSCRIBING ||
      snapshot.phase === DICTATION_PHASES.CANCELLING,
    isIdle,
    start,
    stop,
    cancel,
  };
}
