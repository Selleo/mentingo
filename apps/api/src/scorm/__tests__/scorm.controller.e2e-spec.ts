import { Readable } from "node:stream";

import {
  COURSE_ENROLLMENT,
  SCORM_COMPLETION_STATUS,
  SCORM_PACKAGE_ENTITY_TYPE,
  SCORM_PACKAGE_STATUS,
  SCORM_SUCCESS_STATUS,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import AdmZip from "adm-zip";
import { and, eq } from "drizzle-orm";
import request from "supertest";

import { S3Service } from "src/s3/s3.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  chapters,
  courses,
  lessons,
  scormAttempts,
  scormPackages,
  scormRuntimeState,
  scormScos,
  studentChapterProgress,
  studentCourses,
  studentLessonProgress,
} from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";
import type { FileStreamPayload } from "src/file/types/file-stream.type";
import type { UserWithCredentials } from "test/factory/user.factory";

jest.mock("load-esm", () => ({
  loadEsm: jest.fn(async () => ({
    fileTypeFromBuffer: async (buffer: Buffer) => {
      if (buffer.subarray(0, 2).toString("utf-8") === "PK") {
        return { mime: "application/zip", ext: "zip" };
      }

      return undefined;
    },
  })),
}));

const PASSWORD = "Password123@";
const PACKAGE_FILENAME = "minimal-scorm.zip";

class InMemoryS3Service {
  private readonly files = new Map<string, { buffer: Buffer; contentType: string }>();

  async uploadFile(fileBuffer: Buffer | Readable, key: string, contentType: string) {
    if (Buffer.isBuffer(fileBuffer)) {
      this.files.set(key, { buffer: fileBuffer, contentType });
      return;
    }

    const chunks: Buffer[] = [];
    for await (const chunk of fileBuffer) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    this.files.set(key, { buffer: Buffer.concat(chunks), contentType });
  }

  async deleteFile(key: string) {
    this.files.delete(key);
  }

  async getFileBuffer(key: string) {
    const file = this.files.get(key);

    if (!file) {
      const error = new Error("No such key") as Error & { name: string; Code: string };
      error.name = "NoSuchKey";
      error.Code = "NoSuchKey";
      throw error;
    }

    return file.buffer;
  }

  async getFileStream(key: string): Promise<FileStreamPayload> {
    const file = this.files.get(key);

    if (!file) {
      const error = new Error("No such key") as Error & { name: string; Code: string };
      error.name = "NoSuchKey";
      error.Code = "NoSuchKey";
      throw error;
    }

    return {
      stream: Readable.from(file.buffer),
      contentType: file.contentType,
      contentLength: file.buffer.length,
      acceptRanges: "bytes",
      statusCode: 200,
    };
  }

  clear() {
    this.files.clear();
  }
}

const buildMinimalScormPackage = () => {
  const zip = new AdmZip();

  zip.addFile(
    "imsmanifest.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="mentingo-minimal-scorm" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Minimal SCORM Course</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>Launchable SCO</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html" />
      <file href="scripts/runtime.js" />
    </resource>
  </resources>
</manifest>`,
    ),
  );
  zip.addFile(
    "index.html",
    Buffer.from(
      "<!doctype html><html><head><title>SCO</title></head><body>SCORM index</body></html>",
    ),
  );
  zip.addFile("scripts/runtime.js", Buffer.from("window.__SCORM_FIXTURE__ = true;"));

  return zip.toBuffer();
};

const buildMultiScoScormPackage = () => {
  const zip = new AdmZip();

  zip.addFile(
    "imsmanifest.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="mentingo-multi-scorm" version="1.2"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>Multi SCO SCORM Lesson</title>
      <item identifier="ITEM-1" identifierref="RES-1">
        <title>Quiz SCO</title>
      </item>
      <item identifier="ITEM-2" identifierref="RES-2">
        <title>Summary SCO</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="quiz.html">
      <file href="quiz.html" />
    </resource>
    <resource identifier="RES-2" type="webcontent" adlcp:scormtype="sco" href="summary.html">
      <file href="summary.html" />
    </resource>
  </resources>
</manifest>`,
    ),
  );
  zip.addFile(
    "quiz.html",
    Buffer.from(
      "<!doctype html><html><head><title>Quiz SCO</title></head><body>Quiz</body></html>",
    ),
  );
  zip.addFile(
    "summary.html",
    Buffer.from(
      "<!doctype html><html><head><title>Summary SCO</title></head><body>Summary</body></html>",
    ),
  );

  return zip.toBuffer();
};

