import {
  availableCoursesQueryOptions,
  currentUserQueryOptions,
  studentCoursesQueryOptions,
} from "~/api/queries";
import { categoriesQueryOptions } from "~/api/queries/useCategories";
import { allCoursesQueryOptions } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { CoursesView } from "~/modules/Courses/CoursesView/CoursesView";

import type { MetaFunction } from "@remix-run/node";

export const meta: MetaFunction = () => {
  return [{ title: "Courses" }, { name: "description", content: "Courses" }];
};

export const clientLoader = async () => {
  const { data: user } = await queryClient.fetchQuery(currentUserQueryOptions);

  await queryClient.prefetchQuery(categoriesQueryOptions());

  if (user.role === "admin" || user.role === "teacher") {
    await queryClient.prefetchQuery(allCoursesQueryOptions());
  } else {
    await queryClient.prefetchQuery(availableCoursesQueryOptions());
    await queryClient.prefetchQuery(studentCoursesQueryOptions());
  }

  return null;
};


export default function CoursesPage() {
  return <CoursesView />
}
