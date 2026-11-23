/** Streams durable authoring snapshots and events to authorized workspace clients. */
import { setTimeout as delay } from "node:timers/promises";

import { ForbiddenException, HttpException, Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from "@nestjs/websockets";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { isAxiosError } from "axios";

import { UUIDSchema } from "src/common";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsAuthenticationException } from "src/websocket/guards/ws-authentication.exception";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { AuthenticatedSocket } from "src/websocket/websocket.types";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringSessionService } from "./course-authoring-session.service";
import { LumaService } from "./luma.service";

import type { CourseAuthoringSubscription } from "./course-authoring.types";
import type { OnModuleDestroy } from "@nestjs/common";
import type { OnGatewayDisconnect } from "@nestjs/websockets";
import type { Socket } from "socket.io";

const joinSchema = Type.Object(
  { courseId: UUIDSchema, sessionId: UUIDSchema, afterSequence: Type.Integer({ minimum: 0 }) },
  { additionalProperties: false },
);
const leaveSchema = Type.Object({ sessionId: UUIDSchema }, { additionalProperties: false });
const AUTHORING_SOCKET_ERROR = {
  INVALID_COMMAND: "invalid_command",
  PERMISSION_REVOKED: "permission_revoked",
  SESSION_NOT_FOUND: "session_not_found",
  JOIN_FAILED: "join_failed",
} as const;
/** Multiplexes authorized session streams and sends snapshots when replay cannot be trusted. */

@WebSocketGateway({ namespace: "/ws", path: "/api/ws", transports: ["websocket", "polling"] })
export class CourseAuthoringGateway implements OnGatewayDisconnect, OnModuleDestroy {
  private readonly logger = new Logger(CourseAuthoringGateway.name);
  private readonly subscriptions = new Map<string, CourseAuthoringSubscription>();
  /** Injects the session service and shared realtime infrastructure. */
  constructor(
    private readonly sessions: CourseAuthoringSessionService,
    private readonly luma: LumaService,
    private readonly tenants: TenantDbRunnerService,
    private readonly authentication: WsJwtGuard,
    private readonly contextBridge: CourseAuthoringContextBridgeService,
  ) {}
  /** Joins a socket to one session stream after validating its tenant and cursor. */

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("join:course-authoring")
  async join(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() payload: unknown) {
    if (!Value.Check(joinSchema, payload))
      return this.rejectJoin(socket, null, AUTHORING_SOCKET_ERROR.INVALID_COMMAND);

    try {
      await this.authentication.authenticateCurrent(socket);
      const actor = socket.data.user;
      return await this.tenants.runWithTenant(actor.tenantId, async () => {
        const snapshot = await this.sessions.get(payload.courseId, payload.sessionId, actor);
        if (socket.disconnected) throw new WsException("courseAuthoring.errors.socketDisconnected");
        const key = `${actor.tenantId}:${payload.courseId}:${payload.sessionId}`;
        let subscription = this.subscriptions.get(key);
        const startStream = !subscription;
        // Register before replay. The client deduplicates by sequence and recovers any gap.
        if (!subscription) {
          subscription = {
            courseId: payload.courseId,
            sessionId: payload.sessionId,
            tenantId: actor.tenantId,
            cursor: snapshot.snapshotSequence,
            members: new Map(),
            abort: new AbortController(),
          };
          this.subscriptions.set(key, subscription);
        }
        await socket.join(`course-authoring:${key}`);
        subscription.members.set(socket.id, socket);
        this.emit(socket, "authoring.snapshot", snapshot);
        if (startStream) void this.consume(key, subscription);
        return {
          success: true,
          sessionId: payload.sessionId,
          snapshotSequence: snapshot.snapshotSequence,
        };
      });
    } catch (error) {
      return this.rejectJoin(socket, payload.sessionId, this.joinErrorCode(error));
    }
  }
  /** Removes a socket from a session stream and tears down an unused subscription. */

  @UseGuards(WsJwtGuard)
  @SubscribeMessage("leave:course-authoring")
  leave(@ConnectedSocket() socket: AuthenticatedSocket, @MessageBody() payload: unknown) {
    if (!Value.Check(leaveSchema, payload))
      throw new WsException("courseAuthoring.errors.invalidCommand");
    this.remove(socket.id, payload.sessionId);
    return { success: true };
  }

