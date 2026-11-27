import { Navigate, useSearchParams } from "@remix-run/react";

import {
  AI_COURSE_CREATION_PATH,
  withCourseDraft,
} from "~/modules/Admin/AddCourse/utils/addCourseOrigin";

/** Reopens draft links saved before AI creation moved into the Standard form. */
export default function CourseAuthoringDraftRedirect() {
  const [params] = useSearchParams();
  return <Navigate to={withCourseDraft(AI_COURSE_CREATION_PATH, params)} replace />;
}
