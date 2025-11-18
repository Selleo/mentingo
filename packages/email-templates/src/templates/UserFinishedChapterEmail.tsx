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
  primaryColor = "#4796FD",
}: UserFinishedChapterProps) => {
  return BaseEmailTemplate({
    heading: "Chapter completed",
    paragraphs: [
      "Progress updated 🧩",
      `You’ve finished ${chapterName} in ${courseName}. The next materials are ready.`,
    ],
    buttonText: "NEXT CHAPTER",
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserFinishedChapterEmail;
