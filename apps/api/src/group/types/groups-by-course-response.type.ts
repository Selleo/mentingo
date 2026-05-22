import type { Static } from "@sinclair/typebox";
import type { baseGroupSchema } from "src/group/group.schema";

export type GroupsByCourseResponse = Static<typeof baseGroupSchema>[];
