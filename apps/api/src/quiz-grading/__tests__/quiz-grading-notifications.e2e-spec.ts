import { randomUUID } from "crypto";

import {
  ANNOUNCEMENT_SOURCE_TYPES,
  ASSESSMENT_QUESTION_TYPES,
  COURSE_ENROLLMENT,
  QUIZ_REVIEW_GRADING_METHODS,
  SYSTEM_ROLE_SLUGS,
  type SystemRoleSlug,
} from "@repo/shared";
import { addDays } from "date-fns";
import { eq } from "drizzle-orm";
import request from "supertest";

import { EmailAdapter } from "src/common/emails/adapters/email.adapter";
import { LESSON_TYPES } from "src/lesson/lesson.type";
import { QuizAuthoringService } from "src/quiz/services/quiz-authoring.service";
import { QuizGradingDigestService } from "src/quiz-grading/quiz-grading-digest.service";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import { announcements, studentCourses, userAnnouncements } from "src/storage/schema";

import { createE2ETest } from "../../../test/create-e2e-test";
import { createCategoryFactory } from "../../../test/factory/category.factory";
import { createChapterFactory } from "../../../test/factory/chapter.factory";
import { createCourseFactory } from "../../../test/factory/course.factory";
import { createSettingsFactory } from "../../../test/factory/settings.factory";
import { createUserFactory } from "../../../test/factory/user.factory";
import { deliverPendingAutomationEmails } from "../../../test/helpers/automation-emails";
import { cookieFor, truncateAllTables } from "../../../test/helpers/test-helpers";

import type { EmailTestingAdapter } from "../../../test/helpers/test-email.adapter";
import type { INestApplication } from "@nestjs/common";
import type { DatabasePg, UUIDType } from "src/common";

