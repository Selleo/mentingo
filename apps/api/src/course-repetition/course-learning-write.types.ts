export type CourseLearningTarget = {
  source: "body" | "query" | "params";
  field: string;
  entity?: "lesson" | "thread" | "scorm";
  transactional?: boolean;
};
