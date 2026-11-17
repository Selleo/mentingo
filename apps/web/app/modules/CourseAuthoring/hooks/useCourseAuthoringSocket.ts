/** Maintains the workspace subscription; connection recovery never resubmits generation. */
import { isAxiosError } from "axios";
import { useEffect, useRef, useState } from "react";

import { acquireSocket, releaseSocket } from "~/api/socket";

import { isUnavailableAuthoringSession } from "../authoringSessionRecovery";
import { applyAuthoringEvent, decideEventCursor } from "../courseAuthoring.events";

import type {
  AuthoringConnectionState,
  AuthoringEvent,
  AuthoringSession,
} from "../courseAuthoring.types";

const RECOVERY_DELAYS_MS = [0, 500, 1_000, 2_000] as const;
const OFFLINE_RETRY_DELAY_MS = 30_000;
const JOIN_TIMEOUT_MS = 10_000;
const SNAPSHOT_TIMEOUT_MS = 10_000;
export const ACTIVE_TURN_RECONCILE_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const;
export const ACTIVE_TURN_RECONCILE_DELAY_MS = ACTIVE_TURN_RECONCILE_DELAYS_MS[0];

type Options = {
  courseId: string;
  session: AuthoringSession | undefined;
  onSnapshot: (snapshot: AuthoringSession) => void;
  onEvent?: (session: AuthoringSession, event: AuthoringEvent) => void;
  onRefresh: (signal?: AbortSignal) => Promise<AuthoringSession | void>;
  onSessionUnavailable?: (sessionId: string) => void;
  reconnectAttempt?: number;
};

