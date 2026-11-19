import { pasteIntoLessonEditorFlow } from "../../flows/curriculum/paste-into-lesson-editor.flow";
import { uploadContentResourceFlow } from "../../flows/curriculum/upload-content-resource.flow";

import { CURRICULUM_TEST_DATA } from "./curriculum.data";

import type { Page } from "@playwright/test";

export type ContentLessonResourceCase = {
  name: string;
  insert: (page: Page) => Promise<void>;
  /** `data-node-type` values the saved lesson body must contain, one per inserted resource. */
  nodeTypes: string[];
};

export const CONTENT_LESSON_RESOURCE_CASES: ContentLessonResourceCase[] = [
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
