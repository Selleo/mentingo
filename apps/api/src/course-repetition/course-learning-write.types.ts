import type {
  COURSE_LEARNING_TARGET_ENTITIES,
  COURSE_LEARNING_TARGET_FIELDS,
  COURSE_LEARNING_TARGET_SOURCES,
} from "./course-learning-write.constants";

export type CourseLearningTarget = {
  source: (typeof COURSE_LEARNING_TARGET_SOURCES)[keyof typeof COURSE_LEARNING_TARGET_SOURCES];
  field: (typeof COURSE_LEARNING_TARGET_FIELDS)[keyof typeof COURSE_LEARNING_TARGET_FIELDS];
  entity?: (typeof COURSE_LEARNING_TARGET_ENTITIES)[keyof typeof COURSE_LEARNING_TARGET_ENTITIES];
  transactional?: boolean;
};
