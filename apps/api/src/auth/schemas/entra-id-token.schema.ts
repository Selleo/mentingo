import { type Static, Type } from "@sinclair/typebox";

export const entraIdTokenClaimsSchema = Type.Object({
  iss: Type.String(),
  aud: Type.String(),
  tid: Type.String(),
  oid: Type.String(),
  exp: Type.Number(),
  email: Type.Optional(Type.String()),
  preferred_username: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  given_name: Type.Optional(Type.String()),
  family_name: Type.Optional(Type.String()),
});

export type EntraIdTokenClaims = Static<typeof entraIdTokenClaimsSchema>;

export const entraIdGraphProfileSchema = Type.Object({
  givenName: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  surname: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

export type EntraIdGraphProfile = Static<typeof entraIdGraphProfileSchema>;

export type EntraIdDirectoryConfiguration = {
  clientId: string;
  clientSecret: string;
  directoryId: string;
};
