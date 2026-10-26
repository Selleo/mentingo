/**
 * Shared view-transition names that let the catalogue and the course management table morph into
 * each other. A name must be unique on a page, so only one occurrence of each course gets it.
 */
export const COURSES_VIEW_TOGGLE_MORPH_NAME = "courses-view-toggle";

export const getCourseTitleMorphName = (courseId: string) => `course-title-${courseId}`;
