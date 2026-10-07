/** Maintains the workspace websocket subscription and recovers from disconnects or sequence gaps. */
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
export const ACTIVE_TURN_RECONCILE_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const;
export const ACTIVE_TURN_RECONCILE_DELAY_MS = ACTIVE_TURN_RECONCILE_DELAYS_MS[0];

type Options = {
  courseId: string;
  session: AuthoringSession | undefined;
  onSnapshot: (snapshot: AuthoringSession) => void;
  onEvent?: (session: AuthoringSession, event: AuthoringEvent) => void;
  onRefresh: () => Promise<AuthoringSession | void>;
  onSessionUnavailable?: (sessionId: string) => void;
};

/** Subscribes to one session and recovers through a fresh snapshot after gaps. */
export const useCourseAuthoringSocket = ({
  courseId,
  session,
  onSnapshot,
  onEvent,
  onRefresh,
  onSessionUnavailable,
}: Options) => {
  const [connectionState, setConnectionState] = useState<AuthoringConnectionState>("connecting");
  const cursorRef = useRef(session?.snapshotSequence ?? 0);
  const sessionRef = useRef(session);
  const sessionIdRef = useRef(session?.sessionId);

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
    let permissionRevoked = false;
    let sessionUnavailable = false;
    let recoveryPromise: Promise<void> | null = null;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    let resolveRecoveryTimer: (() => void) | null = null;
    let activeTurnReconcileTimer: ReturnType<typeof setTimeout> | null = null;
    let activeTurnReconcileDelayIndex = 0;
    let preserveNextSocketSnapshotWatchdog = false;

    /** Reconciles a still-running turn if its terminal event was silently lost. */
    const scheduleActiveTurnReconciliation = (resetDelay = true) => {
      if (activeTurnReconcileTimer) clearTimeout(activeTurnReconcileTimer);
      activeTurnReconcileTimer = null;
      if (resetDelay) activeTurnReconcileDelayIndex = 0;

      const current = sessionRef.current;
      const hasActiveWork =
        current?.turns?.some((turn) => turn.status === "queued" || turn.status === "running") ||
        current?.tasks.some((task) => task.status === "queued" || task.status === "running");
      if (!active || permissionRevoked || sessionUnavailable || !hasActiveWork) return;

      const delay = ACTIVE_TURN_RECONCILE_DELAYS_MS[activeTurnReconcileDelayIndex];
      activeTurnReconcileTimer = setTimeout(() => {
        activeTurnReconcileTimer = null;
        activeTurnReconcileDelayIndex = Math.min(
          activeTurnReconcileDelayIndex + 1,
          ACTIVE_TURN_RECONCILE_DELAYS_MS.length - 1,
        );
        const latest = sessionRef.current;
        const stillActive =
          latest?.turns?.some((turn) => turn.status === "queued" || turn.status === "running") ||
          latest?.tasks.some((task) => task.status === "queued" || task.status === "running");
        if (stillActive) recover(true);
      }, delay);
    };

    /** Joins the server stream from the latest durable cursor. */
    const join = () => {
      if (!active || permissionRevoked || sessionUnavailable) return;
      setConnectionState("connecting");
      socket.emit("join:course-authoring", {
        courseId,
        sessionId,
        afterSequence: cursorRef.current,
      });
    };
    /** Accepts snapshots belonging to the active course/session pair. */
    const handleSnapshot = (snapshot: AuthoringSession, resetWatchdog = true) => {
      if (!active || snapshot.sessionId !== sessionId || snapshot.courseId !== courseId) {
        return;
      }
      if (snapshot.snapshotSequence < cursorRef.current) return;

      cursorRef.current = snapshot.snapshotSequence;
      sessionRef.current = snapshot;
      onSnapshot(snapshot);
      setConnectionState("live");
      const shouldResetWatchdog = resetWatchdog && !preserveNextSocketSnapshotWatchdog;
      preserveNextSocketSnapshotWatchdog = false;
      scheduleActiveTurnReconciliation(shouldResetWatchdog);
    };
    /** Waits between bounded recovery attempts and can be released on cleanup. */
    const waitForRetry = (delayMs: number) =>
      new Promise<void>((resolve) => {
        resolveRecoveryTimer = resolve;
        recoveryTimer = setTimeout(() => {
          recoveryTimer = null;
          resolveRecoveryTimer = null;
          resolve();
        }, delayMs);
      });
    /** Requests one durable snapshot and explicitly rejoins from its recovered cursor. */
    const recover = (fromWatchdog = false) => {
      if (!active || permissionRevoked || sessionUnavailable) return;
      if (recoveryPromise) return;
      if (activeTurnReconcileTimer) clearTimeout(activeTurnReconcileTimer);
      activeTurnReconcileTimer = null;
      if (!fromWatchdog) activeTurnReconcileDelayIndex = 0;

      setConnectionState("recovering");
      const operation = (async () => {
        for (const delayMs of RECOVERY_DELAYS_MS) {
          if (!active || permissionRevoked || sessionUnavailable) return;
          if (delayMs > 0) await waitForRetry(delayMs);
          if (!active || permissionRevoked || sessionUnavailable) return;

          try {
            const snapshot = await onRefresh();
            if (!active || permissionRevoked) return;
            if (snapshot && snapshot.sessionId === sessionId && snapshot.courseId === courseId) {
              handleSnapshot(snapshot, !fromWatchdog);
            }
            if (fromWatchdog) preserveNextSocketSnapshotWatchdog = true;
            if (socket.connected) join();
            else socket.connect();
            return;
          } catch (error) {
            if (isUnavailableAuthoringSession(error)) {
              sessionUnavailable = true;
              setConnectionState("offline");
              if (socket.connected) socket.emit("leave:course-authoring", { sessionId });
              onSessionUnavailable?.(sessionId);
              return;
            }
            // Retry transient snapshot failures without polling a healthy stream.
          }
        }
        if (active && !permissionRevoked && !sessionUnavailable) setConnectionState("offline");
      })();
      recoveryPromise = operation;
      void operation.then(() => {
        if (recoveryPromise !== operation) return;
        recoveryPromise = null;
        if (!activeTurnReconcileTimer) scheduleActiveTurnReconciliation(false);
      });
    };
    /** Advances contiguous events and recovers instead of applying partial history. */
    const handleEvent = (event: AuthoringEvent) => {
      preserveNextSocketSnapshotWatchdog = false;
      const current = sessionRef.current;
      if (!current) {
        return;
      }

      const decision = decideEventCursor(
        { ...current, snapshotSequence: cursorRef.current },
        event,
      );

      if (decision.type === "ignore") {
        return;
      }

      if (decision.type === "gap") {
        recover();
        return;
      }
      cursorRef.current = decision.cursor;
      const nextSession = applyAuthoringEvent(
        { ...current, snapshotSequence: cursorRef.current - 1 },
        event,
      );
      sessionRef.current = nextSession;
      onEvent?.(nextSession, event);
      scheduleActiveTurnReconciliation();
    };
    /** Translates server errors into recoverable or offline connection state. */
    const handleError = (payload: { sessionId?: string; code?: string }) => {
      if (payload.sessionId && payload.sessionId !== sessionId) {
        return;
      }

      if (payload.code === "permission_revoked") {
        permissionRevoked = true;
        setConnectionState("offline");
        return;
      }
      if (payload.code === "session_not_found") {
        sessionUnavailable = true;
        setConnectionState("offline");
        if (socket.connected) socket.emit("leave:course-authoring", { sessionId });
        onSessionUnavailable?.(sessionId);
        return;
      }
      recover();
    };
    /** Marks the workspace offline while allowing the shared socket to reconnect. */
    const handleDisconnect = () => {
      if (active) {
        setConnectionState("offline");
      }
    };
    /** Treat failed handshakes like disconnects so a missed stream cannot leave stale UI state. */
    const handleConnectError = () => {
      if (active) recover();
    };
    /** Nest surfaces rejected join messages as `exception`; recover the durable snapshot too. */
    const handleSocketException = () => {
      if (active) recover();
    };

    socket.on("connect", join);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("exception", handleSocketException);
    socket.on("authoring.snapshot", handleSnapshot);
    socket.on("authoring.event", handleEvent);
    socket.on("authoring.resync", recover);
    socket.on("authoring.error", handleError);
    socket.connect();

    if (socket.connected) join();
    scheduleActiveTurnReconciliation();

    return () => {
      active = false;
      if (recoveryTimer) clearTimeout(recoveryTimer);
      recoveryTimer = null;
      if (activeTurnReconcileTimer) clearTimeout(activeTurnReconcileTimer);
      activeTurnReconcileTimer = null;
      resolveRecoveryTimer?.();
      resolveRecoveryTimer = null;
      socket.off("connect", join);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("exception", handleSocketException);
      socket.off("authoring.snapshot", handleSnapshot);
      socket.off("authoring.event", handleEvent);
      socket.off("authoring.resync", recover);
      socket.off("authoring.error", handleError);
      if (socket.connected) socket.emit("leave:course-authoring", { sessionId });
      releaseSocket();
    };
  }, [courseId, onEvent, onRefresh, onSessionUnavailable, onSnapshot, session?.sessionId]);

  return connectionState;
};
