import { getLiveTrainingEmailButtonText } from "translations/liveTrainingEmail";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type LiveTrainingEndedEmailProps = {
  title: string;
  content: string;
  liveTrainingLink: string;
} & DefaultEmailSettings;

export const LiveTrainingEndedEmail = ({
  title,
  content,
  liveTrainingLink,
  primaryColor,
  companyName,
  language = "en",
}: LiveTrainingEndedEmailProps) =>
  BaseEmailTemplate({
    heading: title,
    paragraphs: [content],
    buttonText: getLiveTrainingEmailButtonText(language),
    buttonLink: liveTrainingLink,
    primaryColor,
    companyName,
  });

export default LiveTrainingEndedEmail;
