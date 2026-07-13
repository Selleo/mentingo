import { SetMetadata } from "@nestjs/common";

export const ALLOW_PASSWORD_CHANGE_REQUIRED_KEY = "allow_password_change_required";

export const AllowPasswordChangeRequired = () =>
  SetMetadata(ALLOW_PASSWORD_CHANGE_REQUIRED_KEY, true);
