import { getLiveTrainingEmailButtonText } from "translations/liveTrainingEmail";

import BaseEmailTemplate from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type LiveTrainingReminderEmailProps = {
  title: string;
  content: string;
  liveTrainingLink: string;
} & DefaultEmailSettings;

export const LiveTrainingReminderEmail = ({
  title,
  content,
  liveTrainingLink,
  primaryColor,
  companyName,
  language = "en",
}: LiveTrainingReminderEmailProps) =>
  BaseEmailTemplate({
    heading: title,
    paragraphs: [content],
    buttonText: getLiveTrainingEmailButtonText(language),
    buttonLink: liveTrainingLink,
    primaryColor,
    companyName,
  });

export default LiveTrainingReminderEmail;