describe("Quiz grading notifications (e2e)", () => {
  let app: INestApplication;
  let db: DatabasePg;
  let dbAdmin: DatabasePg;
  let defaultTenantId: UUIDType;
  let runAsTenant: <T>(tenantId: UUIDType, callback: () => Promise<T>) => Promise<T>;
  let emailAdapter: EmailTestingAdapter;
  const password = "Password123!";

  beforeAll(async () => {
    const context = await createE2ETest({ useDbProxy: true, manualAutomationEmails: true });

    app = context.app;
    defaultTenantId = context.defaultTenantId;
    runAsTenant = context.runAsTenant;
    db = app.get(DB);
    dbAdmin = app.get(DB_ADMIN);
    emailAdapter = app.get(EmailAdapter) as EmailTestingAdapter;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await runAsTenant(defaultTenantId, () => truncateAllTables(dbAdmin, db));
    emailAdapter.clearEmails();
  });

  const createUser = async (roleSlug: SystemRoleSlug) => {
    const user = await createUserFactory(db)
      .withCredentials({ password })
      .create({ roleSlug, tenantId: defaultTenantId });

    await createSettingsFactory(db, user.id).create();

    return user;
  };

  // A published quiz with two reviewer-graded open questions and a learner who submitted it.
  const setupSubmittedQuiz = async () => {
    const context = await runAsTenant(defaultTenantId, async () => {
      const author = await createUser(SYSTEM_ROLE_SLUGS.CONTENT_CREATOR);
      const student = await createUser(SYSTEM_ROLE_SLUGS.STUDENT);
      const reviewer = await createUser(SYSTEM_ROLE_SLUGS.REVIEWER);
      const category = await createCategoryFactory(db).create();
      const course = await createCourseFactory(db).create({
        authorId: author.id,
        categoryId: category.id,
        title: "Negotiation basics",
        status: "published",
        settings: { lessonSequenceEnabled: false, quizFeedbackEnabled: true },
      });
      const chapter = await createChapterFactory(db).create({
        courseId: course.id,
        lessonCount: 1,
      });

      await db.insert(studentCourses).values({
        id: randomUUID(),
        studentId: student.id,
        courseId: course.id,
        status: COURSE_ENROLLMENT.ENROLLED,
        enrolledAt: new Date().toISOString(),
      });

      const authoring = app.get(QuizAuthoringService);
      const lesson = await authoring.createQuizLesson({
        chapterId: chapter.id,
        title: "Open answers",
        type: LESSON_TYPES.QUIZ,
        thresholdScore: 50,
        displayOrder: 1,
        attemptsLimit: null,
        quizCooldownInHours: null,
        questions: [
          { type: ASSESSMENT_QUESTION_TYPES.BRIEF_RESPONSE, title: "Brief", requiresReview: true },
          {
            type: ASSESSMENT_QUESTION_TYPES.DETAILED_RESPONSE,
            title: "Detailed",
            requiresReview: true,
          },
        ],
      });
      const questions = (await authoring.getLegacyQuizLessonForAuthoring(lesson.id))?.questions;

      return {
        student,
        reviewer,
        course,
        lesson,
        questionIds: (questions ?? []).map(({ id }) => id as UUIDType),
        studentCookie: await cookieFor(student, app),
        reviewerCookie: await cookieFor(reviewer, app),
      };
    });

    await request(app.getHttpServer())
      .post("/api/lesson/evaluation-quiz")
      .set("Cookie", context.studentCookie)
      .send({
        lessonId: context.lesson.id,
        language: "en",
        questionsAnswers: context.questionIds.map((questionId) => ({
          questionId,
          answers: [{ value: "Open answer" }],
        })),
      })
      .expect(201);

    return context;
  };

  const sendDigest = (now?: Date) =>
    runAsTenant(defaultTenantId, () => app.get(QuizGradingDigestService).sendGradingDigest(now));

  const grade = (cookie: string, answerId: UUIDType, passed: boolean) =>
    request(app.getHttpServer())
      .post(`/api/quiz-grading/answers/${answerId}/grade`)
      .set("Cookie", cookie)
      .send({ method: QUIZ_REVIEW_GRADING_METHODS.PASS_FAIL, passed })
      .expect(201);

  const findGradingNotifications = () =>
    dbAdmin
      .select({ userId: userAnnouncements.userId, content: announcements.content })
      .from(userAnnouncements)
      .innerJoin(announcements, eq(announcements.id, userAnnouncements.announcementId))
      .where(eq(announcements.sourceType, ANNOUNCEMENT_SOURCE_TYPES.QUIZ_GRADING))
      .orderBy(announcements.createdAt);

  it("notifies only the learner, once the attempt is graded and again on re-grade", async () => {
    const context = await setupSubmittedQuiz();
    const queue = await request(app.getHttpServer())
      .get("/api/quiz-grading/answers")
      .set("Cookie", context.reviewerCookie)
      .expect(200);
    const [firstAnswer, secondAnswer] = queue.body.data;

    await grade(context.reviewerCookie, firstAnswer.id, true);
    await deliverPendingAutomationEmails(app, defaultTenantId);

    expect(await findGradingNotifications()).toHaveLength(0);
    expect(emailAdapter.getAllEmails()).toHaveLength(0);

    await grade(context.reviewerCookie, secondAnswer.id, false);
    await deliverPendingAutomationEmails(app, defaultTenantId);

    const lessonPath = `/course/${context.course.id}/lesson/${context.lesson.id}`;
    const [notification] = await findGradingNotifications();

    expect(await findGradingNotifications()).toHaveLength(1);
    expect(notification.userId).toBe(context.student.id);
    expect(notification.content.en).toContain(`href="${lessonPath}"`);
    expect(notification.content.en).toContain("50%");

    const [email] = emailAdapter.getAllEmails();

    expect(emailAdapter.getAllEmails()).toHaveLength(1);
    expect(email).toMatchObject({
      to: context.student.email,
      subject: "Your quiz has been graded - Open answers",
    });
    expect(email.html).toContain(lessonPath);
    expect(email.text?.replace(/\s+/g, " ")).toContain("Your score: 50%");

    await grade(context.reviewerCookie, secondAnswer.id, true);
    await deliverPendingAutomationEmails(app, defaultTenantId);

    const notifications = await findGradingNotifications();
    const emails = emailAdapter.getAllEmails();

    expect(notifications.map(({ userId }) => userId)).toEqual([
      context.student.id,
      context.student.id,
    ]);
    expect(notifications[1].content.en).toContain("100%");
    expect(emails).toHaveLength(2);
    expect(emails[1].to).toBe(context.student.email);
    expect(emails[1].text?.replace(/\s+/g, " ")).toContain("Your score: 100%");
  });

  it("sends reviewers one daily digest of new answers and skips days without any", async () => {
    const context = await setupSubmittedQuiz();

    await sendDigest(addDays(new Date(), 2));
    await deliverPendingAutomationEmails(app, defaultTenantId);

    expect(emailAdapter.getAllEmails()).toHaveLength(0);

    await sendDigest();
    await sendDigest();
    await deliverPendingAutomationEmails(app, defaultTenantId);

    const emails = emailAdapter.getAllEmails();

    expect(emails).toHaveLength(1);
    expect(emails[0]).toMatchObject({
      to: context.reviewer.email,
      subject: "New answers are waiting for review",
    });
    expect(emails[0].html).toContain("/quiz-grading");
    expect(emails[0].text?.replace(/\s+/g, " ")).toContain(
      "New answers submitted in the last 24 hours: 2.",
    );
  });
});
