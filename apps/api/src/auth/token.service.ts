import { Injectable } from "@nestjs/common";

import { ACCESS_TOKEN_EXPIRATION_TIME, REFRESH_TOKEN_EXPIRATION_TIME } from "./consts";

import type { Response } from "express";

@Injectable()
export class TokenService {
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
  }

  setTokenCookies(
    response: Response,
    accessToken: string,
    refreshToken: string,
    rememberMe: boolean = false,
  ) {
    const oneMonthExpirationTime = 30 * 24 * 60 * 60 * 1000;

    const accessTokenMaxAge = rememberMe ? oneMonthExpirationTime : ACCESS_TOKEN_EXPIRATION_TIME;
    const refreshTokenMaxAge = rememberMe ? oneMonthExpirationTime : REFRESH_TOKEN_EXPIRATION_TIME;

    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict",
      maxAge: accessTokenMaxAge,
    });

    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict",
      maxAge: refreshTokenMaxAge,
      path: "/api/auth/refresh",
    });
  }

  setTemporaryTokenCookies(response: Response, accessToken: string, refreshToken: string) {
    const fiveMinutesExpirationTime = 5 * 60 * 1000;

    response.cookie("access_token", accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict",
      maxAge: fiveMinutesExpirationTime,
    });

    response.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: "strict",
      maxAge: fiveMinutesExpirationTime,
      path: "/api/auth/refresh",
    });
  }

  clearTokenCookies(response: Response) {
    response.clearCookie("access_token");
    response.clearCookie("refresh_token", { path: "/api/auth/refresh" });
  }
}
