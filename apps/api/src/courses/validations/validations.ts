import { Type } from "@sinclair/typebox";

import { baseResponse, paginatedResponse, UUIDSchema } from "src/common";
import { allCoursesSchema, allStudentCoursesSchema } from "src/courses/schemas/course.schema";
import {
  sortCourseFieldsOptions,
  sortEnrolledStudentsOptions,
} from "src/courses/schemas/courseQuery";

import { enrolledStudentSchema } from "../schemas/enrolledStudent.schema";

export const allCoursesValidation = {
  response: paginatedResponse(allCoursesSchema),
  request: [
    { type: "query" as const, name: "title", schema: Type.String() },
    { type: "query" as const, name: "category", schema: Type.String() },
    { type: "query" as const, name: "author", schema: Type.String() },
    {
      type: "query" as const,
      name: "creationDateRange",
      schema: Type.Array(Type.String()),
    },
    {
      type: "query" as const,
      name: "isPublished",
      schema: Type.String(),
    },
    { type: "query" as const, name: "sort", schema: sortCourseFieldsOptions },
    {
      type: "query" as const,
      name: "page",
      schema: Type.Number({ minimum: 1 }),
    },
    { type: "query" as const, name: "perPage", schema: Type.Number() },
  ],
};

export const studentCoursesValidation = {
  response: paginatedResponse(allStudentCoursesSchema),
  request: [
    { type: "query" as const, name: "title", schema: Type.String() },
    { type: "query" as const, name: "category", schema: Type.String() },
    { type: "query" as const, name: "author", schema: Type.String() },
    {
      type: "query" as const,
      name: "creationDateRange[0]",
      schema: Type.String(),
    },
    {
      type: "query" as const,
      name: "creationDateRange[1]",
      schema: Type.String(),
    },
    {
      type: "query" as const,
      name: "page",
      schema: Type.Number({ minimum: 1 }),
    },
    { type: "query" as const, name: "perPage", schema: Type.Number() },
    { type: "query" as const, name: "sort", schema: sortCourseFieldsOptions },
  ],
};

export const coursesValidation = {
  response: paginatedResponse(allStudentCoursesSchema),
  request: [
    { type: "query" as const, name: "title", schema: Type.String() },
    { type: "query" as const, name: "category", schema: Type.String() },
    { type: "query" as const, name: "author", schema: Type.String() },
    {
      type: "query" as const,
      name: "creationDateRange[0]",
      schema: Type.String(),
    },
    {
      type: "query" as const,
      name: "creationDateRange[1]",
      schema: Type.String(),
    },
    {
      type: "query" as const,
      name: "page",
      schema: Type.Number({ minimum: 1 }),
    },
    { type: "query" as const, name: "perPage", schema: Type.Number() },
    { type: "query" as const, name: "sort", schema: sortCourseFieldsOptions },
    { type: "query" as const, name: "excludeCourseId", schema: UUIDSchema },
  ],
};

export const studentsWithEnrolmentValidation = {
  response: baseResponse(Type.Array(enrolledStudentSchema)),
  request: [
    { type: "param" as const, name: "courseId", schema: UUIDSchema },
    {
      type: "query" as const,
      name: "keyword",
      schema: Type.String(),
    },
    {
      type: "query" as const,
      name: "sort",
      schema: sortEnrolledStudentsOptions,
    },
  ],
};
