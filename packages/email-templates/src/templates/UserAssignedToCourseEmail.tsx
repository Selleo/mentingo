import { getUserAssignedToCourseEmailTranslations } from "translations/userAssignedToCourse";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserAssignedToCourseProps = {
  courseName: string;
  courseLink: string;
  formatedCourseDueDate: string | null;
} & DefaultEmailSettings;

export const UserAssignedToCourse = ({
  courseLink,
  courseName,
  formatedCourseDueDate,
  primaryColor,
  language = "en",
}: UserAssignedToCourseProps) => {
  const { heading, paragraphs, buttonText } = getUserAssignedToCourseEmailTranslations(
    language,
    courseName,
    formatedCourseDueDate,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserAssignedToCourse;
