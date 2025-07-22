import { Injectable } from "@nestjs/common";

import { ACCESS_TOKEN_EXPIRATION_TIME, REFRESH_TOKEN_EXPIRATION_TIME } from "./consts";

import type { Response } from "express";

@Injectable()
export class TokenService {
  setTokenCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe: boolean = false,
  ) {
    const oneMonthExpirationTime = 30 * 24 * 60 * 60 * 1000;

    const accessTokenMaxAge = rememberMe ? oneMonthExpirationTime : ACCESS_TOKEN_EXPIRATION_TIME;
    const refreshTokenMaxAge = rememberMe ? oneMonthExpirationTime : REFRESH_TOKEN_EXPIRATION_TIME;

    const isProduction = process.env.NODE_ENV === "production";

    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: accessTokenMaxAge,
    });

    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "strict",
      maxAge: refreshTokenMaxAge,
      path: "/api/auth/refresh",
    });
  }

  clearTokenCookies(response: Response) {
    response.clearCookie("access_token");
    response.clearCookie("refresh_token");
  }
}
