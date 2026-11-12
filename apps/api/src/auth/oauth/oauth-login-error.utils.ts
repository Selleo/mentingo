import { AuthorizationError, InternalOAuthError, TokenError } from "passport-oauth2";
import { match, P } from "ts-pattern";

import { OAUTH_LOGIN_ERROR_KEYS, OAUTH_PROVIDER_DENIED_ERROR } from "./oauth-login.constants";
import { OAuthLoginException, OAuthProviderDisabledException } from "./oauth-login.exception";

import type { OAuthLoginErrorKey } from "./oauth-login.constants";

export const getOAuthLoginErrorKey = (
  exception: unknown,
  providerError: unknown,
): OAuthLoginErrorKey => {
  if (providerError === OAUTH_PROVIDER_DENIED_ERROR) return OAUTH_LOGIN_ERROR_KEYS.CANCELLED;

  return match(exception)
    .with(P.instanceOf(OAuthLoginException), (loginException) => loginException.errorKey)
    .with(
      P.instanceOf(OAuthProviderDisabledException),
      () => OAUTH_LOGIN_ERROR_KEYS.PROVIDER_DISABLED,
    )
    .with(
      P.union(
        P.instanceOf(AuthorizationError),
        P.instanceOf(TokenError),
        P.instanceOf(InternalOAuthError),
      ),
      () => OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR,
    )
    .otherwise(() => OAUTH_LOGIN_ERROR_KEYS.UNKNOWN);
};
