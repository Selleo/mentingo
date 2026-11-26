import { faker } from "@faker-js/faker";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import request from "supertest";
import { match } from "ts-pattern";

import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createStudentCourseFactory } from "../../../test/factory/student-course.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import {
  COURSE_ENROLLMENT_TABLES,
  createCourseEnrollmentHelpers,
} from "../../../test/helpers/course-enrollment";
import { truncateTables } from "../../../test/helpers/test-helpers";

import {
  COURSE_CANDIDATES,
  KEYWORD_FILTER_CASES,
  MATCHING_LEARNER,
  OTHER_LEARNER,
  STUDENT_LIST_REJECTION_CASES,
  STUDENT_LIST_VIEWERS,
} from "./course-students.scenarios";

import type { StudentListViewer } from "./course-students.scenarios";
import type { INestApplication } from "@nestjs/common";
import type { SystemRoleSlug } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { UserWithCredentials } from "test/factory/user.factory";
import type { SignedInUser } from "test/helpers/course-enrollment";

const cacheManagerMock = {
  get: jest.fn(),
  set: jest.fn(),
};

describe("Course students (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let runInTenant: <T>(fn: () => Promise<T>) => Promise<T>;
  let helpers: ReturnType<typeof createCourseEnrollmentHelpers>;

  beforeAll(async () => {
    const e2e = await createE2ETest({
      useDbProxy: true,
      customProviders: [{ provide: "CACHE_MANAGER", useValue: cacheManagerMock }],
    });

    app = e2e.app;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    runInTenant = (fn) => e2e.runAsTenant(e2e.defaultTenantId, fn);
    helpers = createCourseEnrollmentHelpers({ app, db, runInTenant });
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateTables(dbAdmin, COURSE_ENROLLMENT_TABLES);

    Object.values(cacheManagerMock).forEach((mock) => mock.mockReset());
    cacheManagerMock.get.mockResolvedValue("");
    cacheManagerMock.set.mockResolvedValue("");

    await helpers.arrangeGlobalSettings();
  });

  afterEach(async () => {
    await truncateTables(dbAdmin, COURSE_ENROLLMENT_TABLES);
  });

  const getCourseStudents = (
    viewer: SignedInUser,
    courseId: UUIDType,
    query: Record<string, string> = {},
  ) =>
    request(app.getHttpServer())
      .get(`/api/course/${courseId}/students`)
      .query(query)
      .set("Cookie", viewer.cookies)
      .expect(200);

  const arrangeCourse = (authorId: UUIDType) =>
    runInTenant(() => createCourseFactory(db).create({ authorId, status: "published" }));

  const arrangeCandidate = (
    attributes: Partial<UserWithCredentials> & { roleSlug?: SystemRoleSlug } = {},
  ) => runInTenant(() => createUserFactory(db).create(attributes));

  const arrangeEnrollment = (studentId: UUIDType, courseId: UUIDType) =>
    runInTenant(() => createStudentCourseFactory(db).create({ studentId, courseId }));

  const toListedStudent = (user: UserWithCredentials, enrolledAt: string | null) => ({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    enrolledAt,
    groups: [],
    isEnrolledByGroup: false,
  });

  const paginationOf = (totalItems: number) => ({
    totalItems,
    page: 1,
    perPage: DEFAULT_PAGE_SIZE,
  });

  describe("GET /api/course/:courseId/students", () => {
    const sendAsViewer = async (viewer: StudentListViewer, expectedStatus: number) => {
      const studentsRequest = request(app.getHttpServer()).get(
        `/api/course/${faker.string.uuid()}/students`,
      );

      return match(viewer)
        .with(STUDENT_LIST_VIEWERS.ANONYMOUS, () => studentsRequest.expect(expectedStatus))
        .with(STUDENT_LIST_VIEWERS.STUDENT, async () => {
          const student = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.STUDENT);

          return studentsRequest.set("Cookie", student.cookies).expect(expectedStatus);
        })
        .exhaustive();
    };

    it.each(STUDENT_LIST_REJECTION_CASES)(
      "rejects $viewer with $expectedStatus",
      async ({ viewer, expectedStatus, expectedBody }) => {
        const response = await sendAsViewer(viewer, expectedStatus);

        expect(response.body).toMatchObject(expectedBody);
      },
    );

    it("lists enrolled students first with their enrollment date", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const enrolledStudent = await arrangeCandidate();
      const otherStudent = await arrangeCandidate();
      const enrollment = await arrangeEnrollment(enrolledStudent.id, course.id);

      const response = await getCourseStudents(admin, course.id);

      expect(response.body).toMatchObject({
        data: [
          toListedStudent(enrolledStudent, enrollment.enrolledAt),
          toListedStudent(otherStudent, null),
        ],
        pagination: paginationOf(2),
      });
    });

    it("sorts students by enrollment date descending", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const enrolledStudent = await arrangeCandidate();
      const otherStudent = await arrangeCandidate();
      const enrollment = await arrangeEnrollment(enrolledStudent.id, course.id);

      const response = await getCourseStudents(admin, course.id, { sort: "-enrolledAt" });

      expect(response.body.data).toEqual([
        toListedStudent(otherStudent, null),
        toListedStudent(enrolledStudent, enrollment.enrolledAt),
      ]);
    });

    it("lists users of every role except the course author", async () => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const listedCandidates = [];

      for (const { isEnrolled, ...attributes } of COURSE_CANDIDATES) {
        const candidate = await arrangeCandidate(attributes);
        const enrollment = isEnrolled ? await arrangeEnrollment(candidate.id, course.id) : null;

        listedCandidates.push(toListedStudent(candidate, enrollment?.enrolledAt ?? null));
      }

      const response = await getCourseStudents(admin, course.id, { sort: "email" });

      expect(response.body).toMatchObject({
        data: listedCandidates,
        pagination: paginationOf(COURSE_CANDIDATES.length),
      });
    });

    it.each(KEYWORD_FILTER_CASES)("filters students by $field", async ({ keyword }) => {
      const admin = await helpers.arrangeSignedInUser(SYSTEM_ROLE_SLUGS.ADMIN);
      const course = await arrangeCourse(admin.user.id);
      const matchingLearner = await arrangeCandidate(MATCHING_LEARNER);
      await arrangeCandidate(OTHER_LEARNER);
      const enrollment = await arrangeEnrollment(matchingLearner.id, course.id);

      const response = await getCourseStudents(admin, course.id, { keyword });

      expect(response.body).toMatchObject({
        data: [toListedStudent(matchingLearner, enrollment.enrolledAt)],
        pagination: paginationOf(1),
      });
    });
  });
});
