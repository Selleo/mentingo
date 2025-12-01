import { getUserFinishedCourseEmailTranslations } from "translations/userFinishedCourse";

import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserFinishedCourseProps = {
  courseName: string;
  certificateDownloadLink: string;
} & DefaultEmailSettings;

export const UserFinishedCourseEmail = ({
  courseName,
  certificateDownloadLink,
  primaryColor,
  language = "en",
}: UserFinishedCourseProps) => {
  const { heading, paragraphs, buttonText } = getUserFinishedCourseEmailTranslations(
    language,
    courseName,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: certificateDownloadLink,
    primaryColor,
  });
};

export default UserFinishedCourseEmail;