  /** Removes all session subscriptions held by a disconnected socket. */
  handleDisconnect(socket: Socket) {
    this.remove(socket.id);
  }
  /** Stops active stream consumers during module shutdown. */
  onModuleDestroy() {
    for (const subscription of this.subscriptions.values()) subscription.abort.abort();
    this.subscriptions.clear();
  }

  /** Removes one socket subscription and cancels its consumer when unused. */
  private remove(socketId: string, sessionId?: string) {
    for (const [key, subscription] of this.subscriptions) {
      if (sessionId && subscription.sessionId !== sessionId) continue;
      const member = subscription.members.get(socketId);
      if (member) void member.leave(`course-authoring:${key}`);
      subscription.members.delete(socketId);
      if (!subscription.members.size) {
        subscription.abort.abort();
        this.subscriptions.delete(key);
      }
    }
  }

  /** Consumes session events and emits only data authorized at delivery time. */
  private async consume(key: string, subscription: CourseAuthoringSubscription) {
    let backoff = 500;
    const heartbeat = setInterval(() => {
      void this.tenants
        .runWithTenant(subscription.tenantId, async () => {
          for (const socket of [...subscription.members.values()])
            await this.authorizeMember(subscription, socket);
        })
        .catch(() => this.emitResync(subscription));
    }, 60_000);
    try {
      let needsReconcile = false;
      while (!subscription.abort.signal.aborted && subscription.members.size) {
        if (needsReconcile) {
          try {
            const recovered = await this.tenants.runWithTenant(subscription.tenantId, () =>
              this.reconcile(subscription),
            );
            needsReconcile = !recovered;
          } catch (error) {
            this.logStreamIssue("reconcile_failed", subscription, error);
          }
          if (subscription.abort.signal.aborted || !subscription.members.size) break;
          if (needsReconcile) {
            if (!(await this.waitForRetry(subscription, backoff))) break;
            backoff = Math.min(backoff * 2, 10000);
            continue;
          }
        }
        const streamAbort = new AbortController();
        const abortStream = () => streamAbort.abort(subscription.abort.signal.reason);
        subscription.abort.signal.addEventListener("abort", abortStream, { once: true });
        const connectedAt = Date.now();
        try {
          await this.tenants.runWithTenant(subscription.tenantId, async () => {
            const client = await this.luma.getLumaClient();
            await client.authoring.subscribeEvents({
              sessionId: subscription.sessionId,
              afterSequence: subscription.cursor,
              signal: streamAbort.signal,
              onEvent: async (event) => {
                if (
                  event.sessionId !== subscription.sessionId ||
                  event.sequence <= subscription.cursor
                )
                  return;
                if (event.sequence !== subscription.cursor + 1) {
                  needsReconcile = true;
                  streamAbort.abort();
                  return;
                }
                if (event.type === "context.requested") {
                  try {
                    await this.contextBridge.acceptRealtimeEvent(subscription.tenantId, event);
                  } catch {
                    this.logger.warn(
                      "A live context request will be replayed by the durable scanner",
                    );
                  }
                }
                try {
                  await this.deliverEvent(subscription, event);
                } catch (error) {
                  // A transient authorization failure must neither deliver the event nor
                  // advance its cursor. Reconcile before reading more from this stream.
                  this.logStreamIssue("authorization_unavailable", subscription, error);
                  needsReconcile = true;
                  streamAbort.abort();
                  return;
                }
                subscription.cursor = event.sequence;
                backoff = 500;
              },
              onError: (error) => {
                if (error.code === "permission_revoked") {
                  this.endSubscription(subscription, AUTHORING_SOCKET_ERROR.PERMISSION_REVOKED);
                  return;
                }
                needsReconcile = true;
                this.emitResync(subscription);
              },
            });
          });
          if (!subscription.abort.signal.aborted && !needsReconcile)
            this.logStreamIssue("disconnected", subscription, undefined, Date.now() - connectedAt);
        } catch (error) {
          if (!subscription.abort.signal.aborted) {
            const status = this.errorStatus(error);
            if (status === 404)
              this.endSubscription(subscription, AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND);
            else if (this.isAccessError(error))
              this.endSubscription(subscription, AUTHORING_SOCKET_ERROR.PERMISSION_REVOKED);
            else this.logStreamIssue("disconnected", subscription, error, Date.now() - connectedAt);
          }
        } finally {
          subscription.abort.signal.removeEventListener("abort", abortStream);
          streamAbort.abort();
        }
        if (subscription.abort.signal.aborted) break;
        // EOF and ordinary transport errors can hide a terminal event just as a
        // sequence gap can. A fresh snapshot closes that turn before resubscribing.
        needsReconcile = true;
        this.emitResync(subscription);
        if (!(await this.waitForRetry(subscription, backoff))) break;
        backoff = Math.min(backoff * 2, 10000);
      }
    } finally {
      clearInterval(heartbeat);
      if (this.subscriptions.get(key) === subscription) this.subscriptions.delete(key);
    }
  }

