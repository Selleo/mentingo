/** Redirects saved authoring links to the course editor's generation drawer. */
import { type MetaFunction, Navigate, useParams, useSearchParams } from "@remix-run/react";

import { EDIT_COURSE_TABS } from "~/modules/Admin/EditCourse/EditCourse.types";
import { setPageTitle } from "~/utils/setPageTitle";

/** Uses the product's localized generation title for direct route navigation. */
export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "courseAuthoring.title");

const CourseAuthoringPage = () => {
  const { id = "" } = useParams();
  const [searchParams] = useSearchParams();
  const destinationParams = new URLSearchParams(searchParams);
  destinationParams.set("tab", EDIT_COURSE_TABS.CURRICULUM);
  destinationParams.set("aiGeneration", "true");
  return (
    <Navigate replace to={`/admin/beta-courses/${encodeURIComponent(id)}?${destinationParams}`} />
  );
};

export default CourseAuthoringPage;
