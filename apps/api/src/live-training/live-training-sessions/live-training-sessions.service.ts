import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_PARTICIPANT_ROLES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  type LiveTrainingDeliveryType,
  type LiveTrainingParticipantRole,
  type SupportedLanguages,
} from "@repo/shared";

import {
  EndLiveTrainingSessionEvent,
  FailLiveTrainingSessionEvent,
  LiveTrainingSessionEvent,
  StartLiveTrainingSessionEvent,
} from "src/events";
import { FileService } from "src/file/file.service";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { StudentLessonProgressService } from "src/studentLessonProgress/studentLessonProgress.service";

import { LiveTrainingAnnouncementsService } from "../live-training-announcements.service";
import { LiveTrainingService } from "../live-training.service";
import { LiveKitService } from "../livekit/livekit.service";

import { LiveTrainingSessionsRepository } from "./live-training-sessions.repository";

import type {
  LiveTrainingLessonCompletionRow,
  LiveTrainingSessionRow,
} from "./live-training-sessions.repository.types";
import type {
  HandleLiveKitWebhookInput,
  JoinLiveTrainingSessionResponse,
  LiveTrainingSessionDetails,
  LiveTrainingSessionSummary,
} from "./live-training-sessions.types";
import type { WebhookEvent } from "livekit-server-sdk";
import type { LiveTrainingActivityLogSnapshot } from "src/activity-logs/types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { CurrentUserType } from "src/common/types/current-user.type";

const LIVEKIT_WEBHOOK_EVENTS = {
  PARTICIPANT_JOINED: "participant_joined",
  PARTICIPANT_LEFT: "participant_left",
  PARTICIPANT_CONNECTION_ABORTED: "participant_connection_aborted",
  ROOM_FINISHED: "room_finished",
} as const;

const LIVEKIT_IDENTITY_SEPARATOR = ":";
const UNEXPECTED_ROOM_FINISHED_REASON = "livekit_room_finished_unexpectedly";
const LIVE_TRAINING_PARTICIPANT_ROLE_VALUES = Object.values(LIVE_TRAINING_PARTICIPANT_ROLES);

@Injectable()
export class LiveTrainingSessionsService {
  constructor(
    private readonly liveTrainingSessionsRepository: LiveTrainingSessionsRepository,
    private readonly liveKitService: LiveKitService,
    private readonly liveTrainingService: LiveTrainingService,
    private readonly tenantDbRunner: TenantDbRunnerService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly fileService: FileService,
    private readonly studentLessonProgressService: StudentLessonProgressService,
    private readonly settingsService: SettingsService,
    private readonly liveTrainingAnnouncementsService: LiveTrainingAnnouncementsService,
  ) {}

  async getSessions(
    liveTrainingId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingSessionSummary[]> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );
    this.assertCanViewSessionData(liveTraining, currentUser);

    const rows = await this.liveTrainingSessionsRepository.getSessionRows(liveTrainingId);

