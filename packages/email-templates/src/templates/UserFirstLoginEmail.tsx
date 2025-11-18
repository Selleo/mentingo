import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

type UserFirstLoginEmailProps = {
  name: string;
  coursesUrl: string;
} & DefaultEmailSettings;

export const UserFirstLoginEmail = ({
  name,
  coursesUrl,
  primaryColor = "#4796FD",
}: UserFirstLoginEmailProps) => {
  return BaseEmailTemplate({
    heading: "Welcome",
    paragraphs: [
      "Good to have you here 🙂",
      `Your first sign-in was successful. ${name} check your assigned courses.`,
    ],
    buttonText: "MY COURSES",
    buttonLink: coursesUrl,
    primaryColor,
  });
};

export default UserFirstLoginEmail;
