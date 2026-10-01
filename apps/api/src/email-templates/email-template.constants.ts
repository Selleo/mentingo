export const EMAIL_TEMPLATE_VARIABLE_PATTERN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export const EMAIL_TEMPLATE_ASSET_PATTERN =
  /^asset:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
export const EMAIL_TEMPLATE_ASSET_FOLDER = "email-templates";
export const EMAIL_TEMPLATE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const EMAIL_TEMPLATE_IMAGE_MAX_PIXELS = 16_000_000;

export const UNSAFE_EMAIL_TEMPLATE_IMAGE_HOSTNAMES = new Set(["localhost", "0.0.0.0", "::", "::1"]);