    return Promise.all(rows.map((row) => this.mapSessionSummary(row)));
  }

  async getSession(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingSessionDetails> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );
    this.assertCanViewSessionData(liveTraining, currentUser);

    const [sessionRow, participantRows, attendanceRows] = await Promise.all([
      this.liveTrainingSessionsRepository.getSessionRow(liveTrainingId, sessionId),
      this.liveTrainingSessionsRepository.getParticipantRows(liveTrainingId, sessionId),
      this.liveTrainingSessionsRepository.getAttendanceRows(liveTrainingId, sessionId),
    ]);

    if (!sessionRow) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    const session = await this.mapSessionSummary(sessionRow);
    const intervalsByParticipantId = new Map<UUIDType, typeof attendanceRows>();

    for (const interval of attendanceRows) {
      const current = intervalsByParticipantId.get(interval.participantId) ?? [];
      current.push(interval);
      intervalsByParticipantId.set(interval.participantId, current);
    }

    const participants = await Promise.all(
      participantRows.map(async (participant) => ({
        id: participant.id,
        user: {
          id: participant.userId,
          fullName: participant.fullName,
          profilePictureUrl: await this.getProfilePictureUrl(participant.avatarReference),
        },
        role: participant.role,
        firstJoinedAt: participant.firstJoinedAt,
        lastLeftAt: participant.lastLeftAt,
        totalSeconds: participant.totalSeconds,
        joinCount: participant.joinCount,
        intervals: (intervalsByParticipantId.get(participant.id) ?? []).map((interval) => ({
          id: interval.id,
          joinedAt: interval.joinedAt,
          leftAt: interval.leftAt,
          disconnectReason: interval.disconnectReason,
        })),
      })),
    );

    return { ...session, participants };
  }

  async startSession(
    liveTrainingId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingSessionSummary> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );

    this.assertCanManageSession(liveTraining, currentUser);

    const canStartNewSession =
      liveTraining.status === LIVE_TRAINING_STATUSES.SCHEDULED ||
      liveTraining.status === LIVE_TRAINING_STATUSES.ENDED;

    if (!canStartNewSession) {
      throw new BadRequestException("liveTraining.errors.onlyScheduledCanBeStarted");
    }

    await this.assertMaxParallelSessionsAvailable();

    const existingCurrentSession =
      await this.liveTrainingSessionsRepository.getCurrentSessionRow(liveTrainingId);

    if (existingCurrentSession) {
      throw new BadRequestException("liveTraining.errors.sessionAlreadyActive");
    }

    if (liveTraining.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE) {
      return this.startOfflineSession(
        liveTrainingId,
        language ?? SUPPORTED_LANGUAGES.EN,
        currentUser,
        liveTraining.calendarEventId,
      );
    }

    await this.liveKitService.assertConfigured();

    const session = await this.liveTrainingSessionsRepository.createWaitingSession({
      liveTrainingId,
      startedByUserId: currentUser.userId,
    });
    const roomName = this.liveKitService.buildRoomName(liveTrainingId, session.id);
    const room = await this.liveKitService.createRoom({
      roomName,
      maxParticipants: liveTraining.maxParticipants,
      metadata: {
        tenantId: currentUser.tenantId,
        liveTrainingId,
        sessionId: session.id,
      },
    });

    await this.liveTrainingSessionsRepository.activateLiveTrainingSession({
      liveTrainingId,
      sessionId: session.id,
      calendarEventId: liveTraining.calendarEventId,
      roomName,
      roomSid: room.room.sid,
    });
    await this.publishSessionEvent(LIVE_TRAINING_SESSION_STATUSES.WAITING, {
      id: session.id,
      liveTrainingId,
      tenantId: currentUser.tenantId,
    });

    const sessionRow = await this.liveTrainingSessionsRepository.getSessionRow(
      liveTrainingId,
      session.id,
    );

    if (!sessionRow) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    await this.publishSessionStartActivity({
      liveTrainingId,
      sessionId: session.id,
      language: language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
      deliveryType: liveTraining.deliveryType,
      startedAt: sessionRow.startedAt ?? new Date().toISOString(),
    });
    await this.liveTrainingAnnouncementsService.publishStartedNotification(
      liveTrainingId,
      currentUser,
    );

    return this.mapSessionSummary(sessionRow);
  }

  async joinCurrentSession(
    liveTrainingId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ): Promise<JoinLiveTrainingSessionResponse> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );
    const currentSession =
      await this.liveTrainingSessionsRepository.getCurrentSessionRow(liveTrainingId);

    if (!currentSession) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    if (liveTraining.deliveryType !== LIVE_TRAINING_DELIVERY_TYPES.ONLINE) {
      throw new BadRequestException("liveTraining.errors.onlineSessionRequired");
    }

    const session = await this.liveTrainingSessionsRepository.getSessionRoomRow(
      liveTrainingId,
      currentSession.id,
    );

    if (!session?.livekitRoomName) {
      throw new BadRequestException("liveTraining.errors.liveKitRoomNotAvailable");
    }

    await this.assertRoomHasCapacity(session.livekitRoomName, liveTraining.maxParticipants);

    const user = await this.liveTrainingSessionsRepository.getUserDisplayRow(currentUser.userId);

    if (!user) {
      throw new NotFoundException("liveTraining.errors.userNotFound");
    }

    const role = this.getParticipantRole(liveTraining, currentUser);
    const identity = this.liveKitService.buildParticipantIdentity(currentSession.id, user.id);
    const canManageSession = this.canManageSession(liveTraining, currentUser);
    const token = await this.liveKitService.createParticipantToken({
      roomName: session.livekitRoomName,
      identity,
      displayName: user.fullName,
      metadata: {
        liveTrainingId,
        sessionId: currentSession.id,
        userId: user.id,
        role,
      },
      attributes: { userId: user.id },
      canPublishAudio:
        canManageSession || liveTraining.settings.viewerPermissions.microphoneEnabled,
      canPublishVideo: canManageSession || liveTraining.settings.viewerPermissions.cameraEnabled,
      canPublishScreenShare: canManageSession,
    });

    await this.liveTrainingSessionsRepository.upsertParticipant({
      liveTrainingSessionId: currentSession.id,
      liveTrainingId,
      userId: currentUser.userId,
      role,
      livekitIdentity: identity,
    });

    return {
      sessionId: currentSession.id,
      livekitUrl: token.url,
      token: token.token,
      identity: token.identity,
      role,
      viewerPermissions: liveTraining.settings.viewerPermissions,
    };
  }

  async getParticipantProfilePictures(
    liveTrainingId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ) {
    await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );
    const currentSession =
      await this.liveTrainingSessionsRepository.getCurrentSessionRow(liveTrainingId);

    if (!currentSession) {
      return [];
    }

    const participants = await this.liveTrainingSessionsRepository.getParticipantRows(
      liveTrainingId,
      currentSession.id,
    );

    return Promise.all(
      participants.map(async (participant) => ({
        userId: participant.userId,
        profilePictureUrl: await this.getProfilePictureUrl(participant.avatarReference),
      })),
    );
  }

  private async startOfflineSession(
    liveTrainingId: UUIDType,
    language: SupportedLanguages,
    currentUser: CurrentUserType,
    calendarEventId: UUIDType,
  ) {
    const session = await this.liveTrainingSessionsRepository.createWaitingSession({
      liveTrainingId,
      startedByUserId: currentUser.userId,
    });

    await this.liveTrainingSessionsRepository.activateLiveTrainingSession({
      liveTrainingId,
      sessionId: session.id,
      calendarEventId,
      roomName: null,
      roomSid: null,
    });
    await this.liveTrainingSessionsRepository.markSessionActive(session.id);
    await this.publishSessionEvent(LIVE_TRAINING_SESSION_STATUSES.ACTIVE, {
      id: session.id,
      liveTrainingId,
      tenantId: currentUser.tenantId,
    });

    const sessionRow = await this.liveTrainingSessionsRepository.getSessionRow(
      liveTrainingId,
      session.id,
    );

    if (!sessionRow) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    await this.publishSessionStartActivity({
      liveTrainingId,
      sessionId: session.id,
      language,
      currentUser,
      deliveryType: LIVE_TRAINING_DELIVERY_TYPES.OFFLINE,
      startedAt: sessionRow.startedAt ?? new Date().toISOString(),
    });
    await this.liveTrainingAnnouncementsService.publishStartedNotification(
      liveTrainingId,
      currentUser,
    );

    return this.mapSessionSummary(sessionRow);
  }

  private async assertRoomHasCapacity(roomName: string, maxParticipants: number) {
    const participantCount = await this.liveKitService.getParticipantCount(roomName);

    if (participantCount >= maxParticipants) {
      throw new BadRequestException("liveTraining.errors.maxParticipantsReached");
    }
  }

  private async assertMaxParallelSessionsAvailable() {
    const [maxParallelSessions, currentSessionCount] = await Promise.all([
      this.settingsService.getLiveTrainingMaxParallelSessions(),
      this.liveTrainingSessionsRepository.countCurrentSessions(),
    ]);

    if (currentSessionCount >= maxParallelSessions) {
      throw new BadRequestException("liveTraining.errors.maxParallelSessionsReached");
    }
  }

  async endSession(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
    language: SupportedLanguages | undefined,
    currentUser: CurrentUserType,
  ): Promise<LiveTrainingSessionSummary> {
    const liveTraining = await this.liveTrainingService.getLiveTraining(
      liveTrainingId,
      language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
    );

    this.assertCanManageSession(liveTraining, currentUser);
    const session = await this.liveTrainingSessionsRepository.getSessionRoomRow(
      liveTrainingId,
      sessionId,
    );

    if (!session) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    if (session.status === LIVE_TRAINING_SESSION_STATUSES.ENDED) {
      const endedSession = await this.liveTrainingSessionsRepository.getSessionRow(
        liveTrainingId,
        sessionId,
      );

      if (!endedSession) {
        throw new NotFoundException("liveTraining.errors.sessionNotFound");
      }

      return this.mapSessionSummary(endedSession);
    }

    if (session.status === LIVE_TRAINING_SESSION_STATUSES.FAILED) {
      throw new BadRequestException("liveTraining.errors.sessionAlreadyFinished");
    }

    const endedAt = new Date().toISOString();
    const closedIntervals =
      await this.liveTrainingSessionsRepository.closeAllOpenAttendanceIntervals(
        sessionId,
        endedAt,
        LIVE_TRAINING_SESSION_STATUSES.ENDED,
      );

    for (const interval of closedIntervals) {
      await this.liveTrainingSessionsRepository.updateParticipantAfterLeave(
        interval.participantId,
        this.getAttendedSeconds(interval.joinedAt, endedAt),
        endedAt,
      );
    }

    if (session.livekitRoomName) {
      await this.liveKitService.deleteRoom(session.livekitRoomName);
    }

    await this.liveTrainingSessionsRepository.finishSessionAndLiveTraining({
      liveTrainingId,
      sessionId,
      calendarEventId: liveTraining.calendarEventId,
      endedByUserId: currentUser.userId,
      endedAt,
    });
    await this.liveTrainingSessionsRepository.updateSessionCounters(sessionId);
    await this.markLinkedLiveLessonsCompleted({
      liveTrainingId,
      deliveryType: liveTraining.deliveryType,
      currentUser,
    });
    await this.publishSessionEvent(LIVE_TRAINING_SESSION_STATUSES.ENDED, {
      id: sessionId,
      liveTrainingId,
      tenantId: currentUser.tenantId,
    });
    await this.publishSessionEndActivity({
      liveTrainingId,
      sessionId,
      language: language ?? SUPPORTED_LANGUAGES.EN,
      currentUser,
      deliveryType: liveTraining.deliveryType,
      endedAt,
      endReason: LIVE_TRAINING_SESSION_STATUSES.ENDED,
    });
    await this.liveTrainingAnnouncementsService.publishEndedNotification(
      liveTrainingId,
      currentUser,
    );

    const endedSession = await this.liveTrainingSessionsRepository.getSessionRow(
      liveTrainingId,
      sessionId,
    );

    if (!endedSession) {
      throw new NotFoundException("liveTraining.errors.sessionNotFound");
    }

    return this.mapSessionSummary(endedSession);
  }

  async handleLiveKitWebhook(input: HandleLiveKitWebhookInput) {
    const event = await this.liveKitService.receiveWebhook(input.body, input.authorizationHeader);
    const roomName = this.getWebhookRoomName(event);

    if (!roomName) return event;

    const sessionTenant =
      await this.liveTrainingSessionsRepository.getSessionTenantByRoomName(roomName);

    if (!sessionTenant) return event;

    await this.tenantDbRunner.runWithTenant(sessionTenant.tenantId, async () => {
      await this.processLiveKitWebhookEvent(event, sessionTenant);
    });

    return event;
  }

  private async processLiveKitWebhookEvent(
    event: WebhookEvent,
    sessionTenant: { id: UUIDType; liveTrainingId: UUIDType; tenantId: UUIDType },
  ) {
    const eventName = event.event;

    if (eventName === LIVEKIT_WEBHOOK_EVENTS.PARTICIPANT_JOINED) {
      await this.handleParticipantJoined(event, sessionTenant);
      return;
    }

    if (
      eventName === LIVEKIT_WEBHOOK_EVENTS.PARTICIPANT_LEFT ||
      eventName === LIVEKIT_WEBHOOK_EVENTS.PARTICIPANT_CONNECTION_ABORTED
    ) {
      await this.handleParticipantLeft(event, sessionTenant);
      return;
    }

    if (eventName === LIVEKIT_WEBHOOK_EVENTS.ROOM_FINISHED) {
      await this.handleRoomFinished(event, sessionTenant);
    }
  }

  private async handleParticipantJoined(
    event: WebhookEvent,
    sessionTenant: { id: UUIDType; liveTrainingId: UUIDType; tenantId: UUIDType },
  ) {
    const participant = this.getWebhookParticipant(event);
    const identity = participant?.identity;
    const userId = this.getUserIdFromIdentity(identity);

    if (!identity || !userId) return;

    const participantRow = await this.liveTrainingSessionsRepository.upsertWebhookParticipant({
      liveTrainingSessionId: sessionTenant.id,
      liveTrainingId: sessionTenant.liveTrainingId,
      userId,
      role: this.getWebhookParticipantRole(participant?.metadata),
      livekitIdentity: identity,
    });

    if (!participantRow) return;

    const joinedAt = this.getWebhookTimestamp(event);

    await this.liveTrainingSessionsRepository.markSessionActive(sessionTenant.id);
    await this.liveTrainingSessionsRepository.openAttendanceInterval({
      liveTrainingSessionParticipantId: participantRow.id,
      liveTrainingSessionId: sessionTenant.id,
      liveTrainingId: sessionTenant.liveTrainingId,
      userId,
      joinedAt,
      livekitParticipantSid: participant.sid ?? null,
    });
    await this.liveTrainingSessionsRepository.updateParticipantAfterJoin(
      participantRow.id,
      joinedAt,
    );
    await this.liveTrainingSessionsRepository.updateSessionCounters(sessionTenant.id);
    await this.publishSessionEvent(event.event, sessionTenant, userId);
  }

  private async handleParticipantLeft(
    event: WebhookEvent,
    sessionTenant: { id: UUIDType; liveTrainingId: UUIDType; tenantId: UUIDType },
  ) {
    const participant = this.getWebhookParticipant(event);
    const userId = this.getUserIdFromIdentity(participant?.identity);

    if (!userId) return;

    const leftAt = this.getWebhookTimestamp(event);
    const closedInterval = await this.liveTrainingSessionsRepository.closeOpenAttendanceInterval({
      liveTrainingSessionId: sessionTenant.id,
      userId,
      leftAt,
      disconnectReason: event.event,
    });

    if (closedInterval) {
      await this.liveTrainingSessionsRepository.updateParticipantAfterLeave(
        closedInterval.participantId,
        this.getAttendedSeconds(closedInterval.joinedAt, leftAt),
        leftAt,
      );
    }

    await this.liveTrainingSessionsRepository.updateSessionCounters(sessionTenant.id);
    await this.publishSessionEvent(event.event, sessionTenant, userId);
  }

  private async handleRoomFinished(
    event: WebhookEvent,
    sessionTenant: { id: UUIDType; liveTrainingId: UUIDType; tenantId: UUIDType },
  ) {
    const endedAt = this.getWebhookTimestamp(event);
    const closedIntervals =
      await this.liveTrainingSessionsRepository.closeAllOpenAttendanceIntervals(
        sessionTenant.id,
        endedAt,
        UNEXPECTED_ROOM_FINISHED_REASON,
      );

    for (const interval of closedIntervals) {
      await this.liveTrainingSessionsRepository.updateParticipantAfterLeave(
        interval.participantId,
        this.getAttendedSeconds(interval.joinedAt, endedAt),
        endedAt,
      );
    }

    await this.liveTrainingSessionsRepository.markSessionFailed(
      sessionTenant.id,
      UNEXPECTED_ROOM_FINISHED_REASON,
    );
    await this.liveTrainingSessionsRepository.updateSessionCounters(sessionTenant.id);
    await this.publishSessionEvent(event.event, sessionTenant);

    const failedSession = await this.liveTrainingSessionsRepository.getSessionRow(
      sessionTenant.liveTrainingId,
      sessionTenant.id,
    );

    if (failedSession?.startedByUserId) {
      const actor = await this.liveTrainingSessionsRepository.getActorUserRow(
        failedSession.startedByUserId,
      );

      if (actor) {
        await this.publishSessionFailActivity({
          liveTrainingId: sessionTenant.liveTrainingId,
          sessionId: sessionTenant.id,
          actor,
          endedAt,
          endReason: UNEXPECTED_ROOM_FINISHED_REASON,
        });
      }
    }
  }

  private async publishSessionStartActivity(input: {
    liveTrainingId: UUIDType;
    sessionId: UUIDType;
    language: SupportedLanguages;
    currentUser: CurrentUserType;
    deliveryType: LiveTrainingDeliveryType;
    startedAt: string;
  }) {
    const liveTraining = await this.liveTrainingService.buildLiveTrainingActivitySnapshot(
      input.liveTrainingId,
      input.language,
    );

    await this.outboxPublisher.publish(
      new StartLiveTrainingSessionEvent({
        liveTrainingId: input.liveTrainingId,
        sessionId: input.sessionId,
        actor: input.currentUser,
        liveTraining,
        context: {
          sessionAction: "started",
          deliveryType: input.deliveryType,
          startedAt: input.startedAt,
        },
      }),
    );
  }

  private async publishSessionEndActivity(input: {
    liveTrainingId: UUIDType;
    sessionId: UUIDType;
    language: SupportedLanguages;
    currentUser: CurrentUserType;
    deliveryType: LiveTrainingDeliveryType;
    endedAt: string;
    endReason: string;
  }) {
    const liveTraining = await this.liveTrainingService.buildLiveTrainingActivitySnapshot(
      input.liveTrainingId,
      input.language,
    );

    await this.outboxPublisher.publish(
      new EndLiveTrainingSessionEvent({
        liveTrainingId: input.liveTrainingId,
        sessionId: input.sessionId,
        actor: input.currentUser,
        liveTraining,
        context: {
          sessionAction: "ended",
          deliveryType: input.deliveryType,
          endedAt: input.endedAt,
          endReason: input.endReason,
        },
      }),
    );
  }

  private async publishSessionFailActivity(input: {
    liveTrainingId: UUIDType;
    sessionId: UUIDType;
    actor: ActorUserType;
    endedAt: string;
    endReason: string;
  }) {
    const liveTraining = await this.getActivitySnapshotOrNull(
      input.liveTrainingId,
      SUPPORTED_LANGUAGES.EN,
    );

    await this.outboxPublisher.publish(
      new FailLiveTrainingSessionEvent({
        liveTrainingId: input.liveTrainingId,
        sessionId: input.sessionId,
        actor: input.actor,
        liveTraining,
        context: {
          sessionAction: "failed",
          endedAt: input.endedAt,
          endReason: input.endReason,
        },
      }),
    );
  }

  private async getActivitySnapshotOrNull(
    liveTrainingId: UUIDType,
    language: SupportedLanguages,
  ): Promise<LiveTrainingActivityLogSnapshot | null> {
    try {
      return await this.liveTrainingService.buildLiveTrainingActivitySnapshot(
        liveTrainingId,
        language,
      );
    } catch {
      return null;
    }
  }

  private async publishSessionEvent(
    eventName: string,
    sessionTenant: { id: UUIDType; liveTrainingId: UUIDType; tenantId: UUIDType },
    userId?: UUIDType,
  ) {
    await this.outboxPublisher.publish(
      new LiveTrainingSessionEvent({
        liveTrainingId: sessionTenant.liveTrainingId,
        sessionId: sessionTenant.id,
        tenantId: sessionTenant.tenantId,
        eventName,
        userId,
      }),
    );
  }

  private assertCanManageSession(
    liveTraining: {
      authorId: UUIDType;
      hostIds: UUIDType[];
    },
    currentUser: CurrentUserType,
  ) {
    if (this.canManageSession(liveTraining, currentUser)) return;

    throw new NotFoundException("liveTraining.errors.notFound");
  }

  private assertCanViewSessionData(
    liveTraining: {
      authorId: UUIDType;
      hostIds: UUIDType[];
    },
    currentUser: CurrentUserType,
  ) {
    if (
      this.canManageSession(liveTraining, currentUser) ||
      currentUser.permissions.includes(PERMISSIONS.LIVE_TRAINING_STATISTICS)
    ) {
      return;
    }

    throw new NotFoundException("liveTraining.errors.notFound");
  }

  private canManageSession(
    liveTraining: {
      authorId: UUIDType;
      hostIds: UUIDType[];
    },
    currentUser: CurrentUserType,
  ) {
    return (
      liveTraining.authorId === currentUser.userId ||
      liveTraining.hostIds.includes(currentUser.userId) ||
      currentUser.permissions.includes(PERMISSIONS.LIVE_TRAINING_UPDATE) ||
      currentUser.permissions.includes(PERMISSIONS.LIVE_TRAINING_START) ||
      currentUser.permissions.includes(PERMISSIONS.LIVE_TRAINING_END)
    );
  }

  private getParticipantRole(
    liveTraining: {
      authorId: UUIDType;
      hostIds: UUIDType[];
    },
    currentUser: CurrentUserType,
  ): LiveTrainingParticipantRole {
    if (currentUser.permissions.includes(PERMISSIONS.LIVE_TRAINING_UPDATE)) {
      return LIVE_TRAINING_PARTICIPANT_ROLES.ADMIN;
    }

    if (
      liveTraining.authorId === currentUser.userId ||
      liveTraining.hostIds.includes(currentUser.userId)
    ) {
      return LIVE_TRAINING_PARTICIPANT_ROLES.HOST;
    }

    return LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;
  }

  private async markLinkedLiveLessonsCompleted(input: {
    liveTrainingId: UUIDType;
    deliveryType: LiveTrainingDeliveryType;
    currentUser: CurrentUserType;
  }) {
    let completionRows: LiveTrainingLessonCompletionRow[];

    if (input.deliveryType === LIVE_TRAINING_DELIVERY_TYPES.OFFLINE) {
      completionRows = await this.liveTrainingSessionsRepository.getOfflineLiveLessonCompletionRows(
        input.liveTrainingId,
      );
    } else {
      completionRows = await this.liveTrainingSessionsRepository.getOnlineLiveLessonCompletionRows(
        input.liveTrainingId,
      );
    }

    for (const row of completionRows) {
      await this.studentLessonProgressService.markLessonAsCompleted({
        id: row.lessonId,
        studentId: row.studentId,
        actor: input.currentUser,
        language: row.language,
      });
    }
  }

  private async mapSessionSummary(
    row: LiveTrainingSessionRow,
  ): Promise<LiveTrainingSessionSummary> {
    const [startedByProfilePictureUrl, endedByProfilePictureUrl] = await Promise.all([
      this.getProfilePictureUrl(row.startedByAvatarReference),
      this.getProfilePictureUrl(row.endedByAvatarReference),
    ]);

    return {
      id: row.id,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      startedByUserId: row.startedByUserId,
      endedByUserId: row.endedByUserId,
      startedBy: row.startedByUserId
        ? {
            id: row.startedByUserId,
            fullName: row.startedByFullName,
            profilePictureUrl: startedByProfilePictureUrl,
          }
        : null,
      endedBy: row.endedByUserId
        ? {
            id: row.endedByUserId,
            fullName: row.endedByFullName,
            profilePictureUrl: endedByProfilePictureUrl,
          }
        : null,
      activeParticipantCount:
        row.status === LIVE_TRAINING_SESSION_STATUSES.ENDED ||
        row.status === LIVE_TRAINING_SESSION_STATUSES.FAILED
          ? 0
          : row.activeParticipantCount,
      uniqueParticipantCount: row.uniqueParticipantCount,
      peakParticipantCount: row.peakParticipantCount,
      endReason: row.endReason,
    };
  }

  private async getProfilePictureUrl(avatarReference: string | null) {
    if (!avatarReference) return null;

    return this.fileService.getFileUrl(avatarReference);
  }

  private getWebhookRoomName(event: WebhookEvent) {
    return event.room?.name ?? null;
  }

  private getWebhookParticipant(event: WebhookEvent) {
    return event.participant ?? null;
  }

  private getWebhookParticipantRole(metadata: string | undefined): LiveTrainingParticipantRole {
    if (!metadata) return LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;

    try {
      const parsed = JSON.parse(metadata) as { role?: unknown };
      const role = parsed.role;

      if (typeof role === "string" && this.isLiveTrainingParticipantRole(role)) {
        return role;
      }
    } catch {
      return LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;
    }

    return LIVE_TRAINING_PARTICIPANT_ROLES.OBSERVER;
  }

  private isLiveTrainingParticipantRole(role: string): role is LiveTrainingParticipantRole {
    return LIVE_TRAINING_PARTICIPANT_ROLE_VALUES.includes(role as LiveTrainingParticipantRole);
  }

  private getUserIdFromIdentity(identity: string | undefined) {
    if (!identity) return null;

    const [prefix, sessionId, userId] = identity.split(LIVEKIT_IDENTITY_SEPARATOR);

    if (prefix !== "lt" || !sessionId || !userId) return null;

    return userId as UUIDType;
  }

  private getWebhookTimestamp(event: WebhookEvent) {
    const createdAt = event.createdAt;
    const numericTimestamp = Number(createdAt);
    const timestamp =
      numericTimestamp < 1_000_000_000_000 ? numericTimestamp * 1000 : numericTimestamp;

    return new Date(timestamp || Date.now()).toISOString();
  }

  private getAttendedSeconds(joinedAt: string, leftAt: string) {
    const seconds = Math.floor((new Date(leftAt).getTime() - new Date(joinedAt).getTime()) / 1000);

    return Math.max(seconds, 0);
  }
}
