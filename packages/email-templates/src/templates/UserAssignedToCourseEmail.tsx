import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserAssignedToCourseProps = {
  courseName: string;
  courseLink: string;
} & DefaultEmailSettings;

export const UserAssignedToCourse = ({
  courseLink,
  courseName,
  primaryColor = "#4796FD",
}: UserAssignedToCourseProps) => {
  return BaseEmailTemplate({
    heading: "New course",
    paragraphs: [
      "You’ve been enrolled 🎓",
      `You now have access to ${courseName}. It’s available in your account.`,
    ],
    buttonText: "MY COURSES",
    buttonLink: courseLink,
    primaryColor,
  });
};

export default UserAssignedToCourse;
