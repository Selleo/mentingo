import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { AuthorizationError, InternalOAuthError, TokenError } from "passport-oauth2";

import { getOAuthLoginErrorKey } from "./oauth-login-error.utils";
import { OAUTH_LOGIN_ERROR_KEYS } from "./oauth-login.constants";
import { OAuthLoginException, OAuthProviderDisabledException } from "./oauth-login.exception";

describe("getOAuthLoginErrorKey", () => {
  it("treats a provider access_denied response as a cancelled login", () => {
    expect(getOAuthLoginErrorKey(new UnauthorizedException(), "access_denied")).toBe(
      OAUTH_LOGIN_ERROR_KEYS.CANCELLED,
    );
  });

  it("uses the key carried by an OAuth login exception", () => {
    expect(
      getOAuthLoginErrorKey(
        new OAuthLoginException(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_NOT_CONFIGURED),
        undefined,
      ),
    ).toBe(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_NOT_CONFIGURED);
  });

  it("maps a disabled provider to the provider disabled key", () => {
    expect(
      getOAuthLoginErrorKey(
        new OAuthProviderDisabledException("Slack OAuth is disabled"),
        undefined,
      ),
    ).toBe(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_DISABLED);
  });

  it.each([
    ["token exchange", new InternalOAuthError("Failed to obtain access token", {})],
    ["token endpoint", new TokenError("Invalid code", "invalid_grant")],
    ["authorization", new AuthorizationError("Invalid scope", "invalid_scope")],
  ])("maps a provider %s error to the provider error key", (_description, providerException) => {
    expect(getOAuthLoginErrorKey(providerException, undefined)).toBe(
      OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR,
    );
  });

  it.each([
    ["an inactive tenant", new ForbiddenException("tenant.error.inactive")],
    ["an invalid state", new UnauthorizedException("Invalid tenant state")],
    ["an unexpected error", new Error("boom")],
  ])("falls back to the unknown key for %s", (_description, exception) => {
    expect(getOAuthLoginErrorKey(exception, undefined)).toBe(OAUTH_LOGIN_ERROR_KEYS.UNKNOWN);
  });
});
