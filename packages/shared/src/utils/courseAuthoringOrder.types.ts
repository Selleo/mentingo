export type CourseAuthoringOrderGroup =
  | { kind: "chapter"; orderedIds: readonly string[] }
  | { kind: "lesson"; chapterId: string; orderedIds: readonly string[] };

export type CourseAuthoringOrderOperation = {
  operationId: string;
  dependencies: readonly string[];
  type: string;
  targetId: string;
  chapterId?: string;
  displayOrder?: number;
  payload?: unknown;
};

export type CourseAuthoringOrderErrorCode =
  | "duplicateOperation"
  | "missingDependency"
  | "dependencyCycle"
  | "invalidOperations"
  | "invalidReorder"
  | "targetOutsideCourse";
