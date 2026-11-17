import { USER_ROLE } from "~/config/userRoles";

import { CURRICULUM_TEST_DATA } from "../../data/curriculum/curriculum.data";
import { CURRICULUM_HANDLES } from "../../data/curriculum/handles";
import { expect, test } from "../../fixtures/test.fixture";
import { fillContentLessonFormFlow } from "../../flows/curriculum/fill-content-lesson-form.flow";
import { openCurriculumPageFlow } from "../../flows/curriculum/open-curriculum-page.flow";
import { openNewLessonFormFlow } from "../../flows/curriculum/open-new-lesson-form.flow";
import { pasteIntoLessonEditorFlow } from "../../flows/curriculum/paste-into-lesson-editor.flow";
import { saveContentLessonFormFlow } from "../../flows/curriculum/save-content-lesson-form.flow";
import { uploadContentResourceFlow } from "../../flows/curriculum/upload-content-resource.flow";

import { arrangeCurriculumChapter } from "./curriculum-test-helpers";

import type { Page } from "@playwright/test";

type ResourceCase = {
  name: string;
  insert: (page: Page) => Promise<void>;
  /** `data-node-type` values the saved lesson body must contain, one per inserted resource. */
  nodeTypes: string[];
};

const resourceCases: ResourceCase[] = [
  {
    name: "image upload",
    insert: (page) => uploadContentResourceFlow(page, { path: CURRICULUM_TEST_DATA.files.image }),
    nodeTypes: ["image"],
  },
  {
    name: "video upload through S3",
    insert: (page) => uploadContentResourceFlow(page, { path: CURRICULUM_TEST_DATA.files.video }),
    nodeTypes: ["video"],
  },
  {
    name: "generic file upload as download",
    insert: (page) =>
      uploadContentResourceFlow(page, {
        path: CURRICULUM_TEST_DATA.files.fileDownload,
        displayMode: "download",
      }),
    nodeTypes: ["downloadable-file"],
  },
  {
    name: "document upload as preview",
    insert: (page) =>
      uploadContentResourceFlow(page, {
        path: CURRICULUM_TEST_DATA.files.documentPreview,
        displayMode: "preview",
      }),
    nodeTypes: ["pdf-preview"],
  },
  {
    name: "presentation upload as preview",
    insert: (page) =>
      uploadContentResourceFlow(page, {
        path: CURRICULUM_TEST_DATA.files.presentationPreview,
        displayMode: "preview",
      }),
    nodeTypes: ["presentation"],
  },
  {
    name: "presentation upload as download",
    insert: (page) =>
      uploadContentResourceFlow(page, {
        path: CURRICULUM_TEST_DATA.files.presentationDownload,
        displayMode: "download",
      }),
    nodeTypes: ["downloadable-file"],
  },
  {
    name: "multiple files",
    insert: (page) =>
      uploadContentResourceFlow(page, {
        path: CURRICULUM_TEST_DATA.resourceUploads.multi.map((file) => file.path),
      }),
    nodeTypes: ["image", "video"],
  },
  {
    name: "a YouTube video embed",
    insert: (page) => pasteIntoLessonEditorFlow(page, CURRICULUM_TEST_DATA.youtubeVideoUrl),
    nodeTypes: ["video"],
  },
];

for (const resourceCase of resourceCases) {
  test(`admin can save content lesson with ${resourceCase.name}`, async ({
    cleanup,
    factories,
    withWorkerPage,
  }) => {
    await withWorkerPage(USER_ROLE.admin, async ({ page }) => {
      const prefix = `curriculum-resource-${Date.now()}`;
      const { course, chapter } = await arrangeCurriculumChapter({
        cleanup,
        factories,
        title: prefix,
      });
      const curriculumFactory = factories.createCurriculumFactory();
      const lessonTitle = `${prefix}-lesson`;

      await openCurriculumPageFlow(page, course.id);
      await openNewLessonFormFlow(page, chapter.id, "content");
      await fillContentLessonFormFlow(page, {
        title: lessonTitle,
        description: `Resource lesson ${prefix}`,
      });
      await resourceCase.insert(page);
      await saveContentLessonFormFlow(page);

      await expect
        .poll(async () => {
          const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);

          return [...(lesson?.description ?? "").matchAll(/data-node-type="([^"]+)"/g)]
            .map(([, nodeType]) => nodeType)
            .sort();
        })
        .toEqual([...resourceCase.nodeTypes].sort());

      const lesson = await curriculumFactory.findCourseLessonByTitle(course.id, lessonTitle);
      await expect(page.getByTestId(CURRICULUM_HANDLES.lessonTitle(lesson?.id ?? ""))).toHaveText(
        lessonTitle,
      );
    });
  });
}