const buildPackageWithoutManifest = () => {
  const zip = new AdmZip();
  zip.addFile("index.html", Buffer.from("<html><body>missing manifest</body></html>"));
  return zip.toBuffer();
};

describe("ScormController (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let baseDb: DatabasePg;
  let s3Service: InMemoryS3Service;
  let userFactory: ReturnType<typeof createUserFactory>;
  let categoryFactory: ReturnType<typeof createCategoryFactory>;
  let courseFactory: ReturnType<typeof createCourseFactory>;
  let chapterFactory: ReturnType<typeof createChapterFactory>;

  const createAdmin = () =>
    userFactory
      .withCredentials({ password: PASSWORD })
      .withAdminSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.ADMIN });

  const createStudent = () =>
    userFactory
      .withCredentials({ password: PASSWORD })
      .withUserSettings(db)
      .create({ role: SYSTEM_ROLE_SLUGS.STUDENT });

  const attachScormPackage = (
    testRequest: request.Test,
    packageBuffer = buildMinimalScormPackage(),
  ) =>
    testRequest.attach("scormPackage", packageBuffer, {
      filename: PACKAGE_FILENAME,
      contentType: "application/zip",
    });

  const waitForScormPackageReady = async (packageId: string) => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const [scormPackage] = await db
        .select()
        .from(scormPackages)
        .where(eq(scormPackages.id, packageId));

      if (scormPackage?.status === SCORM_PACKAGE_STATUS.READY) {
        return scormPackage;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`SCORM package did not become ready: ${packageId}`);
  };

  const importScormCourse = async (admin: UserWithCredentials) => {
    const category = await categoryFactory.create();
    const response = await attachScormPackage(
      request(app.getHttpServer())
        .post("/api/scorm/course")
        .set("Cookie", await cookieFor(admin, app))
        .set("x-playwright-test", "true")
        .field("title", "SCORM API Course")
        .field("description", "Imported through backend API e2e")
        .field("categoryId", category.id)
        .field("language", "en")
        .field("status", "published"),
    );

    expect(response.status).toBe(201);

    const courseId = response.body.data.id as string;
    const [scormPackage] = await db
      .select()
      .from(scormPackages)
      .where(
        and(
          eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.COURSE),
          eq(scormPackages.entityId, courseId),
          eq(scormPackages.language, "en"),
        ),
      );
    await waitForScormPackageReady(scormPackage.id);
    const [sco] = await db.select().from(scormScos).where(eq(scormScos.packageId, scormPackage.id));

    return {
      courseId,
      packageId: scormPackage.id,
      lessonId: sco.lessonId,
      scoId: sco.id,
    };
  };

  const enrollStudent = async (studentId: string, courseId: string) => {
    await db.insert(studentCourses).values({
      studentId,
      courseId,
      status: COURSE_ENROLLMENT.ENROLLED,
      enrolledAt: new Date().toISOString(),
    });
  };

  beforeAll(async () => {
    s3Service = new InMemoryS3Service();
    const e2e = await createE2ETest([
      {
        provide: S3Service,
        useValue: s3Service,
      },
    ]);

    app = e2e.app;
    db = app.get(DB);
    baseDb = app.get(DB_ADMIN);
    userFactory = createUserFactory(db);
    categoryFactory = createCategoryFactory(db);
    courseFactory = createCourseFactory(db);
    chapterFactory = createChapterFactory(db);
  });

  afterEach(async () => {
    s3Service.clear();
    await truncateAllTables(baseDb, db);
  });

  afterAll(async () => {
    await app.close();
  });

  describe("POST /api/scorm/course", () => {
    it("imports a multipart SCORM package into a course, package, chapter, lesson and SCO", async () => {
      const admin = await createAdmin();
      const imported = await importScormCourse(admin);

      const [course] = await db.select().from(courses).where(eq(courses.id, imported.courseId));
      const importedChapters = await db
        .select()
        .from(chapters)
        .where(eq(chapters.courseId, imported.courseId));
      const importedLessons = await db
        .select()
        .from(lessons)
        .where(eq(lessons.chapterId, importedChapters[0].id));
      const [scormPackage] = await db
        .select()
        .from(scormPackages)
        .where(eq(scormPackages.id, imported.packageId));
      const [sco] = await db.select().from(scormScos).where(eq(scormScos.id, imported.scoId));

      expect(course.chapterCount).toBe(1);
      expect(course.status).toBe("published");
      expect(importedChapters).toHaveLength(1);
      expect(importedLessons).toHaveLength(1);
      expect(importedLessons[0].type).toBe("scorm");
      expect(scormPackage.entityType).toBe(SCORM_PACKAGE_ENTITY_TYPE.COURSE);
      expect(scormPackage.entityId).toBe(imported.courseId);
      expect(scormPackage.language).toBe("en");
      expect(scormPackage.status).toBe("ready");
      expect(sco.title).toBe("Launchable SCO");
      expect(sco.href).toBe("index.html");
      expect(sco.launchPath).toContain("/index.html");
    });

    it("rejects a package without a SCORM manifest with a translation key error", async () => {
      const admin = await createAdmin();
      const category = await categoryFactory.create();

      const response = await attachScormPackage(
        request(app.getHttpServer())
          .post("/api/scorm/course")
          .set("Cookie", await cookieFor(admin, app))
          .set("x-playwright-test", "true")
          .field("title", "Invalid SCORM")
          .field("description", "Invalid package")
          .field("categoryId", category.id)
          .field("language", "en"),
        buildPackageWithoutManifest(),
      ).expect(400);

      expect(response.body.message).toBe("adminScorm.errors.manifestMissing");
    });
  });

  describe("POST /api/scorm/lesson", () => {
    it("imports a SCORM lesson attached to a chapter with package and SCO metadata", async () => {
      const admin = await createAdmin();
      const course = await courseFactory.create({ authorId: admin.id });
      const chapter = await chapterFactory.create({
        authorId: admin.id,
        courseId: course.id,
        lessonCount: 0,
      });

      const response = await attachScormPackage(
        request(app.getHttpServer())
          .post("/api/scorm/lesson")
          .set("Cookie", await cookieFor(admin, app))
          .field("chapterId", chapter.id)
          .field("title", "Imported SCORM Lesson")
          .field("language", "en"),
      ).expect(201);

      const lessonId = response.body.data.id as string;
      const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
      const [scormPackage] = await db
        .select()
        .from(scormPackages)
        .where(
          and(
            eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
            eq(scormPackages.entityId, lessonId),
          ),
        );
      const [sco] = await db
        .select()
        .from(scormScos)
        .where(eq(scormScos.packageId, scormPackage.id));
      const readyScormPackage = await waitForScormPackageReady(scormPackage.id);

      expect(lesson.chapterId).toBe(chapter.id);
      expect(lesson.type).toBe("scorm");
      expect(scormPackage.language).toBe("en");
      expect(readyScormPackage.status).toBe("ready");
      expect(sco.lessonId).toBe(lessonId);
      expect(sco.resourceIdentifier).toBe("RES-1");
      expect(sco.resourceMetadataJson).toEqual(
        expect.objectContaining({
          href: "index.html",
          files: expect.arrayContaining(["index.html", "scripts/runtime.js"]),
        }),
      );
    });

    it("attaches a separate SCORM package to an existing lesson language", async () => {
      const admin = await createAdmin();
      const course = await courseFactory.create({
        authorId: admin.id,
        availableLocales: ["en", "pl"],
        thumbnailS3Key: null,
      });
      const chapter = await chapterFactory.create({
        authorId: admin.id,
        courseId: course.id,
        lessonCount: 0,
      });

      const createResponse = await attachScormPackage(
        request(app.getHttpServer())
          .post("/api/scorm/lesson")
          .set("Cookie", await cookieFor(admin, app))
          .field("chapterId", chapter.id)
          .field("title", "Imported SCORM Lesson")
          .field("language", "en"),
      ).expect(201);

      const lessonId = createResponse.body.data.id as string;

      await attachScormPackage(
        request(app.getHttpServer())
          .patch(`/api/scorm/lesson/${lessonId}/package`)
          .set("Cookie", await cookieFor(admin, app))
          .field("title", "Lekcja SCORM")
          .field("language", "pl"),
      ).expect(200);

      const packages = await db
        .select()
        .from(scormPackages)
        .where(
          and(
            eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
            eq(scormPackages.entityId, lessonId),
          ),
        );

      const readyPackages = await Promise.all(
        packages.map((scormPackage) => waitForScormPackageReady(scormPackage.id)),
      );

      expect(packages).toHaveLength(2);
      expect(packages.map((scormPackage) => scormPackage.language).sort()).toEqual(["en", "pl"]);
      expect(readyPackages.every((scormPackage) => scormPackage.status === "ready")).toBe(true);

      const courseResponse = await request(app.getHttpServer())
        .get(`/api/course/beta-course-by-id?id=${course.id}&language=en`)
        .set("Cookie", await cookieFor(admin, app));

      expect(courseResponse.status).toBe(200);

      expect(courseResponse.body.data.chapters[0].lessons[0].scormPackageLanguages).toEqual([
        "en",
        "pl",
      ]);
    });
  });

  describe("SCORM runtime", () => {
    it("launches ab-initio, persists commit state, resumes, and finishes completed", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const imported = await importScormCourse(admin);
      await enrollStudent(student.id, imported.courseId);

      const studentCookies = await cookieFor(student, app);
      const launchResponse = await request(app.getHttpServer())
        .get(`/api/scorm/runtime/launch?lessonId=${imported.lessonId}&language=en`)
        .set("Cookie", studentCookies)
        .expect(200);
      const launch = launchResponse.body.data;

      expect(launch.runtime["cmi.core.entry"]).toBe("ab-initio");
      expect(launch.runtime["cmi.core.lesson_status"]).toBe("not attempted");
      expect(launch.packageId).toBe(imported.packageId);
      expect(launch.scoId).toBe(imported.scoId);

      const commitBody = {
        attemptId: launch.attemptId,
        packageId: launch.packageId,
        scoId: launch.scoId,
        lessonId: launch.lessonId,
        courseId: launch.courseId,
        values: {
          "cmi.core.lesson_status": "incomplete",
          "cmi.core.lesson_location": "slide-2",
          "cmi.suspend_data": "resume-token",
          "cmi.core.score.raw": "75",
        },
        language: "en",
      };

      const commitResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/commit")
        .set("Cookie", studentCookies)
        .send(commitBody)
        .expect(201);

      expect(commitResponse.body.data).toEqual(
        expect.objectContaining({
          committed: true,
          lessonCompleted: false,
          scormStatus: "incomplete",
        }),
      );

      const [committedState] = await db
        .select()
        .from(scormRuntimeState)
        .where(eq(scormRuntimeState.attemptId, launch.attemptId));

      expect(committedState.completionStatus).toBe("incomplete");
      expect(committedState.lessonLocation).toBe("slide-2");
      expect(committedState.suspendData).toBe("resume-token");
      expect(committedState.scoreRaw).toBe("75.0000");

      const resumeResponse = await request(app.getHttpServer())
        .get(`/api/scorm/runtime/launch?lessonId=${imported.lessonId}&language=en`)
        .set("Cookie", studentCookies)
        .expect(200);

      expect(resumeResponse.body.data.attemptId).toBe(launch.attemptId);
      expect(resumeResponse.body.data.runtime["cmi.core.entry"]).toBe("resume");
      expect(resumeResponse.body.data.runtime["cmi.core.lesson_location"]).toBe("slide-2");

      const finishResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/finish")
        .set("Cookie", studentCookies)
        .send({
          ...commitBody,
          values: {
            "cmi.core.lesson_status": "completed",
            "cmi.core.session_time": "0000:01:05.00",
          },
        })
        .expect(201);

      expect(finishResponse.body.data).toEqual(
        expect.objectContaining({
          finished: true,
          lessonCompleted: true,
          scormStatus: "completed",
        }),
      );

      const [attempt] = await db
        .select()
        .from(scormAttempts)
        .where(eq(scormAttempts.id, launch.attemptId));
      const [finishedState] = await db
        .select()
        .from(scormRuntimeState)
        .where(eq(scormRuntimeState.attemptId, launch.attemptId));
      const [progress] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.lessonId, imported.lessonId),
            eq(studentLessonProgress.studentId, student.id),
          ),
        );

      expect(attempt.completedAt).toBeTruthy();
      expect(finishedState.completionStatus).toBe("completed");
      expect(finishedState.totalTime).toBe("0000:01:05.00");
      expect(progress.completedAt).toBeTruthy();
    });

    it("requires every SCO to be completed without a failed success status", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const course = await courseFactory.create({ authorId: admin.id });
      const chapter = await chapterFactory.create({
        authorId: admin.id,
        courseId: course.id,
        lessonCount: 0,
      });

      const importResponse = await attachScormPackage(
        request(app.getHttpServer())
          .post("/api/scorm/lesson")
          .set("Cookie", await cookieFor(admin, app))
          .field("chapterId", chapter.id)
          .field("title", "Imported multi-SCO SCORM Lesson")
          .field("language", "en"),
        buildMultiScoScormPackage(),
      ).expect(201);

      const lessonId = importResponse.body.data.id as string;
      const [scormPackage] = await db
        .select()
        .from(scormPackages)
        .where(
          and(
            eq(scormPackages.entityType, SCORM_PACKAGE_ENTITY_TYPE.LESSON),
            eq(scormPackages.entityId, lessonId),
          ),
        );
      await waitForScormPackageReady(scormPackage.id);
      const scos = (
        await db.select().from(scormScos).where(eq(scormScos.packageId, scormPackage.id))
      ).sort((firstSco, secondSco) => firstSco.displayOrder - secondSco.displayOrder);
      const [firstSco, secondSco] = scos;

      expect(scos).toHaveLength(2);

      await enrollStudent(student.id, course.id);

      const studentCookies = await cookieFor(student, app);
      const firstLaunchResponse = await request(app.getHttpServer())
        .get(`/api/scorm/runtime/launch?lessonId=${lessonId}&language=en`)
        .set("Cookie", studentCookies)
        .expect(200);
      const firstLaunch = firstLaunchResponse.body.data;

      expect(firstLaunch.scoId).toBe(firstSco.id);
      expect(firstLaunch.navigation).toEqual({
        previousScoId: null,
        nextScoId: secondSco.id,
      });

      const firstFinishResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/finish")
        .set("Cookie", studentCookies)
        .send({
          attemptId: firstLaunch.attemptId,
          packageId: firstLaunch.packageId,
          scoId: firstLaunch.scoId,
          lessonId: firstLaunch.lessonId,
          courseId: firstLaunch.courseId,
          values: {
            "cmi.core.lesson_status": "failed",
            "cmi.core.lesson_location": "quiz-finished",
            "cmi.suspend_data": "selected-answer-token",
          },
          language: "en",
        })
        .expect(201);

      expect(firstFinishResponse.body.data).toEqual(
        expect.objectContaining({
          finished: true,
          lessonCompleted: false,
          scormStatus: "failed",
        }),
      );

      const [firstRuntimeState] = await db
        .select()
        .from(scormRuntimeState)
        .where(eq(scormRuntimeState.attemptId, firstLaunch.attemptId));

      expect(firstRuntimeState.completionStatus).toBe(SCORM_COMPLETION_STATUS.COMPLETED);
      expect(firstRuntimeState.successStatus).toBe(SCORM_SUCCESS_STATUS.FAILED);
      expect(firstRuntimeState.suspendData).toBe("selected-answer-token");

      const secondLaunchResponse = await request(app.getHttpServer())
        .get(`/api/scorm/runtime/launch?lessonId=${lessonId}&scoId=${secondSco.id}&language=en`)
        .set("Cookie", studentCookies)
        .expect(200);
      const secondLaunch = secondLaunchResponse.body.data;

      expect(secondLaunch.scoId).toBe(secondSco.id);
      expect(secondLaunch.navigation).toEqual({
        previousScoId: firstSco.id,
        nextScoId: null,
      });

      const secondFinishResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/finish")
        .set("Cookie", studentCookies)
        .send({
          attemptId: secondLaunch.attemptId,
          packageId: secondLaunch.packageId,
          scoId: secondLaunch.scoId,
          lessonId: secondLaunch.lessonId,
          courseId: secondLaunch.courseId,
          values: {
            "cmi.core.lesson_status": "completed",
          },
          language: "en",
        })
        .expect(201);

      expect(secondFinishResponse.body.data).toEqual(
        expect.objectContaining({
          finished: true,
          lessonCompleted: false,
          scormStatus: "completed",
        }),
      );

      const resumedFirstScoResponse = await request(app.getHttpServer())
        .get(`/api/scorm/runtime/launch?lessonId=${lessonId}&scoId=${firstSco.id}&language=en`)
        .set("Cookie", studentCookies)
        .expect(200);

      expect(resumedFirstScoResponse.body.data.runtime["cmi.core.entry"]).toBe("resume");
      expect(resumedFirstScoResponse.body.data.runtime["cmi.core.lesson_location"]).toBe(
        "quiz-finished",
      );
      expect(resumedFirstScoResponse.body.data.runtime["cmi.suspend_data"]).toBe(
        "selected-answer-token",
      );

      const [progressAfterFailedSco] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.lessonId, lessonId),
            eq(studentLessonProgress.studentId, student.id),
          ),
        );

      expect(progressAfterFailedSco.completedAt).toBeNull();

      const firstPassedResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/finish")
        .set("Cookie", studentCookies)
        .send({
          attemptId: resumedFirstScoResponse.body.data.attemptId,
          packageId: resumedFirstScoResponse.body.data.packageId,
          scoId: resumedFirstScoResponse.body.data.scoId,
          lessonId: resumedFirstScoResponse.body.data.lessonId,
          courseId: resumedFirstScoResponse.body.data.courseId,
          values: {
            "cmi.core.lesson_status": "passed",
          },
          language: "en",
        })
        .expect(201);

      expect(firstPassedResponse.body.data).toEqual(
        expect.objectContaining({
          finished: true,
          lessonCompleted: true,
          scormStatus: "passed",
        }),
      );

      const [progressAfterPassedRetake] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.lessonId, lessonId),
            eq(studentLessonProgress.studentId, student.id),
          ),
        );

      expect(progressAfterPassedRetake.completedAt).toBeTruthy();

      const firstRetakeResponse = await request(app.getHttpServer())
        .post("/api/scorm/runtime/commit")
        .set("Cookie", studentCookies)
        .send({
          attemptId: resumedFirstScoResponse.body.data.attemptId,
          packageId: resumedFirstScoResponse.body.data.packageId,
          scoId: resumedFirstScoResponse.body.data.scoId,
          lessonId: resumedFirstScoResponse.body.data.lessonId,
          courseId: resumedFirstScoResponse.body.data.courseId,
          values: {
            "cmi.core.lesson_status": "not attempted",
            "cmi.core.score.raw": "",
            "cmi.core.score.min": "",
            "cmi.core.score.max": "",
          },
          language: "en",
        })
        .expect(201);

      expect(firstRetakeResponse.body.data).toEqual(
        expect.objectContaining({
          committed: true,
          lessonCompleted: false,
          scormStatus: "not attempted",
        }),
      );

      const [progressAfterRetake] = await db
        .select()
        .from(studentLessonProgress)
        .where(
          and(
            eq(studentLessonProgress.lessonId, lessonId),
            eq(studentLessonProgress.studentId, student.id),
          ),
        );
      const [chapterProgressAfterRetake] = await db
        .select()
        .from(studentChapterProgress)
        .where(
          and(
            eq(studentChapterProgress.chapterId, chapter.id),
            eq(studentChapterProgress.studentId, student.id),
          ),
        );
      const [courseProgressAfterRetake] = await db
        .select()
        .from(studentCourses)
        .where(
          and(eq(studentCourses.courseId, course.id), eq(studentCourses.studentId, student.id)),
        );

      expect(progressAfterRetake.completedAt).toBeNull();
      expect(progressAfterRetake.isStarted).toBe(false);
      expect(chapterProgressAfterRetake.completedAt).toBeNull();
      expect(courseProgressAfterRetake.completedAt).toBeNull();
    });
  });

  describe("GET /api/scorm/content/:packageId/*", () => {
    it("serves extracted content to an authorized learner and admin", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const imported = await importScormCourse(admin);
      await enrollStudent(student.id, imported.courseId);

      const learnerResponse = await request(app.getHttpServer())
        .get(`/api/scorm/content/${imported.packageId}/scripts/runtime.js`)
        .set("Cookie", await cookieFor(student, app))
        .expect(200);

      expect(learnerResponse.headers["content-type"]).toContain("javascript");
      expect(learnerResponse.text).toContain("window.__SCORM_FIXTURE__ = true");

      const adminResponse = await request(app.getHttpServer())
        .get(`/api/scorm/content/${imported.packageId}/index.html`)
        .set("Cookie", await cookieFor(admin, app))
        .expect(200);

      expect(adminResponse.text).toContain("SCORM index");
      expect(adminResponse.text).not.toContain("mentingo:scorm-dialog");
    });

    it("denies content access for an unenrolled learner", async () => {
      const admin = await createAdmin();
      const student = await createStudent();
      const imported = await importScormCourse(admin);

      const response = await request(app.getHttpServer())
        .get(`/api/scorm/content/${imported.packageId}/index.html`)
        .set("Cookie", await cookieFor(student, app))
        .expect(403);

      expect(response.body.message).toBe("adminScorm.errors.runtime.contentForbidden");
    });
  });
});
