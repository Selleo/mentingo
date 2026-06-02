import { Type, type Static } from "@sinclair/typebox";

import { supportedLanguagesSchema } from "src/courses/schemas/course.schema";

export const getCalendarEventsQuerySchema = Type.Object({
  start: Type.String({ minLength: 1 }),
  end: Type.String({ minLength: 1 }),
  language: supportedLanguagesSchema,
  timezone: Type.Optional(Type.String({ minLength: 1 })),
});

export type GetCalendarEventsQuery = Static<typeof getCalendarEventsQuerySchema>;
