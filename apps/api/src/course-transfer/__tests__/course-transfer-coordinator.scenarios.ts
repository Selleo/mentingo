import { COURSE_TRANSFER_ERROR_CODES } from "src/course-transfer/course-transfer.constants";

import type { CourseTransferErrorCode } from "src/course-transfer/course-transfer.types";

export const RELATIONSHIP_CHANGES = {
  PAUSED: "paused",
  DELETED: "deleted",
} as const;

export type RelationshipChange = (typeof RELATIONSHIP_CHANGES)[keyof typeof RELATIONSHIP_CHANGES];

export const UNDISPATCHABLE_RELATIONSHIP_CASES: Array<{
  change: RelationshipChange;
  errorCode: CourseTransferErrorCode;
}> = [
  {
    change: RELATIONSHIP_CHANGES.PAUSED,
    errorCode: COURSE_TRANSFER_ERROR_CODES.RELATIONSHIP_PAUSED,
  },
  {
    change: RELATIONSHIP_CHANGES.DELETED,
    errorCode: COURSE_TRANSFER_ERROR_CODES.RELATIONSHIP_MISSING,
  },
];
