import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  COURSE_ENROLLMENT,
  LIVE_TRAINING_LINK_ENTITY_TYPES,
  LIVE_TRAINING_MEMBER_ROLES,
  LIVE_TRAINING_REGISTRATION_STATUSES as STATUS,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
} from "@repo/shared";
import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import {
  calendarEvents,
  liveTrainingLinks,
  liveTrainingMembers,
  liveTrainingSessions,
  liveTrainings,
  studentCourses,
  users,
} from "src/storage/schema";
import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type {
  RegistrationParticipant,
  RegistrationSummary,
} from "./live-training-registration.schema";
import type { LiveTrainingUpdateInput } from "../live-training.types";

@Injectable()
export class LiveTrainingRegistrationRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async list(id: UUIDType, db: DatabasePg = this.db): Promise<RegistrationParticipant[]> {
    return db
      .select({
        userId: liveTrainingMembers.userId,
        fullName: sql<string>`concat_ws(' ', ${users.firstName}, ${users.lastName})`,
        status: sql<RegistrationParticipant["status"]>`${liveTrainingMembers.metadata}->>'status'`,
        joinedAt: liveTrainingMembers.createdAt,
      })
      .from(liveTrainingMembers)
      .innerJoin(users, eq(users.id, liveTrainingMembers.userId))
      .where(
        and(
          eq(liveTrainingMembers.liveTrainingId, id),
          eq(liveTrainingMembers.role, LIVE_TRAINING_MEMBER_ROLES.ATTENDEE),
        ),
      )
      .orderBy(asc(liveTrainingMembers.createdAt), asc(liveTrainingMembers.id));
  }

  async summary(id: UUIDType, userId: UUIDType): Promise<RegistrationSummary> {
    const [row, members] = await Promise.all([this.getTraining(id), this.list(id)]);
    const waiting = members.filter((member) => member.status === STATUS.WAITLISTED);
    const own = members.find((member) => member.userId === userId);
    return {
      registeredCount: members.filter((member) => member.status === STATUS.REGISTERED).length,
      waitlistedCount: waiting.length,
      status: own?.status ?? null,
      position:
        own?.status === STATUS.WAITLISTED
          ? waiting.findIndex((member) => member.userId === userId) + 1
          : null,
      isOpen:
        Boolean(row.settings.registrationRequired) &&
        row.status === LIVE_TRAINING_STATUSES.SCHEDULED &&
        new Date(row.startsAt).getTime() > Date.now() &&
        !row.hasOpenSession,
    };
  }

  private async getTraining(id: UUIDType, db: DatabasePg = this.db, lock = false) {
    const query = db
      .select({
        id: liveTrainings.id,
        settings: liveTrainings.settings,
        status: liveTrainings.status,
        maxParticipants: liveTrainings.maxParticipants,
        startsAt: calendarEvents.startsAt,
        hasOpenSession: sql<boolean>`exists(select 1 from ${liveTrainingSessions} where ${liveTrainingSessions.liveTrainingId} = ${liveTrainings.id} and ${liveTrainingSessions.status} in (${LIVE_TRAINING_SESSION_STATUSES.WAITING}, ${LIVE_TRAINING_SESSION_STATUSES.ACTIVE}))`,
      })
      .from(liveTrainings)
      .innerJoin(calendarEvents, eq(calendarEvents.id, liveTrainings.calendarEventId))
      .where(and(eq(liveTrainings.id, id), isNull(liveTrainings.deletedAt)));
    const [row] = await (lock ? query.for("update", { of: liveTrainings }) : query);
    if (!row) throw new NotFoundException("liveTraining.errors.notFound");
    return row;
  }

  private async eligible(id: UUIDType, userId: UUIDType, db: DatabasePg) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .innerJoin(liveTrainings, eq(liveTrainings.id, id))
      .where(
        and(
          eq(users.id, userId),
          isNull(users.deletedAt),
          eq(users.archived, false),
          sql`(
        ${liveTrainings.visibilityScope} = ${LIVE_TRAINING_VISIBILITY_SCOPES.ALL} or exists (
          select 1 from ${liveTrainingLinks} inner join ${studentCourses} on ${studentCourses.courseId} = ${liveTrainingLinks.entityId}
          where ${liveTrainingLinks.liveTrainingId} = ${liveTrainings.id}
          and ${liveTrainingLinks.entityType} = ${LIVE_TRAINING_LINK_ENTITY_TYPES.COURSE}
          and ${studentCourses.studentId} = ${users.id} and ${studentCourses.status} = ${COURSE_ENROLLMENT.ENROLLED}
        ))`,
        ),
      );
    return Boolean(row);
  }

  private async promote(id: UUIDType, capacity: number, db: DatabasePg) {
    const members = await this.list(id, db);
    let free = capacity - members.filter((member) => member.status === STATUS.REGISTERED).length;
    for (const member of members) {
      if (free <= 0) break;
      if (member.status !== STATUS.WAITLISTED || !(await this.eligible(id, member.userId, db)))
        continue;
      await db
        .update(liveTrainingMembers)
        .set({
          metadata: sql`${liveTrainingMembers.metadata} || ${settingsToJSONBuildObject({ status: STATUS.REGISTERED })}::jsonb`,
        })
        .where(
          and(
            eq(liveTrainingMembers.liveTrainingId, id),
            eq(liveTrainingMembers.userId, member.userId),
            eq(liveTrainingMembers.role, LIVE_TRAINING_MEMBER_ROLES.ATTENDEE),
          ),
        );
      free -= 1;
    }
  }

  async change(id: UUIDType, userId: UUIDType, cancel: boolean) {
    await this.db.transaction(async (tx) => {
      const row = await this.getTraining(id, tx, true);
      if (
        !row.settings.registrationRequired ||
        row.status !== LIVE_TRAINING_STATUSES.SCHEDULED ||
        row.hasOpenSession ||
        new Date(row.startsAt).getTime() <= Date.now()
      ) {
        throw new BadRequestException("liveTraining.errors.registrationClosed");
      }
      if (cancel) {
        await tx
          .delete(liveTrainingMembers)
          .where(
            and(
              eq(liveTrainingMembers.liveTrainingId, id),
              eq(liveTrainingMembers.userId, userId),
              eq(liveTrainingMembers.role, LIVE_TRAINING_MEMBER_ROLES.ATTENDEE),
            ),
          );
      } else {
        if (!(await this.eligible(id, userId, tx)))
          throw new BadRequestException("liveTraining.errors.registrationIneligible");
        const [existing] = await tx
          .select()
          .from(liveTrainingMembers)
          .where(
            and(eq(liveTrainingMembers.liveTrainingId, id), eq(liveTrainingMembers.userId, userId)),
          );
        if (existing && existing.role !== LIVE_TRAINING_MEMBER_ROLES.ATTENDEE)
          throw new BadRequestException("liveTraining.errors.hostRegistration");
        if (!existing)
          await tx.insert(liveTrainingMembers).values({
            liveTrainingId: id,
            userId,
            role: LIVE_TRAINING_MEMBER_ROLES.ATTENDEE,
            metadata: settingsToJSONBuildObject({ status: STATUS.WAITLISTED }),
          });
      }
      await this.promote(id, row.maxParticipants, tx);
    });
    return this.summary(id, userId);
  }

  async updateTraining(id: UUIDType, data: LiveTrainingUpdateInput) {
    await this.db.transaction(async (tx) => {
      const row = await this.getTraining(id, tx, true);
      if (row.hasOpenSession)
        throw new BadRequestException("liveTraining.errors.activeSessionUpdateForbidden");
      const members = await this.list(id, tx);
      if (
        data.settings &&
        Boolean(data.settings.registrationRequired) !==
          Boolean(row.settings.registrationRequired) &&
        members.length
      ) {
        throw new BadRequestException("liveTraining.errors.registrationModeLocked");
      }
      const registered = members.filter((member) => member.status === STATUS.REGISTERED).length;
      if (data.maxParticipants !== undefined && data.maxParticipants < registered)
        throw new BadRequestException("liveTraining.errors.capacityBelowRegistrations");
      await tx
        .update(liveTrainings)
        .set({
          ...data,
          settings: data.settings ? settingsToJSONBuildObject(data.settings) : undefined,
        })
        .where(eq(liveTrainings.id, id));
      if (
        row.settings.registrationRequired &&
        !row.hasOpenSession &&
        new Date(row.startsAt).getTime() > Date.now()
      )
        await this.promote(id, data.maxParticipants ?? row.maxParticipants, tx);
    });
  }
}
