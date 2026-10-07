/** Streams durable authoring snapshots and events to authorized workspace clients. */
import { setTimeout as delay } from "node:timers/promises";

import { HttpException, Logger, UseGuards } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from "@nestjs/websockets";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { UUIDSchema } from "src/common";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { WsJwtGuard } from "src/websocket/guards/ws-jwt.guard";
import { AuthenticatedSocket } from "src/websocket/websocket.types";

import { CourseAuthoringContextBridgeService } from "./course-authoring-context-bridge.service";
import { CourseAuthoringContextService } from "./course-authoring-context.service";
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
    private readonly context: CourseAuthoringContextService,
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
        const key = `${actor.tenantId}:${payload.sessionId}`;
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
    while (!subscription.abort.signal.aborted && subscription.members.size) {
      let terminal = false;
      let recovered = false;
      let needsReconcile = false;
      const streamAbort = new AbortController();
      const abortStream = () => streamAbort.abort(subscription.abort.signal.reason);
      subscription.abort.signal.addEventListener("abort", abortStream, { once: true });
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
                recovered = await this.reconcile(subscription);
                streamAbort.abort();
                return;
              }
              if (event.type === "context.requested") {
                try {
                  await this.contextBridge.acceptRealtimeEvent(subscription.tenantId, event);
                } catch {
                  this.logger.warn("A live context request will be replayed by the durable scanner");
                }
              }
              await this.deliverEvent(subscription, event);
              subscription.cursor = event.sequence;
              backoff = 500;
            },
            onError: (error) => {
              if (error.code === "permission_revoked") {
                terminal = true;
                for (const socket of subscription.members.values())
                  this.emit(socket, "authoring.error", {
                    sessionId: subscription.sessionId,
                    code: error.code,
                  });
                return;
              }
              needsReconcile = true;
              this.emitResync(subscription);
            },
          });
        });
      } catch (error) {
        if (!subscription.abort.signal.aborted && !terminal) {
          this.logStreamIssue("disconnected", subscription, error);
          if (needsReconcile) recovered = await this.reconcile(subscription);
        }
      } finally {
        subscription.abort.signal.removeEventListener("abort", abortStream);
      }
      if (terminal || subscription.abort.signal.aborted) break;
      if (recovered) continue;
      try {
        await delay(backoff, undefined, { signal: subscription.abort.signal });
      } catch {
        break;
      }
      backoff = Math.min(backoff * 2, 10000);
    }
    if (this.subscriptions.get(key) === subscription) this.subscriptions.delete(key);
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
        if (this.isAccessError(error)) {
          this.revokeMember(subscription, socket);
          continue;
        }
        this.logStreamIssue("reconcile_failed", subscription, error);
        return false;
      }
    }
    if (!snapshot || subscription.abort.signal.aborted) return false;

    subscription.cursor = snapshot.snapshotSequence;
    for (const socket of [...subscription.members.values()]) {
      if (await this.authorizeMember(subscription, socket))
        this.emit(socket, "authoring.snapshot", snapshot);
    }
    return subscription.members.size > 0;
  }

  /** Delivers one event only after rechecking each member's current access. */
  private async deliverEvent(subscription: CourseAuthoringSubscription, event: unknown) {
    for (const socket of [...subscription.members.values()]) {
      if (await this.authorizeMember(subscription, socket))
        this.emit(socket, "authoring.event", event);
    }
  }

  /** Revalidates a member without trusting the socket's cached claims. */
  private async authorizeMember(
    subscription: CourseAuthoringSubscription,
    socket: AuthenticatedSocket,
  ): Promise<boolean> {
    try {
      await this.authentication.authenticateCurrent(socket);
      if (socket.data.user.tenantId !== subscription.tenantId) throw new Error("tenant_changed");
      await this.context.authorize(subscription.courseId, socket.data.user);
      return true;
    } catch {
      this.revokeMember(subscription, socket);
      return false;
    }
  }

  /** Removes a member and keeps permission failures terminal for that member. */
  private revokeMember(subscription: CourseAuthoringSubscription, socket: AuthenticatedSocket) {
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
    if (error instanceof HttpException && error.getStatus() === 404)
      return AUTHORING_SOCKET_ERROR.SESSION_NOT_FOUND;
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
    kind: "disconnected" | "reconcile_failed",
    subscription: CourseAuthoringSubscription,
    error: unknown,
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
      }),
    );
  }

  /** Distinguishes access revocation from transient producer or transport failures. */
  private isAccessError(error: unknown) {
    return error instanceof HttpException && [401, 403].includes(error.getStatus());
  }

  /** Emits a socket event while isolating delivery failures from the stream loop. */
  private emit(socket: Socket, event: string, payload: unknown) {
    socket.emit(event, payload);
  }
}
