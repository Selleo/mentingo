import { EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH } from "../email-template-image.constants";

export const buildEmailTemplateImageUrl = (params: {
  tenantHost: string;
  reference: string;
}): string => {
  return (
    params.tenantHost + EMAIL_TEMPLATE_IMAGE_PUBLIC_PATH + encodeURIComponent(params.reference)
  );
};
