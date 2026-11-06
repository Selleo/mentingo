import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { LOGIN_METHOD_ERROR_KEYS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";
import axios from "axios";
import { Strategy } from "passport-oauth2";

import {
  entraIdGraphProfileSchema,
  entraIdTokenClaimsSchema,
} from "src/auth/schemas/entra-id-token.schema";
import { getCallbackPath } from "src/common/configuration/callbackUrl";
import { ENTRA_ID_SECRETS } from "src/env/env.config";
import { EnvService } from "src/env/services/env.service";

import type { Request } from "express";
import type { VerifyCallback } from "passport-oauth2";
import type {
  EntraIdDirectoryConfiguration,
  EntraIdGraphProfile,
  EntraIdTokenClaims,
} from "src/auth/schemas/entra-id-token.schema";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

const ENTRA_ID_LOGIN_HOST = "https://login.microsoftonline.com";
const ENTRA_ID_SCOPES = ["openid", "profile", "email", "User.Read"];
const ENTRA_ID_GRAPH_PROFILE_URL = "https://graph.microsoft.com/v1.0/me?$select=givenName,surname";

const getEntraIdIssuer = (directoryId: string) => `${ENTRA_ID_LOGIN_HOST}/${directoryId}/v2.0`;

const getEntraIdEndpoints = (directoryId: string) => ({
  authorizationURL: `${ENTRA_ID_LOGIN_HOST}/${directoryId}/oauth2/v2.0/authorize`,
  tokenURL: `${ENTRA_ID_LOGIN_HOST}/${directoryId}/oauth2/v2.0/token`,
});

/**
 * Signs users in through the Entra ID directory configured for the current tenant. Unlike the
 * multi-tenant Microsoft login, the authority is the tenant's own directory and every ID token is
 * checked to come from it, so accounts from other directories cannot claim a matching email.
 */
@Injectable()
export class EntraIdStrategy extends PassportStrategy(Strategy, "entra-id") {
  constructor(private readonly envService: EnvService) {
    super({
      ...getEntraIdEndpoints("placeholder"),
      clientID: "placeholder",
      clientSecret: "placeholder",
      callbackURL: getCallbackPath("entra-id"),
      scope: ENTRA_ID_SCOPES,
    });
  }

  authenticate(req: Request, options?: unknown): void {
    (async () => {
      try {
        const directory = await this.readDirectoryConfiguration();

        if (!directory) {
          this.fail(LOGIN_METHOD_ERROR_KEYS.MISSING_CONFIGURATION, 401);
          return;
        }

        const inner = new Strategy(
          {
            ...getEntraIdEndpoints(directory.directoryId),
            clientID: directory.clientId,
            clientSecret: directory.clientSecret,
            callbackURL: getCallbackPath("entra-id"),
            scope: ENTRA_ID_SCOPES,
            skipUserProfile: true,
          },
          (
            accessToken: string,
            _refreshToken: string,
            params: { id_token?: string },
            _profile: unknown,
            done: VerifyCallback,
          ) =>
            this.validate(accessToken, params.id_token, directory).then(
              (user) => done(null, user),
              done,
            ),
        );

        inner.success = this.success.bind(this);
        inner.fail = this.fail.bind(this);
        inner.error = this.error.bind(this);
        inner.redirect = this.redirect.bind(this);
        inner.pass = this.pass.bind(this);

        inner.authenticate(req as any, options as any);
      } catch (err) {
        this.error(err as Error);
      }
    })();
  }

  /**
   * The ID token arrives straight from the directory's token endpoint over TLS in exchange for the
   * authorization code, so its signature check is skipped (OIDC Core 3.1.3.7); the claims that bind
   * it to this tenant's directory and app registration are still enforced.
   */
  async validate(
    accessToken: string,
    idToken: string | undefined,
    directory: EntraIdDirectoryConfiguration,
  ): Promise<ProviderLoginUserType> {
    const claims = this.readIdTokenClaims(idToken);
    const email = claims?.email ?? claims?.preferred_username;

    if (!claims || !email || !this.isIssuedForDirectory(claims, directory)) {
      throw new UnauthorizedException(LOGIN_METHOD_ERROR_KEYS.UNTRUSTED_DIRECTORY);
    }

    const graphProfile = await this.fetchGraphProfile(accessToken);

    return { email, ...this.resolveUserName(claims, graphProfile, email) };
  }

  /**
   * ID tokens carry only the full display name unless the app registration adds optional claims,
   * so first and last name come from Microsoft Graph, then token claims, then the split display name.
   */
  private resolveUserName(
    claims: EntraIdTokenClaims,
    graphProfile: EntraIdGraphProfile | null,
    email: string,
  ) {
    const firstName = graphProfile?.givenName?.trim() || claims.given_name?.trim();
    const lastName = graphProfile?.surname?.trim() || claims.family_name?.trim() || "";

    if (firstName) return { firstName, lastName };

    const [displayFirstName, ...displayLastNames] = (claims.name?.trim() || email).split(/\s+/);

    return { firstName: displayFirstName, lastName: displayLastNames.join(" ") };
  }

  /** A missing Graph profile only degrades name quality, so it never blocks sign-in. */
  private async fetchGraphProfile(accessToken: string): Promise<EntraIdGraphProfile | null> {
    try {
      const { data } = await axios.get<unknown>(ENTRA_ID_GRAPH_PROFILE_URL, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      return Value.Check(entraIdGraphProfileSchema, data) ? data : null;
    } catch {
      return null;
    }
  }

  private readIdTokenClaims(idToken: string | undefined): EntraIdTokenClaims | null {
    const [, payload] = idToken?.split(".") ?? [];

    if (!payload) return null;

    try {
      const claims: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));

      return Value.Check(entraIdTokenClaimsSchema, claims) ? claims : null;
    } catch {
      return null;
    }
  }

  private isIssuedForDirectory(
    claims: EntraIdTokenClaims,
    { clientId, directoryId }: EntraIdDirectoryConfiguration,
  ) {
    const normalizedDirectoryId = directoryId.toLowerCase();

    return (
      claims.tid.toLowerCase() === normalizedDirectoryId &&
      claims.iss === getEntraIdIssuer(normalizedDirectoryId) &&
      claims.aud === clientId &&
      claims.exp * 1000 > Date.now()
    );
  }

  private async readDirectoryConfiguration(): Promise<EntraIdDirectoryConfiguration | null> {
    const [clientId, clientSecret, directoryId] = await Promise.all([
      this.readTenantSecret(ENTRA_ID_SECRETS.CLIENT_ID),
      this.readTenantSecret(ENTRA_ID_SECRETS.CLIENT_SECRET),
      this.readTenantSecret(ENTRA_ID_SECRETS.DIRECTORY_ID),
    ]);

    if (!clientId || !clientSecret || !directoryId) return null;

    return { clientId, clientSecret, directoryId };
  }

  /** Mirrors login method checks: the process environment applies only when the tenant stored nothing. */
  private async readTenantSecret(key: string) {
    try {
      const { value } = await this.envService.getEnv(key);

      return value.trim();
    } catch (error) {
      if (error instanceof NotFoundException) return process.env[key]?.trim();

      throw error;
    }
  }
}
