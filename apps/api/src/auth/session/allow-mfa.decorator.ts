import { SetMetadata } from "@nestjs/common";

export const ALLOW_MFA = "allowMfa";
export const AllowMfa = () => SetMetadata(ALLOW_MFA, true);
