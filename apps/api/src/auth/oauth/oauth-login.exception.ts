import { ForbiddenException, UnauthorizedException } from "@nestjs/common";

import { OAuthLoginErrorKey } from "./oauth-login.constants";

export class OAuthLoginException extends UnauthorizedException {
  constructor(public readonly errorKey: OAuthLoginErrorKey) {
    super(errorKey);
  }
}

export class OAuthProviderDisabledException extends ForbiddenException {}
