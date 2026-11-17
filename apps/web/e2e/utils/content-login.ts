import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import type { IsolatedWorkspaceHandle } from "../fixtures/test.fixture";

/** A published course with one non-freemium chapter and lesson, sequence disabled. */
export const createContentLoginCourse = async (workspace: IsolatedWorkspaceHandle) => {
  const categoryFactory = workspace.factories.createCategoryFactory();
  const courseFactory = workspace.factories.createCourseFactory();
  const curriculumFactory = workspace.factories.createCurriculumFactory();
  const suffix = randomUUID().slice(0, 8);
  const category = await categoryFactory.create(`Content login ${suffix}`);
  const course = await courseFactory.create({
    categoryId: category.id,
    title: `Content login course ${suffix}`,
    language: "en",
    status: "draft",
  });
  const chapter = await curriculumFactory.createChapter({
    courseId: course.id,
    title: `Protected chapter ${suffix}`,
    isFreemium: false,
  });
  const lesson = await curriculumFactory.createContentLesson(course.id, {
    chapterId: chapter.id,
    title: `Protected lesson ${suffix}`,
    description: `<p>Protected lesson body ${suffix}</p>`,
  });
  await courseFactory.updateSettings(course.id, { lessonSequenceEnabled: false });
  await courseFactory.update(course.id, { status: "published", language: "en" });
  const published = await workspace.apiClient.api.courseControllerGetCourse({
    id: course.id,
    language: "en",
  });

  return { course: published.data.data, lesson, chapter };
};

export const setUnregisteredCourseAccess = async (
  workspace: IsolatedWorkspaceHandle,
  enabled: boolean,
) => {
  const settings = await workspace.apiClient.api.settingsControllerGetPublicGlobalSettings();
  if (settings.data.data.unregisteredUserCoursesAccessibility !== enabled) {
    await workspace.apiClient.api.settingsControllerUpdateUnregisteredUserCoursesAccessibility();
  }
  const updated = await workspace.apiClient.api.settingsControllerGetPublicGlobalSettings();
  expect(updated.data.data.unregisteredUserCoursesAccessibility).toBe(enabled);
};