/** Keeps authoritative work state available across transport failures and missed terminal events. */
export const useCourseAuthoringSocket = ({
  courseId,
  session,
  onSnapshot,
  onEvent,
  onRefresh,
  onSessionUnavailable,
  reconnectAttempt = 0,
}: Options) => {
  const [connectionState, setConnectionState] = useState<AuthoringConnectionState>("connecting");
  const cursorRef = useRef(session?.snapshotSequence ?? 0);
  const sessionRef = useRef(session);
  const sessionIdRef = useRef(session?.sessionId);
  const callbacksRef = useRef({ onSnapshot, onEvent, onRefresh, onSessionUnavailable });
  const rearmWatchdogRef = useRef<(() => void) | null>(null);
  const hasActiveWork = Boolean(
    session?.turns?.some((turn) => turn.status === "queued" || turn.status === "running") ||
      session?.tasks.some((task) => task.status === "queued" || task.status === "running"),
  );
  useEffect(() => {
    callbacksRef.current = { onSnapshot, onEvent, onRefresh, onSessionUnavailable };
  }, [onSnapshot, onEvent, onRefresh, onSessionUnavailable]);

  useEffect(() => {
    if (sessionIdRef.current !== session?.sessionId) {
      sessionIdRef.current = session?.sessionId;
      cursorRef.current = session?.snapshotSequence ?? 0;
      sessionRef.current = session;
      return;
    }
    if (session && session.snapshotSequence >= cursorRef.current) {
      cursorRef.current = session.snapshotSequence;
      sessionRef.current = session;
    }
  }, [session]);

  useEffect(() => {
    if (!courseId || !session?.sessionId) return;

    const socket = acquireSocket();
    const sessionId = session.sessionId;
    let active = true;
    let terminal = false;
    let streamHealthy = false;
    let hasConnected = socket.connected;
    let reconnectSnapshotReady = false;
    let recoveryPromise: Promise<void> | null = null;
    let recoveryRequested = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let snapshotController: AbortController | null = null;
    let resolveRecoveryTimer: (() => void) | null = null;
    let offlineRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let joinTimer: ReturnType<typeof setTimeout> | null = null;
    let activeTurnReconcileTimer: ReturnType<typeof setTimeout> | null = null;
    let activeTurnReconcileDelayIndex = 0;
    let streamRevision = 0;
    let preserveNextSocketSnapshotWatchdog = false;

    const canRecover = () => active && !terminal;
    const clearJoinTimeout = () => {
      if (joinTimer) clearTimeout(joinTimer);
      joinTimer = null;
    };
    const clearOfflineRetry = () => {
      if (offlineRetryTimer) clearTimeout(offlineRetryTimer);
      offlineRetryTimer = null;
    };
    const clearActiveTurnTimer = () => {
      if (activeTurnReconcileTimer) clearTimeout(activeTurnReconcileTimer);
      activeTurnReconcileTimer = null;
    };
    /** Releases every retry, including a suspended fast retry, on cleanup or terminal rejection. */
    const clearTimers = () => {
      clearJoinTimeout();
      clearOfflineRetry();
      clearActiveTurnTimer();
      if (recoveryTimer) clearTimeout(recoveryTimer);
      recoveryTimer = null;
      resolveRecoveryTimer?.();
      resolveRecoveryTimer = null;
      snapshotController?.abort();
    };
    const stopRecovery = (state: "permission_revoked" | "session_unavailable") => {
      if (!canRecover()) return;
      terminal = true;
      streamHealthy = false;
      clearTimers();
      setConnectionState(state);
      if (socket.connected) socket.emit("leave:course-authoring", { sessionId });
      if (state === "session_unavailable") callbacksRef.current.onSessionUnavailable?.(sessionId);
    };

    /** Bounds a missing join acknowledgement even if the shared socket itself stays connected. */
    const watchJoin = () => {
      clearJoinTimeout();
      joinTimer = setTimeout(() => {
        joinTimer = null;
        if (canRecover()) recover();
      }, JOIN_TIMEOUT_MS);
    };
    const join = () => {
      if (!canRecover()) return;
      streamHealthy = false;
      setConnectionState("connecting");
      watchJoin();
      socket.emit("join:course-authoring", {
        courseId,
        sessionId,
        afterSequence: cursorRef.current,
      });
    };
    /** Refreshes only active work; healthy streams keep their subscription and cursor. */
    const scheduleActiveTurnReconciliation = (resetDelay = true) => {
      clearActiveTurnTimer();
      if (resetDelay) activeTurnReconcileDelayIndex = 0;
      const current = sessionRef.current;
      const hasActiveWork =
        current?.turns?.some((turn) => turn.status === "queued" || turn.status === "running") ||
        current?.tasks.some((task) => task.status === "queued" || task.status === "running");
      if (!canRecover() || !hasActiveWork || offlineRetryTimer) return;
      const delay = ACTIVE_TURN_RECONCILE_DELAYS_MS[activeTurnReconcileDelayIndex];
      activeTurnReconcileTimer = setTimeout(() => {
        activeTurnReconcileTimer = null;
        activeTurnReconcileDelayIndex = Math.min(
          activeTurnReconcileDelayIndex + 1,
          ACTIVE_TURN_RECONCILE_DELAYS_MS.length - 1,
        );
        recover(true);
      }, delay);
    };
    /** Applies snapshots monotonically; REST success alone does not prove stream liveness. */
    const acceptSnapshot = (snapshot: AuthoringSession, resetWatchdog: boolean) => {
      if (
        !canRecover() ||
        snapshot.sessionId !== sessionId ||
        snapshot.courseId !== courseId ||
        snapshot.snapshotSequence < cursorRef.current
      )
        return false;
      cursorRef.current = snapshot.snapshotSequence;
      sessionRef.current = snapshot;
      callbacksRef.current.onSnapshot(snapshot);
      scheduleActiveTurnReconciliation(resetWatchdog);
      return true;
    };
    const handleSnapshot = (snapshot: AuthoringSession) => {
      if (!acceptSnapshot(snapshot, !preserveNextSocketSnapshotWatchdog)) return;
      preserveNextSocketSnapshotWatchdog = false;
      streamRevision += 1;
      streamHealthy = true;
      clearJoinTimeout();
      clearOfflineRetry();
      setConnectionState("live");
      scheduleActiveTurnReconciliation(false);
    };
    const waitForRetry = (delayMs: number) =>
      new Promise<void>((resolve) => {
        resolveRecoveryTimer = resolve;
        recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          resolveRecoveryTimer = null;
          resolve();
        }, delayMs);
      });
    /** Retains slow retries after a temporary outage even when no task is currently active. */
    const scheduleOfflineRetry = () => {
      if (!canRecover() || offlineRetryTimer) return;
      clearActiveTurnTimer();
      offlineRetryTimer = setTimeout(() => {
        offlineRetryTimer = null;
        recover();
      }, OFFLINE_RETRY_DELAY_MS);
    };
    /** Cancels stalled reads as well as their late cache writes; only the snapshot request is aborted. */
    const refreshSnapshot = async () => {
      const controller = new AbortController();
      snapshotController = controller;
      const timer = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
      try {
        return await Promise.race([
          callbacksRef.current.onRefresh(controller.signal),
          new Promise<never>((_resolve, reject) => {
            controller.signal.addEventListener(
              "abort",
              () => reject(new Error("Authoring snapshot read interrupted")),
              { once: true },
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
        if (snapshotController === controller) snapshotController = null;
      }
    };
    const recover = (fromWatchdog = false) => {
      if (!canRecover()) return;
      if (recoveryPromise) {
        if (!fromWatchdog) {
          recoveryRequested = true;
          setConnectionState("recovering");
        }
        return;
      }
      clearJoinTimeout();
      clearOfflineRetry();
      clearActiveTurnTimer();
      if (!fromWatchdog) activeTurnReconcileDelayIndex = 0;
      if (!fromWatchdog || !streamHealthy) setConnectionState("recovering");
      const startingRevision = streamRevision;
      const operation = (async () => {
        for (const delayMs of RECOVERY_DELAYS_MS) {
          if (!canRecover()) return;
          if (delayMs > 0) await waitForRetry(delayMs);
          if (!canRecover() || streamRevision !== startingRevision) return;
          try {
            const snapshot = await refreshSnapshot();
            if (!canRecover() || streamRevision !== startingRevision) return;
            if (snapshot) acceptSnapshot(snapshot, !fromWatchdog);
            if (fromWatchdog) preserveNextSocketSnapshotWatchdog = true;
            if (fromWatchdog && streamHealthy) return;
            if (socket.connected) join();
            else {
              reconnectSnapshotReady = true;
              watchJoin();
              socket.connect();
            }
            return;
          } catch (error) {
            if (!canRecover() || streamRevision !== startingRevision) return;
            if (isUnavailableAuthoringSession(error)) {
              stopRecovery("session_unavailable");
              return;
            }
            if (isAxiosError(error) && error.response?.status === 403) {
              stopRecovery("permission_revoked");
              return;
            }
          }
        }
        if (!canRecover()) return;
        streamHealthy = false;
        setConnectionState("offline");
        scheduleOfflineRetry();
      })();
      recoveryPromise = operation;
      void operation.then(() => {
        if (recoveryPromise !== operation) return;
        recoveryPromise = null;
        const retryRequested = recoveryRequested;
        recoveryRequested = false;
        if (retryRequested && !streamHealthy && !joinTimer && !offlineRetryTimer) {
          recover();
          return;
        }
        if (!activeTurnReconcileTimer && !offlineRetryTimer)
          scheduleActiveTurnReconciliation(false);
      });
    };
    const handleEvent = (event: AuthoringEvent) => {
      if (!canRecover()) return;
      const current = sessionRef.current;
      if (!current) return;
      const decision = decideEventCursor(
        { ...current, snapshotSequence: cursorRef.current },
        event,
      );
      if (decision.type === "ignore") return;
      if (decision.type === "gap") {
        recover();
        return;
      }
      preserveNextSocketSnapshotWatchdog = false;
      streamRevision += 1;
      streamHealthy = true;
      clearJoinTimeout();
      clearOfflineRetry();
      setConnectionState("live");
      cursorRef.current = decision.cursor;
      const nextSession = applyAuthoringEvent(
        { ...current, snapshotSequence: cursorRef.current - 1 },
        event,
      );
      sessionRef.current = nextSession;
      callbacksRef.current.onEvent?.(nextSession, event);
      scheduleActiveTurnReconciliation();
    };
    const handleError = (payload: { sessionId?: string; code?: string }) => {
      if (payload.sessionId && payload.sessionId !== sessionId) return;
      if (payload.code === "permission_revoked") {
        stopRecovery("permission_revoked");
        return;
      }
      if (payload.code === "session_not_found") {
        stopRecovery("session_unavailable");
        return;
      }
      streamHealthy = false;
      recover();
    };
    const handleDisconnect = () => {
      if (!canRecover()) return;
      streamHealthy = false;
      recover();
    };
    const handleConnect = () => {
      if (!canRecover()) return;
      if (reconnectSnapshotReady) {
        reconnectSnapshotReady = false;
        join();
      } else if (hasConnected) recover();
      else join();
      hasConnected = true;
    };
    const handleConnectError = () => {
      streamHealthy = false;
      recover();
    };
    const handleResync = (payload: { sessionId?: string }) => {
      if (payload?.sessionId && payload.sessionId !== sessionId) return;
      streamHealthy = false;
      recover();
    };

    rearmWatchdogRef.current = () => scheduleActiveTurnReconciliation(false);
    setConnectionState("connecting");
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("exception", handleConnectError);
    socket.on("authoring.snapshot", handleSnapshot);
    socket.on("authoring.event", handleEvent);
    socket.on("authoring.resync", handleResync);
    socket.on("authoring.error", handleError);
    if (socket.connected) join();
    else {
      watchJoin();
      socket.connect();
    }
    scheduleActiveTurnReconciliation();

    return () => {
      active = false;
      rearmWatchdogRef.current = null;
      clearTimers();
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("exception", handleConnectError);
      socket.off("authoring.snapshot", handleSnapshot);
      socket.off("authoring.event", handleEvent);
      socket.off("authoring.resync", handleResync);
      socket.off("authoring.error", handleError);
      if (socket.connected) socket.emit("leave:course-authoring", { sessionId });
      releaseSocket();
    };
  }, [courseId, reconnectAttempt, session?.sessionId]);

  useEffect(() => {
    if (hasActiveWork) rearmWatchdogRef.current?.();
  }, [hasActiveWork]);

  return connectionState;
};
