/** Standalone compatibility route for saved authoring links; Curriculum opens the drawer. */
import { type MetaFunction, useParams } from "@remix-run/react";

import { useCourseAuthoringSessionsQuery } from "~/api/queries/useCourseAuthoringSessionsQuery";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { CourseGenerationSession } from "./CourseGenerationSession";

/** Uses the product's localized generation title for direct route navigation. */
export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "courseAuthoring.title");

/** Supplies route identity to the shared session interaction without owning generation state. */
const CourseAuthoringPage = () => {
  const { id = "" } = useParams();
  const language = useLanguageStore((state) => state.language);
  const sessionsQuery = useCourseAuthoringSessionsQuery(id);
  const sessionId = sessionsQuery.data?.find(
    (session) => session.status === "active" || session.status === "paused",
  )?.sessionId;
  return (
    sessionId && <CourseGenerationSession courseId={id} language={language} sessionId={sessionId} />
  );
};

export default CourseAuthoringPage;
