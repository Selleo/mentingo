import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type FinishedCourseEmailProps = {
  userName: string;
  courseName: string;
  progressLink: string;
} & DefaultEmailSettings;

export const FinishedCourseEmail = ({
  userName,
  courseName,
  progressLink,
  primaryColor = "#4796FD",
}: FinishedCourseEmailProps) => {
  return BaseEmailTemplate({
    heading: "User finished the course",
    paragraphs: ["Hello! 🧑‍💻", `${userName} completed ${courseName}. Review their progress.`],
    buttonText: "VIEW PROGRESS",
    buttonLink: progressLink,
    primaryColor,
  });
};

export default FinishedCourseEmail;
