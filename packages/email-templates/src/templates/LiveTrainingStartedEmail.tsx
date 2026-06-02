import { getLiveTrainingEmailButtonText } from "translations/liveTrainingEmail";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type LiveTrainingStartedEmailProps = {
  title: string;
  content: string;
  liveTrainingLink: string;
} & DefaultEmailSettings;

export const LiveTrainingStartedEmail = ({
  title,
  content,
  liveTrainingLink,
  primaryColor,
  companyName,
  language = "en",
}: LiveTrainingStartedEmailProps) =>
  BaseEmailTemplate({
    heading: title,
    paragraphs: [content],
    buttonText: getLiveTrainingEmailButtonText(language),
    buttonLink: liveTrainingLink,
    primaryColor,
    companyName,
  });

export default LiveTrainingStartedEmail;
