import { COURSES_PAGE_HANDLES } from "../../data/courses/handles";

import type { Page } from "@playwright/test";

type OpenCourseArchiveDialogFlowInput = {
  action: "archive" | "restore";
  /** Opens the row actions of this course instead of the bulk actions of the selection. */
  rowCourseId?: string;
};

export const openCourseArchiveDialogFlow = async (
  page: Page,
  { action, rowCourseId }: OpenCourseArchiveDialogFlowInput,
) => {
  await page
    .getByTestId(
      rowCourseId
        ? COURSES_PAGE_HANDLES.rowActionsTrigger(rowCourseId)
        : COURSES_PAGE_HANDLES.BULK_EDIT_TRIGGER,
    )
    .click();
  await page
    .getByTestId(
      action === "archive"
        ? COURSES_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION
        : COURSES_PAGE_HANDLES.BULK_EDIT_RESTORE_ACTION,
    )
    .click();
  await page.getByTestId(COURSES_PAGE_HANDLES.ARCHIVE_DIALOG).waitFor();
};
