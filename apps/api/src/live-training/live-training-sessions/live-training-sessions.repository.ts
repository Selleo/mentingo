import { Inject, Injectable } from "@nestjs/common";
import {
  CALENDAR_EVENT_STATUSES,
  COURSE_ENROLLMENT,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  type LiveTrainingParticipantRole,
  type PermissionKey,
} from "@repo/shared";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg } from "src/common";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  liveTrainingAttendance,
  liveTrainingSessionParticipants,
  liveTrainingSessions,
  liveLessons,
  calendarEvents,
  chapters,
  lessons,
  liveTrainings,
  permissionRoles,
  permissionRoleRuleSets,
  permissionRuleSetPermissions,
  permissionUserRoles,
  studentCourses,
  users,
} from "src/storage/schema";

import type {
  LiveTrainingAttendanceRow,
  LiveTrainingCreatedSessionRow,
  LiveTrainingLessonCompletionRow,
  LiveTrainingSessionParticipantRow,
  LiveTrainingSessionRow,
  LiveTrainingSessionRoomRow,
  LiveTrainingSessionTenantRow,
  LiveTrainingUserDisplayRow,
} from "./live-training-sessions.repository.types";
import type { UUIDType } from "src/common";
import type { ActorUserType } from "src/common/types/actor-user.type";

