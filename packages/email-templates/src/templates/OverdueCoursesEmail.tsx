import {
  getOverdueCoursesEmailTranslations,
  summarizeDueDateCourseTitles,
} from "translations/dueDateCourses";

import BaseEmailTemplate from "./BaseEmailTemplate";

import type { DueDateCourse } from "translations/dueDateCourses";

import { DefaultEmailSettings } from "types";

export type OverdueCoursesEmailCourse = DueDateCourse;

export type OverdueCoursesEmailProps = {
  courses: OverdueCoursesEmailCourse[];
  coursesLink: string;
} & DefaultEmailSettings;

export const OverdueCoursesEmail = ({
  courses,
  coursesLink,
  primaryColor,
  companyName,
  language = "en",
}: OverdueCoursesEmailProps) => {
  const { heading, paragraphs, buttonText } = getOverdueCoursesEmailTranslations(
    language,
    summarizeDueDateCourseTitles(courses, language),
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: coursesLink,
    primaryColor,
    companyName,
  });
};

export default OverdueCoursesEmail;
