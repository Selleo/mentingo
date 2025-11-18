import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserInviteProps = {
  invitedByUserName: string;
  createPasswordLink: string;
} & DefaultEmailSettings;

export const UserInviteEmail = ({
  invitedByUserName,
  createPasswordLink,
  primaryColor = "#4796FD",
}: UserInviteProps) => {
  return BaseEmailTemplate({
    heading: "You're invited",
    paragraphs: [
      "Hello there 👋",
      `You've been invited to the e-learning platform by ${invitedByUserName}. Click the button below to start improving your skills.`,
    ],
    buttonText: "JOIN NOW",
    buttonLink: createPasswordLink,
    primaryColor,
  });
};

export default UserInviteEmail;
