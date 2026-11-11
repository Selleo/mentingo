import { baseUrl } from "~/utils/baseUrl";

export const buildLoginPageFilePreviewUrl = (resourceId: string) =>
  `${baseUrl}/api/settings/login-page-files/${resourceId}/content`;
