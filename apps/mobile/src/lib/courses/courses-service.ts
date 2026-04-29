import { apiClient } from "@/lib/auth/api-client";

export type CourseSummary = {
  id: string;
  title: string;
  slug: string;
};

type Paginated<T> = { data: T[] };
type Listed<T> = { data: T[] };

export async function getAvailableCourses(): Promise<CourseSummary[]> {
  const { data } = await apiClient.get<Paginated<CourseSummary>>(
    "/course/available-courses",
    { params: { page: 1, perPage: 100, language: "en" } },
  );
  return data.data;
}

export async function getStudentCourses(): Promise<CourseSummary[]> {
  const { data } = await apiClient.get<Paginated<CourseSummary>>(
    "/course/get-student-courses",
    { params: { page: 1, perPage: 100, language: "en" } },
  );
  return data.data;
}

export async function getTopCourses(): Promise<CourseSummary[]> {
  const { data } = await apiClient.get<Listed<CourseSummary>>("/course/top-courses", {
    params: { limit: 5, days: 30, language: "en" },
  });
  return data.data;
}
