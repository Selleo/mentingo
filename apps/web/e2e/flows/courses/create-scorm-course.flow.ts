import { expect, type Page } from "@playwright/test";

import { CREATE_SCORM_COURSE_PAGE_HANDLES } from "../../data/courses/handles";

import { fillCreateScormCourseFormFlow } from "./fill-create-scorm-course-form.flow";
import { openCreateScormCoursePageFlow } from "./open-create-scorm-course-page.flow";
import { submitCreateScormCourseFormFlow } from "./submit-create-scorm-course-form.flow";

type CreateScormCourseFlowInput = {
  categoryTitle: string;
  packagePath: string;
  title: string;
};

export const createScormCourseFlow = async (
  page: Page,
  { categoryTitle, packagePath, title }: CreateScormCourseFlowInput,
) => {
  await openCreateScormCoursePageFlow(page);
  await fillCreateScormCourseFormFlow(page, {
    title,
    categoryTitle,
    language: "en",
    description: `Description for ${title}`,
    packagePath,
  });
  await expect(page.getByTestId(CREATE_SCORM_COURSE_PAGE_HANDLES.SUBMIT_BUTTON)).toBeEnabled();
  await submitCreateScormCourseFormFlow(page);
};
