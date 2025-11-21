import { BaseEmailTemplate } from "./BaseEmailTemplate";

import { DefaultEmailSettings } from "types";

export type UserFinishedCourseProps = {
  courseName: string;
  certificateDownloadLink: string;
} & DefaultEmailSettings;

export const UserFinishedCourseEmail = ({
  courseName,
  certificateDownloadLink,
  primaryColor,
}: UserFinishedCourseProps) => {
  return BaseEmailTemplate({
    heading: "Course completed",
    paragraphs: [
      "Congratulations! 🏁",
      `You’ve completed ${courseName}. Your certificate is ready to download; check the recommended next steps.`,
    ],
    buttonText: "DOWNLOAD CERTIFICATE",
    buttonLink: certificateDownloadLink,
    primaryColor,
  });
};

export default UserFinishedCourseEmail;
