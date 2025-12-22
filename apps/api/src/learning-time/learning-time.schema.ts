import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const learningTimeStatisticsSortFields = ["studentName", "totalSeconds"] as const;

export type LearningTimeStatisticsSortField = (typeof learningTimeStatisticsSortFields)[number];

export const learningTimeStatisticsSortOptions = Type.Union([
  ...learningTimeStatisticsSortFields.map((field) => Type.Literal(field)),
  ...learningTimeStatisticsSortFields.map((field) => Type.Literal(`-${field}`)),
]);

export type LearningTimeStatisticsSortOptions = Static<typeof learningTimeStatisticsSortOptions>;

export const learningTimeStatisticsSchema = Type.Object({
  users: Type.Array(
    Type.Object({
      id: UUIDSchema,
      name: Type.String(),
      studentAvatarUrl: Type.Union([Type.String(), Type.Null()]),
      totalSeconds: Type.Number(),
      groups: Type.Union([
        Type.Array(
          Type.Object({
            id: Type.String(),
            name: Type.String(),
          }),
        ),
        Type.Null(),
      ]),
    }),
  ),
});

const filterObject = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
});

export const learningTimeStatisticsFilterOptionsSchema = Type.Object({
  groups: Type.Array(filterObject),
});

export type LearningTimeStatisticsFilterOptionsBody = Static<
  typeof learningTimeStatisticsFilterOptionsSchema
>;

export type LearningTimeStatistics = Static<typeof learningTimeStatisticsSchema>;

export const detailedLearningTimeSchema = Type.Array(
  Type.Object({
    lessonId: Type.String(),
    lessonTitle: Type.String(),
    userId: Type.String(),
    userFirstName: Type.String(),
    userLastName: Type.String(),
    userEmail: Type.String(),
    totalSeconds: Type.Number(),
  }),
);

export type DetailedLearningTime = Static<typeof detailedLearningTimeSchema>;
