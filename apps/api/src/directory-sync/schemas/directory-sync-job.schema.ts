import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const directorySyncJobDataSchema = Type.Object({
  tenantId: UUIDSchema,
  runId: UUIDSchema,
});

export type DirectorySyncJobData = Static<typeof directorySyncJobDataSchema>;
