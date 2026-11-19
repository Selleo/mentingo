import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { USER_ROLE } from "~/config/userRoles";

import { getSelfOnboardingLanguage } from "./self-onboarding-context";

import type { FixtureApiClient } from "./api-client";
import type { CategoryFactory } from "../factories/category.factory";
import type { CourseFactory, CourseFactoryCreateInput } from "../factories/course.factory";
import type { PageHandle } from "../fixtures/types";
import type { UserRole } from "~/config/userRoles";

type CleanupTask = () => Promise<void> | void;

type PrVideoCourseInput = {
  apiClient: { api: Pick<FixtureApiClient["api"], "fileControllerUploadFile"> };
  factories: {
    createCategoryFactory: () => Pick<CategoryFactory, "findByTitle" | "create" | "delete">;
    createCourseFactory: () => Pick<CourseFactory, "create" | "delete">;
  };
  cleanup: { add: (task: CleanupTask) => void };
  withWorkerPage: (role: UserRole, run: (handle: PageHandle) => Promise<void>) => Promise<void>;
  categoryTitle: string;
  title: string;
  courseOverrides?: Omit<CourseFactoryCreateInput, "categoryId" | "title" | "thumbnailS3Key">;
};

/** Call inside an admin worker page; teardown reacquires admin cookies after learner scenes. */
export const createPrVideoCourse = async (input: PrVideoCourseInput) => {
  const { apiClient, cleanup, factories, withWorkerPage, categoryTitle, title } = input;
  if (!title.trim() || !categoryTitle.trim()) {
    throw new Error("PR video setup requires explicit course and category titles");
  }

  const categoryFactory = factories.createCategoryFactory();
  const courseFactory = factories.createCourseFactory();
  const language = input.courseOverrides?.language ?? getSelfOnboardingLanguage();
  let category = await categoryFactory.findByTitle(categoryTitle);
  const reusedCategory = Boolean(category);

  if (!category) {
    category = await categoryFactory.create({ title: categoryTitle, language });
    const categoryId = category.id;
    cleanup.add(async () => {
      await withWorkerPage(USER_ROLE.admin, async () => {
        await categoryFactory.delete(categoryId);
      });
    });
  }

  const coverBytes = await readFile(
    resolve(dirname(fileURLToPath(import.meta.url)), "../data/self-onboarding/cover.svg"),
  );
  const coverFile = new File([new Uint8Array(coverBytes)], "cover.svg", {
    type: "image/svg+xml",
  });
  // Upload responses are raw FileUploadResponse, without the usual nested data envelope.
  const upload = await apiClient.api.fileControllerUploadFile({
    file: coverFile,
    resource: "course",
  });
  if (!upload.data.fileKey?.trim()) {
    throw new Error("PR video course cover upload returned no fileKey");
  }

  const course = await courseFactory.create({
    ...input.courseOverrides,
    language,
    title,
    categoryId: category.id,
    thumbnailS3Key: upload.data.fileKey,
  });
  cleanup.add(async () => {
    await withWorkerPage(USER_ROLE.admin, async () => {
      await courseFactory.delete(course.id);
    });
  });

  return { course, category, courseId: course.id, categoryId: category.id, reusedCategory };
};
