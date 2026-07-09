import { Type } from "@sinclair/typebox";

export const platformSimpleLogoResponseSchema = Type.Object({
  url: Type.Union([Type.String(), Type.Null()]),
});

export const platformSimpleLogoPwaIconsResponseSchema = Type.Object({
  icon192Url: Type.Union([Type.String(), Type.Null()]),
  icon192Type: Type.Union([Type.String(), Type.Null()]),
  icon512Url: Type.Union([Type.String(), Type.Null()]),
  icon512Type: Type.Union([Type.String(), Type.Null()]),
});
