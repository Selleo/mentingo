import { getUserFinishedChapterEmailTranslations } from "translations/userFinishedChapter";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserFinishedChapterProps = {
  chapterName: string;
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserFinishedChapterEmail = ({
  chapterName,
  courseLink,
  courseName,
  primaryColor,
  language = "en",
}: UserFinishedChapterProps) => {
  const { heading, paragraphs, buttonText } = getUserFinishedChapterEmailTranslations(
    language,
    chapterName,
    courseName,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserFinishedChapterEmail;
