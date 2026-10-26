import { randomUUID } from "node:crypto";

import { LEARNING_PATH_STATUSES } from "@repo/shared";

import { USER_ROLE } from "~/config/userRoles";

import { ensureLearningPathsEnabled } from "../../utils/learning-paths";

import type { FixtureFactories } from "../../factories";
import type { CourseFactoryRecord } from "../../factories/course.factory";
import type {
  LearningPathFactoryCreateInput,
  LearningPathFactoryRecord,
} from "../../factories/learning-path.factory";
import type { PageHandle } from "../../fixtures/types";
import type { FixtureApiClient } from "../../utils/api-client";
import type { UserRole } from "~/config/userRoles";

type Cleanup = {
  add: (task: () => Promise<void> | void) => void;
};

type WithWorkerPage = (role: UserRole, run: (handle: PageHandle) => Promise<void>) => Promise<void>;

type LearningPathTestContext = {
  apiClient: FixtureApiClient;
  cleanup: Cleanup;
  factories: FixtureFactories;
  withWorkerPage: WithWorkerPage;
};

type ArrangeLearningPathInput = LearningPathTestContext & {
  prefix?: string;
  courseCount?: number;
  extraCourseCount?: number;
  learningPath?: LearningPathFactoryCreateInput;
  shouldEnrollStudent?: boolean;
};

export type ArrangedLearningPath = {
  prefix: string;
  learningPath: LearningPathFactoryRecord;
  pathCourses: CourseFactoryRecord[];
  extraCourses: CourseFactoryRecord[];
};

export const createLearningPathTestPrefix = (name: string) =>
  `e2e-lp-${name}-${randomUUID().slice(0, 8)}`;

export const enableLearningPathsForWorkerTenant = async ({
  apiClient,
  withWorkerPage,
}: Pick<LearningPathTestContext, "apiClient" | "withWorkerPage">) => {
  await withWorkerPage(USER_ROLE.admin, async () => {
    await ensureLearningPathsEnabled(apiClient);
  });
};

export const getWorkerStudentId = async ({
  factories,
  withWorkerPage,
}: Pick<LearningPathTestContext, "factories" | "withWorkerPage">) => {
  let studentId = "";

  await withWorkerPage(USER_ROLE.student, async () => {
    studentId = await factories.createEnrollmentFactory().getCurrentUserId();
  });

  return studentId;
};

const createPublishedCourses = async (
  factories: FixtureFactories,
  categoryId: string,
  titles: string[],
) => {
  const courseFactory = factories.createCourseFactory();
  const curriculumFactory = factories.createCurriculumFactory();
  const courses: CourseFactoryRecord[] = [];

  for (const title of titles) {
    const course = await courseFactory.create({
      title,
      categoryId,
      language: "en",
      status: "draft",
    });
    const chapter = await curriculumFactory.createChapter({
      courseId: course.id,
      title: `${title}-chapter`,
    });

    await curriculumFactory.createContentLesson(course.id, {
      chapterId: chapter.id,
      title: `${title}-lesson`,
    });
    await courseFactory.update(course.id, { status: "published", language: "en" });

    courses.push(await courseFactory.getById(course.id));
  }

  return courses;
};

export const arrangeLearningPath = async ({
  apiClient,
  cleanup,
  factories,
  withWorkerPage,
  prefix = createLearningPathTestPrefix("path"),
  courseCount = 2,
  extraCourseCount = 0,
  learningPath: learningPathInput = {},
  shouldEnrollStudent = false,
}: ArrangeLearningPathInput): Promise<ArrangedLearningPath> => {
  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const learningPathFactory = factories.createLearningPathFactory();

  const studentId = shouldEnrollStudent
    ? await getWorkerStudentId({ factories, withWorkerPage })
    : undefined;

  let arranged: ArrangedLearningPath | undefined;

  await withWorkerPage(USER_ROLE.admin, async () => {
    await ensureLearningPathsEnabled(apiClient);

    const category = await categoryFactory.create(`${prefix}-category`);
    const pathCourses = await createPublishedCourses(
      factories,
      category.id,
      Array.from({ length: courseCount }, (_, index) => `${prefix}-course-${index + 1}`),
    );
    const extraCourses = await createPublishedCourses(
      factories,
      category.id,
      Array.from({ length: extraCourseCount }, (_, index) => `${prefix}-extra-course-${index + 1}`),
    );
    const learningPath = await learningPathFactory.create({
      title: `${prefix}-learning-path`,
      status: LEARNING_PATH_STATUSES.PUBLISHED,
      ...learningPathInput,
    });

    if (pathCourses.length) {
      await learningPathFactory.addCourses(
        learningPath.id,
        pathCourses.map((course) => course.id),
      );
    }

    if (studentId) {
      await learningPathFactory.enrollUsers(learningPath.id, [studentId]);
    }

    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await learningPathFactory.delete(learningPath.id).catch(() => undefined);

        for (const course of [...pathCourses, ...extraCourses]) {
          await courseFactory.update(course.id, { status: "draft", language: "en" });
          await courseFactory.delete(course.id);
        }

        await categoryFactory.delete(category.id);
      });
    });

    arranged = {
      prefix,
      learningPath: await learningPathFactory.getById(learningPath.id),
      pathCourses,
      extraCourses,
    };
  });

  if (!arranged) {
    throw new Error(`Learning path ${prefix} was not created`);
  }

  return arranged;
};
