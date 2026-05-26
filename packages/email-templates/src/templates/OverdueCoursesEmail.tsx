import { getOverdueCoursesEmailTranslations } from "translations/overdueCourses";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type OverdueCoursesEmailStudent = {
  name: string;
  email: string;
};

export type OverdueCoursesEmailGroup = {
  groupName: string;
  dueDate: string;
  students: OverdueCoursesEmailStudent[];
};

export type OverdueCoursesEmailCourse = {
  courseTitle: string;
  groups: OverdueCoursesEmailGroup[];
};

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
  const { heading, paragraphs, buttonText } = getOverdueCoursesEmailTranslations(language, courses);

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
