import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type NewUserEmailProps = {
  userName: string;
  profileLink: string;
} & DefaultEmailSettings;

export const NewUserEmail = ({ userName, profileLink, primaryColor }: NewUserEmailProps) => {
  return BaseEmailTemplate({
    heading: "New user profile",
    paragraphs: ["Hello! 🧑‍💻", `${userName} has joined. Review the profile and assign courses.`],
    buttonText: "OPEN PROFILE",
    buttonLink: profileLink,
    primaryColor,
  });
};

export default NewUserEmail;
