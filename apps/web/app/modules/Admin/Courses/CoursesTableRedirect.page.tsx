import { Navigate, useLocation } from "@remix-run/react";

import {
  COURSES_CATALOGUE_PATH,
  COURSES_VIEW_PARAM,
  COURSES_VIEWS,
} from "~/modules/Courses/utils/coursesView";

export default function CoursesTableRedirectPage() {
  const { search } = useLocation();
  const tableSearchParams = new URLSearchParams(search);
  tableSearchParams.set(COURSES_VIEW_PARAM, COURSES_VIEWS.TABLE);

  return (
    <Navigate replace to={{ pathname: COURSES_CATALOGUE_PATH, search: `?${tableSearchParams}` }} />
  );
}