  /** Waits between reconnects without keeping a released subscription alive. */
  private async waitForRetry(subscription: CourseAuthoringSubscription, backoff: number) {
    try {
      await delay(backoff, undefined, { signal: subscription.abort.signal });
      return true;
    } catch {
      return false;
    }
  }

  /** Rebuilds the shared cursor from a durable snapshot after a replay gap. */
  private async reconcile(subscription: CourseAuthoringSubscription): Promise<boolean> {
    if (subscription.abort.signal.aborted || !subscription.members.size) return false;
    this.emitResync(subscription);

    let snapshot: Awaited<ReturnType<CourseAuthoringSessionService["get"]>> | undefined;
    for (const socket of [...subscription.members.values()]) {
      if (!(await this.authorizeMember(subscription, socket))) continue;
      try {
        snapshot = await this.sessions.get(
          subscription.courseId,
          subscription.sessionId,
          socket.data.user,
        );
        break;
      } catch (error) {
        if (this.errorStatus(error) === 404) {
          this.endSubscription(subscription, AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND);
          return false;
        }
        if (this.isAccessError(error)) {
          this.revokeMember(subscription, socket);
          continue;
        }
        this.logStreamIssue("reconcile_failed", subscription, error);
        return false;
      }
    }
    if (!snapshot || subscription.abort.signal.aborted) return false;

    for (const socket of [...subscription.members.values()]) {
      if (
        (await this.authorizeMember(subscription, socket)) &&
        !subscription.abort.signal.aborted &&
        subscription.members.has(socket.id)
      )
        this.emit(socket, "authoring.snapshot", snapshot);
    }
    subscription.cursor = snapshot.snapshotSequence;
    return subscription.members.size > 0;
  }

  /** Delivers one event only after rechecking each member's current access. */
  private async deliverEvent(subscription: CourseAuthoringSubscription, event: unknown) {
    for (const socket of [...subscription.members.values()]) {
      if (
        (await this.authorizeMember(subscription, socket)) &&
        !subscription.abort.signal.aborted &&
        subscription.members.has(socket.id)
      ) {
        this.emit(socket, "authoring.event", event);
        if (
          event &&
          typeof event === "object" &&
          "type" in event &&
          event.type === "session.course_attached"
        )
          this.emit(socket, "authoring.resync", { sessionId: subscription.sessionId });
      }
    }
  }

  /** Revalidates a member without trusting the socket's cached claims. */
  private async authorizeMember(
    subscription: CourseAuthoringSubscription,
    socket: AuthenticatedSocket,
  ): Promise<boolean> {
    if (subscription.abort.signal.aborted || !subscription.members.has(socket.id)) return false;
    try {
      await this.authentication.authenticateCurrent(socket);
      if (socket.data.user.tenantId !== subscription.tenantId)
        throw new ForbiddenException("common.toast.noAccess");
      await this.sessions.authorizeAccess(
        subscription.courseId,
        subscription.sessionId,
        socket.data.user,
      );
      return true;
    } catch (error) {
      if (this.errorStatus(error) === 404) {
        this.endSubscription(subscription, AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND);
        return false;
      }
      if (!this.isAccessError(error)) throw error;
      this.revokeMember(subscription, socket);
      return false;
    }
  }