@Injectable()
export class LiveTrainingSessionsRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly adminDb: DatabasePg,
  ) {}

  async getSessionRows(liveTrainingId: UUIDType): Promise<LiveTrainingSessionRow[]> {
    return this.getSessionRowsByConditions(eq(liveTrainingSessions.liveTrainingId, liveTrainingId));
  }

  async getCurrentSessionRow(liveTrainingId: UUIDType): Promise<LiveTrainingSessionRow | null> {
    const [row] = await this.getSessionRowsByConditions(
      and(
        eq(liveTrainingSessions.liveTrainingId, liveTrainingId),
        inArray(liveTrainingSessions.status, [
          LIVE_TRAINING_SESSION_STATUSES.WAITING,
          LIVE_TRAINING_SESSION_STATUSES.ACTIVE,
        ]),
      ),
    );

    return row ?? null;
  }

  async countCurrentSessions() {
    const [{ totalItems }] = await this.db
      .select({ totalItems: count() })
      .from(liveTrainingSessions)
      .where(
        inArray(liveTrainingSessions.status, [
          LIVE_TRAINING_SESSION_STATUSES.WAITING,
          LIVE_TRAINING_SESSION_STATUSES.ACTIVE,
        ]),
      );

    return totalItems;
  }

  async getSessionRow(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
  ): Promise<LiveTrainingSessionRow | null> {
    const [row] = await this.getSessionRowsByConditions(
      and(
        eq(liveTrainingSessions.liveTrainingId, liveTrainingId),
        eq(liveTrainingSessions.id, sessionId),
      ),
    );

    return row ?? null;
  }

  private async getSessionRowsByConditions(
    conditions: ReturnType<typeof and>,
  ): Promise<LiveTrainingSessionRow[]> {
    const startedBy = alias(users, "started_by_user");
    const endedBy = alias(users, "ended_by_user");

    return this.db
      .select({
        id: liveTrainingSessions.id,
        status: liveTrainingSessions.status,
        startedAt: liveTrainingSessions.startedAt,
        endedAt: liveTrainingSessions.endedAt,
        startedByUserId: liveTrainingSessions.startedByUserId,
        endedByUserId: liveTrainingSessions.endedByUserId,
        startedByFullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${startedBy.firstName}, ${startedBy.lastName}), '')`,
        startedByAvatarReference: startedBy.avatarReference,
        endedByFullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${endedBy.firstName}, ${endedBy.lastName}), '')`,
        endedByAvatarReference: endedBy.avatarReference,
        peakParticipantCount: liveTrainingSessions.peakParticipantCount,
        uniqueParticipantCount: liveTrainingSessions.uniqueParticipantCount,
        activeParticipantCount: sql<number>`count(${liveTrainingAttendance.id})::int`,
        endReason: liveTrainingSessions.endReason,
      })
      .from(liveTrainingSessions)
      .leftJoin(startedBy, eq(startedBy.id, liveTrainingSessions.startedByUserId))
      .leftJoin(endedBy, eq(endedBy.id, liveTrainingSessions.endedByUserId))
      .leftJoin(
        liveTrainingAttendance,
        and(
          eq(liveTrainingAttendance.liveTrainingSessionId, liveTrainingSessions.id),
          isNull(liveTrainingAttendance.leftAt),
        ),
      )
      .where(conditions)
      .groupBy(liveTrainingSessions.id, startedBy.id, endedBy.id)
      .orderBy(desc(liveTrainingSessions.createdAt));
  }

  async getParticipantRows(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
  ): Promise<LiveTrainingSessionParticipantRow[]> {
    return this.db
      .select({
        id: liveTrainingSessionParticipants.id,
        userId: liveTrainingSessionParticipants.userId,
        fullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        avatarReference: users.avatarReference,
        role: liveTrainingSessionParticipants.role,
        firstJoinedAt: liveTrainingSessionParticipants.firstJoinedAt,
        lastLeftAt: liveTrainingSessionParticipants.lastLeftAt,
        totalSeconds: liveTrainingSessionParticipants.totalSeconds,
        joinCount: liveTrainingSessionParticipants.joinCount,
      })
      .from(liveTrainingSessionParticipants)
      .innerJoin(users, eq(users.id, liveTrainingSessionParticipants.userId))
      .where(
        and(
          eq(liveTrainingSessionParticipants.liveTrainingId, liveTrainingId),
          eq(liveTrainingSessionParticipants.liveTrainingSessionId, sessionId),
        ),
      )
      .orderBy(users.firstName, users.lastName, users.email);
  }

  async getAttendanceRows(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
  ): Promise<LiveTrainingAttendanceRow[]> {
    return this.db
      .select({
        id: liveTrainingAttendance.id,
        participantId: liveTrainingAttendance.liveTrainingSessionParticipantId,
        joinedAt: liveTrainingAttendance.joinedAt,
        leftAt: liveTrainingAttendance.leftAt,
        disconnectReason: liveTrainingAttendance.disconnectReason,
      })
      .from(liveTrainingAttendance)
      .where(
        and(
          eq(liveTrainingAttendance.liveTrainingId, liveTrainingId),
          eq(liveTrainingAttendance.liveTrainingSessionId, sessionId),
        ),
      )
      .orderBy(liveTrainingAttendance.joinedAt);
  }

  async getUserDisplayRow(userId: UUIDType): Promise<LiveTrainingUserDisplayRow | null> {
    const [row] = await this.db
      .select({
        id: users.id,
        fullName: sql<
          string | null
        >`nullif(concat_ws(' ', ${users.firstName}, ${users.lastName}), '')`,
        avatarReference: users.avatarReference,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)));

    return row ?? null;
  }

  async getActorUserRow(userId: UUIDType): Promise<ActorUserType | null> {
    const [user] = await this.db
      .select({
        userId: users.id,
        email: users.email,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.archived, false), isNull(users.deletedAt)));

    if (!user) return null;

    const accessRows = await this.db
      .select({
        roleSlug: permissionRoles.slug,
        permission: permissionRuleSetPermissions.permission,
      })
      .from(permissionUserRoles)
      .innerJoin(
        permissionRoles,
        and(
          eq(permissionRoles.id, permissionUserRoles.roleId),
          eq(permissionRoles.tenantId, permissionUserRoles.tenantId),
        ),
      )
      .leftJoin(
        permissionRoleRuleSets,
        and(
          eq(permissionRoleRuleSets.roleId, permissionRoles.id),
          eq(permissionRoleRuleSets.tenantId, permissionRoles.tenantId),
        ),
      )
      .leftJoin(
        permissionRuleSetPermissions,
        and(
          eq(permissionRuleSetPermissions.ruleSetId, permissionRoleRuleSets.ruleSetId),
          eq(permissionRuleSetPermissions.tenantId, permissionRoleRuleSets.tenantId),
        ),
      )
      .where(
        and(
          eq(permissionUserRoles.userId, userId),
          eq(permissionUserRoles.tenantId, user.tenantId),
        ),
      );

    return {
      ...user,
      roleSlugs: Array.from(new Set(accessRows.map(({ roleSlug }) => roleSlug))),
      permissions: Array.from(
        new Set(
          accessRows
            .map(({ permission }) => permission)
            .filter((permission): permission is PermissionKey => Boolean(permission)),
        ),
      ),
    };
  }

  async getSessionTenantByRoomName(roomName: string): Promise<LiveTrainingSessionTenantRow | null> {
    const [row] = await this.adminDb
      .select({
        id: liveTrainingSessions.id,
        liveTrainingId: liveTrainingSessions.liveTrainingId,
        tenantId: liveTrainingSessions.tenantId,
      })
      .from(liveTrainingSessions)
      .where(eq(liveTrainingSessions.livekitRoomName, roomName));

    return row ?? null;
  }

  async createWaitingSession(input: {
    liveTrainingId: UUIDType;
    startedByUserId: UUIDType;
  }): Promise<LiveTrainingCreatedSessionRow> {
    const [row] = await this.db
      .insert(liveTrainingSessions)
      .values({
        liveTrainingId: input.liveTrainingId,
        startedAt: sql`CURRENT_TIMESTAMP`,
        startedByUserId: input.startedByUserId,
        status: LIVE_TRAINING_SESSION_STATUSES.WAITING,
      })
      .returning({ id: liveTrainingSessions.id });

    return row;
  }

  async activateLiveTrainingSession(input: {
    liveTrainingId: UUIDType;
    sessionId: UUIDType;
    calendarEventId: UUIDType;
    roomName: string | null;
    roomSid: string | null;
  }) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(liveTrainingSessions)
        .set({
          livekitRoomName: input.roomName,
          livekitRoomSid: input.roomSid,
        })
        .where(
          and(
            eq(liveTrainingSessions.id, input.sessionId),
            eq(liveTrainingSessions.liveTrainingId, input.liveTrainingId),
          ),
        );

      await tx
        .update(liveTrainings)
        .set({ status: LIVE_TRAINING_STATUSES.ACTIVE })
        .where(eq(liveTrainings.id, input.liveTrainingId));

      await tx
        .update(calendarEvents)
        .set({
          status: CALENDAR_EVENT_STATUSES.SCHEDULED,
          sequence: sql`${calendarEvents.sequence} + 1`,
        })
        .where(eq(calendarEvents.id, input.calendarEventId));
    });
  }

  async getSessionRoomRow(
    liveTrainingId: UUIDType,
    sessionId: UUIDType,
  ): Promise<LiveTrainingSessionRoomRow | null> {
    const [row] = await this.db
      .select({
        id: liveTrainingSessions.id,
        liveTrainingId: liveTrainingSessions.liveTrainingId,
        status: liveTrainingSessions.status,
        livekitRoomName: liveTrainingSessions.livekitRoomName,
      })
      .from(liveTrainingSessions)
      .where(
        and(
          eq(liveTrainingSessions.liveTrainingId, liveTrainingId),
          eq(liveTrainingSessions.id, sessionId),
        ),
      );

    return row ?? null;
  }

  async markSessionActive(sessionId: UUIDType) {
    await this.db
      .update(liveTrainingSessions)
      .set({ status: LIVE_TRAINING_SESSION_STATUSES.ACTIVE })
      .where(
        and(
          eq(liveTrainingSessions.id, sessionId),
          eq(liveTrainingSessions.status, LIVE_TRAINING_SESSION_STATUSES.WAITING),
        ),
      );
  }

  async markSessionFailed(sessionId: UUIDType, reason: string) {
    await this.db
      .update(liveTrainingSessions)
      .set({
        status: LIVE_TRAINING_SESSION_STATUSES.FAILED,
        endedAt: sql`CURRENT_TIMESTAMP`,
        endReason: reason,
      })
      .where(
        and(
          eq(liveTrainingSessions.id, sessionId),
          inArray(liveTrainingSessions.status, [
            LIVE_TRAINING_SESSION_STATUSES.WAITING,
            LIVE_TRAINING_SESSION_STATUSES.ACTIVE,
          ]),
        ),
      );
  }

  async upsertParticipant(input: {
    liveTrainingSessionId: UUIDType;
    liveTrainingId: UUIDType;
    userId: UUIDType;
    role: LiveTrainingParticipantRole;
    livekitIdentity: string;
  }) {
    const [row] = await this.db
      .insert(liveTrainingSessionParticipants)
      .values(input)
      .onConflictDoUpdate({
        target: [
          liveTrainingSessionParticipants.liveTrainingSessionId,
          liveTrainingSessionParticipants.userId,
        ],
        set: {
          role: input.role,
          livekitIdentity: input.livekitIdentity,
        },
      })
      .returning({ id: liveTrainingSessionParticipants.id });

    return row;
  }

  async upsertWebhookParticipant(input: {
    liveTrainingSessionId: UUIDType;
    liveTrainingId: UUIDType;
    userId: UUIDType;
    role: LiveTrainingParticipantRole;
    livekitIdentity: string;
  }) {
    const [row] = await this.db
      .insert(liveTrainingSessionParticipants)
      .values(input)
      .onConflictDoUpdate({
        target: [
          liveTrainingSessionParticipants.liveTrainingSessionId,
          liveTrainingSessionParticipants.userId,
        ],
        set: {
          livekitIdentity: input.livekitIdentity,
        },
      })
      .returning({ id: liveTrainingSessionParticipants.id });

    return row;
  }

  async openAttendanceInterval(input: {
    liveTrainingSessionParticipantId: UUIDType;
    liveTrainingSessionId: UUIDType;
    liveTrainingId: UUIDType;
    userId: UUIDType;
    joinedAt: string;
    livekitParticipantSid: string | null;
  }) {
    const existingOpenInterval = await this.getOpenAttendanceInterval(
      input.liveTrainingSessionId,
      input.userId,
    );

    if (existingOpenInterval) return existingOpenInterval;

    const [row] = await this.db
      .insert(liveTrainingAttendance)
      .values(input)
      .returning({ id: liveTrainingAttendance.id });

    return row;
  }

  async closeOpenAttendanceInterval(input: {
    liveTrainingSessionId: UUIDType;
    userId: UUIDType;
    leftAt: string;
    disconnectReason: string | null;
  }) {
    const [row] = await this.db
      .update(liveTrainingAttendance)
      .set({
        leftAt: input.leftAt,
        disconnectReason: input.disconnectReason,
      })
      .where(
        and(
          eq(liveTrainingAttendance.liveTrainingSessionId, input.liveTrainingSessionId),
          eq(liveTrainingAttendance.userId, input.userId),
          isNull(liveTrainingAttendance.leftAt),
        ),
      )
      .returning({
        id: liveTrainingAttendance.id,
        participantId: liveTrainingAttendance.liveTrainingSessionParticipantId,
        joinedAt: liveTrainingAttendance.joinedAt,
        leftAt: liveTrainingAttendance.leftAt,
      });

    return row ?? null;
  }

  async closeAllOpenAttendanceIntervals(sessionId: UUIDType, leftAt: string, reason: string) {
    return this.db
      .update(liveTrainingAttendance)
      .set({ leftAt, disconnectReason: reason })
      .where(
        and(
          eq(liveTrainingAttendance.liveTrainingSessionId, sessionId),
          isNull(liveTrainingAttendance.leftAt),
        ),
      )
      .returning({
        participantId: liveTrainingAttendance.liveTrainingSessionParticipantId,
        joinedAt: liveTrainingAttendance.joinedAt,
        leftAt: liveTrainingAttendance.leftAt,
      });
  }

  async finishSessionAndLiveTraining(input: {
    liveTrainingId: UUIDType;
    sessionId: UUIDType;
    calendarEventId: UUIDType;
    endedByUserId: UUIDType;
    endedAt: string;
  }) {
    await this.db.transaction(async (tx) => {
      await tx
        .update(liveTrainingSessions)
        .set({
          status: LIVE_TRAINING_SESSION_STATUSES.ENDED,
          endedAt: input.endedAt,
          endedByUserId: input.endedByUserId,
          endReason: LIVE_TRAINING_SESSION_STATUSES.ENDED,
        })
        .where(
          and(
            eq(liveTrainingSessions.id, input.sessionId),
            eq(liveTrainingSessions.liveTrainingId, input.liveTrainingId),
          ),
        );

      await tx
        .update(liveTrainings)
        .set({ status: LIVE_TRAINING_STATUSES.ENDED })
        .where(eq(liveTrainings.id, input.liveTrainingId));

      await tx
        .update(calendarEvents)
        .set({
          status: CALENDAR_EVENT_STATUSES.ENDED,
          sequence: sql`${calendarEvents.sequence} + 1`,
        })
        .where(eq(calendarEvents.id, input.calendarEventId));
    });
  }

  async getOnlineLiveLessonCompletionRows(
    liveTrainingId: UUIDType,
  ): Promise<LiveTrainingLessonCompletionRow[]> {
    return this.db
      .selectDistinct({
        lessonId: liveLessons.lessonId,
        studentId: liveTrainingSessionParticipants.userId,
        language: liveLessons.language,
      })
      .from(liveLessons)
      .innerJoin(
        liveTrainingSessionParticipants,
        eq(liveTrainingSessionParticipants.liveTrainingId, liveLessons.liveTrainingId),
      )
      .innerJoin(lessons, eq(lessons.id, liveLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, chapters.courseId),
          eq(studentCourses.studentId, liveTrainingSessionParticipants.userId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(
        and(
          eq(liveLessons.liveTrainingId, liveTrainingId),
          sql`${liveTrainingSessionParticipants.joinCount} > 0`,
        ),
      );
  }

  async getOfflineLiveLessonCompletionRows(
    liveTrainingId: UUIDType,
  ): Promise<LiveTrainingLessonCompletionRow[]> {
    return this.db
      .selectDistinct({
        lessonId: liveLessons.lessonId,
        studentId: studentCourses.studentId,
        language: liveLessons.language,
      })
      .from(liveLessons)
      .innerJoin(lessons, eq(lessons.id, liveLessons.lessonId))
      .innerJoin(chapters, eq(chapters.id, lessons.chapterId))
      .innerJoin(
        studentCourses,
        and(
          eq(studentCourses.courseId, chapters.courseId),
          eq(studentCourses.status, COURSE_ENROLLMENT.ENROLLED),
        ),
      )
      .where(eq(liveLessons.liveTrainingId, liveTrainingId));
  }

  async updateParticipantAfterJoin(participantId: UUIDType, joinedAt: string) {
    await this.db
      .update(liveTrainingSessionParticipants)
      .set({
        firstJoinedAt: sql`coalesce(${liveTrainingSessionParticipants.firstJoinedAt}, ${joinedAt})`,
        joinCount: sql`${liveTrainingSessionParticipants.joinCount} + 1`,
      })
      .where(eq(liveTrainingSessionParticipants.id, participantId));
  }

  async updateParticipantAfterLeave(
    participantId: UUIDType,
    attendedSeconds: number,
    leftAt: string,
  ) {
    await this.db
      .update(liveTrainingSessionParticipants)
      .set({
        lastLeftAt: leftAt,
        totalSeconds: sql`${liveTrainingSessionParticipants.totalSeconds} + ${attendedSeconds}`,
      })
      .where(eq(liveTrainingSessionParticipants.id, participantId));
  }

  async updateSessionCounters(sessionId: UUIDType) {
    await this.db
      .update(liveTrainingSessions)
      .set({
        uniqueParticipantCount: sql`(
          select count(distinct ${liveTrainingSessionParticipants.userId})::int
          from ${liveTrainingSessionParticipants}
          where ${liveTrainingSessionParticipants.liveTrainingSessionId} = ${sessionId}
        )`,
        peakParticipantCount: sql`greatest(
          ${liveTrainingSessions.peakParticipantCount},
          (
            select count(*)::int
            from ${liveTrainingAttendance}
            where ${liveTrainingAttendance.liveTrainingSessionId} = ${sessionId}
              and ${liveTrainingAttendance.leftAt} is null
          )
        )`,
      })
      .where(eq(liveTrainingSessions.id, sessionId));
  }

  private async getOpenAttendanceInterval(sessionId: UUIDType, userId: UUIDType) {
    const [row] = await this.db
      .select({ id: liveTrainingAttendance.id })
      .from(liveTrainingAttendance)
      .where(
        and(
          eq(liveTrainingAttendance.liveTrainingSessionId, sessionId),
          eq(liveTrainingAttendance.userId, userId),
          isNull(liveTrainingAttendance.leftAt),
        ),
      );

    return row ?? null;
  }
}
