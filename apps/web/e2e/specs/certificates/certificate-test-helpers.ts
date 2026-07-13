import { USER_ROLE } from "~/config/userRoles";

import { waitForCertificateFlow } from "../../flows/certificates/wait-for-certificate.flow";
import { openCourseOverviewFlow } from "../../flows/learning/open-course-overview.flow";
import { selectFirstSingleChoiceAnswerFlow } from "../../flows/learning/select-first-single-choice-answer.flow";
import { startLearningFlow } from "../../flows/learning/start-learning.flow";
import { submitQuizFlow } from "../../flows/learning/submit-quiz.flow";
import { createSingleChoiceQuizLessonCourse } from "../learning/learning-test-helpers";

import type { FixtureFactories } from "../../factories";
import type { PageHandle } from "../../fixtures/types";
import type { UserRole } from "~/config/userRoles";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type WithWorkerPage = (
  role: UserRole,
  run: (handle: PageHandle) => Promise<void>,
  options?: { root?: boolean },
) => Promise<void>;

export type CertificatedCourse = {
  courseId: string;
  studentId: string;
  certificateId: string;
};

export const createCertificatedCourseForStudent = async ({
  cleanup,
  factories,
  prefix,
  withWorkerPage,
}: {
  cleanup: Cleanup;
  factories: FixtureFactories;
  prefix: string;
  withWorkerPage: WithWorkerPage;
}): Promise<CertificatedCourse> => {
  const courseFactory = factories.createCourseFactory();
  const enrollmentFactory = factories.createEnrollmentFactory();
  const certificateFactory = factories.createCertificateFactory();

  const { courseId } = await createSingleChoiceQuizLessonCourse({
    cleanup,
    factories,
    prefix,
    withWorkerPage,
  });

  let studentId = "";

  await withWorkerPage(
    USER_ROLE.student,
    async ({ page }) => {
      await enrollmentFactory.selfEnroll(courseId);
      studentId = await enrollmentFactory.getCurrentUserId();

      await openCourseOverviewFlow(page, courseId);
      await startLearningFlow(page);

      await selectFirstSingleChoiceAnswerFlow(page);
      await submitQuizFlow(page);
    },
    { root: true },
  );

  await withWorkerPage(
    USER_ROLE.admin,
    async () => {
      await courseFactory.updateHasCertificate(courseId, true);
    },
    { root: true },
  );

  const certificateId = await waitForCertificateFlow(certificateFactory, {
    courseId,
    userId: studentId,
  });

  return { courseId, studentId, certificateId };
};