  /** Reports a terminal producer failure once and releases every room and retry timer. */
  private endSubscription(
    subscription: CourseAuthoringSubscription,
    code:
      | typeof AUTHORING_SOCKET_ERROR.PERMISSION_REVOKED
      | typeof AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND,
  ) {
    for (const socket of [...subscription.members.values()]) {
      this.emit(socket, "authoring.error", { sessionId: subscription.sessionId, code });
      this.remove(socket.id, subscription.sessionId);
    }
  }

  /** Removes a member and keeps permission failures terminal for that member. */
  private revokeMember(subscription: CourseAuthoringSubscription, socket: AuthenticatedSocket) {
    if (subscription.abort.signal.aborted || !subscription.members.has(socket.id)) return;
    this.emit(socket, "authoring.error", {
      sessionId: subscription.sessionId,
      code: AUTHORING_SOCKET_ERROR.PERMISSION_REVOKED,
    });
    this.remove(socket.id, subscription.sessionId);
  }

  /** Returns one structured join failure so invalid sessions never enter the reconnect path. */
  private rejectJoin(
    socket: AuthenticatedSocket,
    sessionId: string | null,
    code: (typeof AUTHORING_SOCKET_ERROR)[keyof typeof AUTHORING_SOCKET_ERROR],
  ) {
    this.emit(socket, "authoring.error", { sessionId, code });
    return { success: false, sessionId, code };
  }

  /** Maps expected authorization and stale-session failures without forwarding provider details. */
  private joinErrorCode(error: unknown) {
    if (this.errorStatus(error) === 404) return AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND;
    if (this.isAccessError(error)) return AUTHORING_SOCKET_ERROR.PERMISSION_REVOKED;
    return AUTHORING_SOCKET_ERROR.JOIN_FAILED;
  }

  /** Requests client-side snapshot refresh while the server repairs its cursor. */
  private emitResync(subscription: CourseAuthoringSubscription) {
    for (const socket of subscription.members.values())
      this.emit(socket, "authoring.resync", { sessionId: subscription.sessionId });
  }

  /** Emits identifiers and error categories only; provider details never enter logs. */
  private logStreamIssue(
    kind: "disconnected" | "reconcile_failed" | "authorization_unavailable",
    subscription: CourseAuthoringSubscription,
    error: unknown,
    connectedForMs?: number,
  ) {
    const errorName = error instanceof Error ? error.name : typeof error;
    this.logger.warn(
      JSON.stringify({
        event: "course_authoring_stream",
        kind,
        tenantId: subscription.tenantId,
        sessionId: subscription.sessionId,
        cursor: subscription.cursor,
        errorName,
        status: this.errorStatus(error),
        code: this.transportErrorCode(error),
        connectedForMs,
      }),
    );
  }

  /** Distinguishes access revocation from transient producer or transport failures. */
  private isAccessError(error: unknown) {
    return (
      error instanceof WsAuthenticationException ||
      [401, 403].includes(this.errorStatus(error) ?? 0)
    );
  }

  /** Extracts only numeric HTTP status, never a provider response body. */
  private errorStatus(error: unknown): number | undefined {
    if (error instanceof HttpException) return error.getStatus();
    if (isAxiosError(error)) return error.response?.status;
    return undefined;
  }

  /** Allows only known transport codes so diagnostics cannot include provider secrets. */
  private transportErrorCode(error: unknown): string | undefined {
    if (!error || typeof error !== "object" || !("code" in error)) return undefined;
    const allowedCodes = [
      "ECONNRESET",
      "ECONNABORTED",
      "ETIMEDOUT",
      "ERR_NETWORK",
      "ERR_CANCELED",
      "EPIPE",
    ];
    return typeof error.code === "string" && allowedCodes.includes(error.code)
      ? error.code
      : undefined;
  }

  /** Emits a socket event while isolating delivery failures from the stream loop. */
  private emit(socket: Socket, event: string, payload: unknown) {
    socket.emit(event, payload);
  }
}
