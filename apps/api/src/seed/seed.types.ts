import { SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import type { REPORTS_SEED_OUTCOMES } from "./reports-seed-data";
import type { Static } from "@sinclair/typebox";
import type { UUIDType } from "src/common";

export const user = Type.Object({
  roleSlug: Type.Enum(SYSTEM_ROLE_SLUGS),
  email: Type.String(),
  firstName: Type.String(),
  lastName: Type.String(),
});

const userArray = Type.Array(user);

export type UsersSeed = Static<typeof userArray>;

export type ReportsSeedOutcome = (typeof REPORTS_SEED_OUTCOMES)[keyof typeof REPORTS_SEED_OUTCOMES];

export type ReportsSeedCourse = {
  id: UUIDType;
  authorId: UUIDType;
  /** Days since the course's latest learner activity; null means no learner ever started it. */
  idleDays: number | null;
  lessons: Array<{ id: UUIDType; chapterId: UUIDType; assessmentId: UUIDType | null }>;
};

export type ForumSeedPost = {
  id: UUIDType;
  threadId: UUIDType;
  courseId: UUIDType | null;
  userId: UUIDType;
  content: string;
  parentMessageId: UUIDType | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tenantId: UUIDType;
};
