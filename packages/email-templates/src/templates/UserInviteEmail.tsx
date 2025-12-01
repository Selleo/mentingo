import { getUserInviteEmailTranslations } from "translations/userInvite";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserInviteProps = {
  invitedByUserName: string;
  createPasswordLink: string;
} & DefaultEmailSettings;

export const UserInviteEmail = ({
  invitedByUserName,
  createPasswordLink,
  primaryColor,
  language = "en",
}: UserInviteProps) => {
  const { heading, paragraphs, buttonText } = getUserInviteEmailTranslations(
    language,
    invitedByUserName,
  );

  return BaseEmailTemplate({
    heading,
    paragraphs,
    buttonText,
    buttonLink: createPasswordLink,
    primaryColor,
  });
};

export default UserInviteEmail;
