import {
  LESSON_TYPES,
  CERTIFICATE_STATUSES,
  CERTIFICATE_ARCHIVE_REASONS,
  PERMISSIONS,
} from "@repo/shared";
import { eq } from "drizzle-orm";

import { LearningFactsRepository } from "src/integration/repositories/learning-facts.repository";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  studentCourses,
  studentLessonProgress,
  certificates,
  courses,
  courseLearningStates,
  groupManagerGroups,
  users,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createGroupFactory } from "../../../test/factory/group.factory";
import { createLessonFactory } from "../../../test/factory/lesson.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { CompetenciesSyncService } from "../competencies-sync.service";
import { CompetenciesWorker } from "../competencies.worker";
import { CompetenciesContextRepository } from "../repositories/competencies-context.repository";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

describe("Competencies source snapshots (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let inTenant: <T>(operation: () => Promise<T>) => Promise<T>;
  beforeAll(async () => {
    const setup = await createE2ETest({
      useDbProxy: true,
      customProviders: [
        { provide: CompetenciesWorker, useValue: {} },
        { provide: CompetenciesSyncService, useValue: {} },
      ],
    });
    app = setup.app;
    db = app.get(DB);
    inTenant = (operation) => setup.runAsTenant(setup.defaultTenantId, operation);
  });
  afterAll(async () => {
    await app?.close();
  });
  it("keeps source attribution by internal identity through renaming, archive and soft deletion", () =>
    inTenant(async () => {
      const subject = await createUserFactory(db).create();
      const course = await createCourseFactory(db).create({ hasCertificate: false });
      await db.insert(studentCourses).values({
        courseId: course.id,
        studentId: subject.id,
        status: "enrolled",
        completedAt: "2026-01-03T10:00:00.000Z",
      });
      const repository = new CompetenciesContextRepository(db, app.get(LocalizationService));
      const facts = new LearningFactsRepository(db);
      const original = (await facts.snapshot(subject.id, course.id)).facts;
      await db
        .update(users)
        .set({ firstName: "Renamed", lastName: "Person" })
        .where(eq(users.id, subject.id));
      expect(await repository.findPeople([subject.id])).toEqual([
        { id: subject.id, name: "Renamed Person", archived: false, avatarReference: null },
      ]);
      expect((await facts.snapshot(subject.id, course.id)).facts).toEqual(original);
      const sameName = await createUserFactory(db).create({
        firstName: "Renamed",
        lastName: "Person",
      });
      expect((await facts.snapshot(sameName.id, course.id)).facts).toEqual([]);
      await db.update(users).set({ archived: true }).where(eq(users.id, subject.id));
      expect(await repository.findActorIdentity(subject.id)).toBeNull();
      expect(await repository.findPeople([subject.id])).toEqual([
        { id: subject.id, name: "Renamed Person", archived: true, avatarReference: null },
      ]);
      expect((await facts.snapshot(subject.id, course.id)).facts).toEqual(original);
      await db
        .update(users)
        .set({ deletedAt: new Date().toISOString() })
        .where(eq(users.id, subject.id));
      expect(await repository.findActorIdentity(subject.id)).toBeNull();
      expect(await repository.findPeople([subject.id])).toEqual([]);
      expect((await facts.snapshot(subject.id, course.id)).facts).toEqual(original);
    }));
  it("reads current manager membership after a transfer without relying on the previous scope", () =>
    inTenant(async () => {
      const subject = await createUserFactory(db).create();
      const previous = await createUserFactory(db).create();
      const next = await createUserFactory(db).create();
      const group = await createGroupFactory(db).withMembers([subject.id]).create();
      const [assignment] = await db
        .insert(groupManagerGroups)
        .values({ managerUserId: previous.id, groupId: group.id })
        .returning();
      const repository = new CompetenciesContextRepository(db, app.get(LocalizationService));
      const actor = (user: typeof previous) => ({
        userId: user.id,
        tenantId: user.tenantId,
        email: user.email,
        roleSlugs: [],
        permissions: [PERMISSIONS.COMPETENCIES_USE, PERMISSIONS.MANAGED_GROUP_RESULTS_READ],
      });
      expect(await repository.findManagedSubjects(actor(previous))).toContainEqual({
        id: subject.id,
      });
      expect(await repository.findManagedSubjects(actor(next))).toEqual([]);
      await db
        .update(groupManagerGroups)
        .set({ managerUserId: next.id })
        .where(eq(groupManagerGroups.id, assignment.id));
      expect(await repository.findManagedSubjects(actor(previous))).toEqual([]);
      expect(await repository.findManagedSubjects(actor(next))).toContainEqual({ id: subject.id });
    }));
  it("preserves source completion and certificate dates across repeated reads and emits an empty snapshot after source removal", () =>
    inTenant(async () => {
      const user = await createUserFactory(db).create();
      const course = await createCourseFactory(db).create({
        hasCertificate: false,
        status: "published",
      });
      const completedAt = "2026-01-03T10:00:00.000Z";
      await db
        .insert(studentCourses)
        .values({ courseId: course.id, studentId: user.id, status: "enrolled", completedAt });
      const repository = new LearningFactsRepository(db);
      const first = await repository.snapshot(user.id, course.id);
      const repeated = await repository.snapshot(user.id, course.id);
      expect(first.facts).toHaveLength(1);
      expect(repeated.facts).toEqual(first.facts);
      expect(first.facts[0]).toMatchObject({
        occurredAt: completedAt,
        validUntil: null,
        outcome: "passed",
        kind: "course",
      });
      const chapter = await createChapterFactory(db).create({ courseId: course.id });
      const quiz = await createLessonFactory(db).create({
        chapterId: chapter.id,
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 70,
      });
      await db.insert(studentLessonProgress).values({
        studentId: user.id,
        chapterId: chapter.id,
        lessonId: quiz.id,
        completedAt,
        isQuizPassed: true,
        quizScore: 86,
      });
      expect((await repository.snapshot(user.id, course.id)).facts).toEqual([
        expect.objectContaining({ kind: "course", resourceId: course.id }),
      ]);
      const [certificate] = await db
        .insert(certificates)
        .values({
          userId: user.id,
          courseId: course.id,
          issuedAt: completedAt,
          expiresAt: "2026-12-01T00:00:00.000Z",
        })
        .returning();
      await db.update(courses).set({ hasCertificate: true }).where(eq(courses.id, course.id));
      expect(
        (await repository.snapshot(user.id, course.id)).facts.find(
          (fact) => fact.kind === "course",
        ),
      ).toMatchObject({
        occurredAt: completedAt,
        validUntil: "2026-12-01T00:00:00.000Z",
        outcome: "passed",
      });
      await db
        .update(certificates)
        .set({
          status: CERTIFICATE_STATUSES.ARCHIVED,
          archiveReason: CERTIFICATE_ARCHIVE_REASONS.EXPIRED,
        })
        .where(eq(certificates.id, certificate.id));
      expect(
        (await repository.snapshot(user.id, course.id)).facts.find(
          (fact) => fact.kind === "course",
        ),
      ).toMatchObject({ outcome: "passed", validUntil: "2026-12-01T00:00:00.000Z" });
      await db.delete(studentLessonProgress).where(eq(studentLessonProgress.studentId, user.id));
      await db.delete(studentCourses).where(eq(studentCourses.studentId, user.id));
      const removed = await repository.snapshot(user.id, course.id);
      expect(removed.facts).toEqual([]);
      expect(removed.revision).toBeGreaterThan(first.revision);
    }));
  it("starts a new course fact when a repeated course completion becomes current", () =>
    inTenant(async () => {
      const user = await createUserFactory(db).create();
      const course = await createCourseFactory(db).create({ hasCertificate: false });
      const completedAt = "2026-03-01T12:00:00.000Z";
      const [initial] = await db
        .insert(courseLearningStates)
        .values({ studentId: user.id, courseId: course.id, kind: "current", completedAt })
        .returning();
      await db
        .insert(studentCourses)
        .values({ studentId: user.id, courseId: course.id, completedAt });
      const repository = new LearningFactsRepository(db);
      const before = await repository.snapshot(user.id, course.id);
      expect(before.facts.find((fact) => fact.kind === "course")).toMatchObject({
        outcome: "passed",
        learningStateId: initial.id,
        occurredAt: completedAt,
      });
      await db.delete(courseLearningStates).where(eq(courseLearningStates.id, initial.id));
      const [repeated] = await db
        .insert(courseLearningStates)
        .values({
          studentId: user.id,
          courseId: course.id,
          kind: "current",
          completedAt: "2026-04-01T12:00:00.000Z",
        })
        .returning();
      await db
        .update(studentCourses)
        .set({ completedAt: "2026-04-01T12:00:00.000Z" })
        .where(eq(studentCourses.studentId, user.id));
      const after = await repository.snapshot(user.id, course.id);
      expect(after.facts.find((fact) => fact.kind === "course")).toMatchObject({
        learningStateId: repeated.id,
        occurredAt: "2026-04-01T12:00:00.000Z",
      });
      expect(after.facts[0].id).not.toBe(before.facts.find((fact) => fact.kind === "course")!.id);
    }));
});
