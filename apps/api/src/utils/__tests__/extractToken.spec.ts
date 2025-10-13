import { extractToken } from "src/utils/extract-token";

import type { Request } from "express";

describe("extractToken", () => {
  it("should return token from specified cookie", () => {
    const request1 = {
      cookies: {
        access_token: "token",
      },
      headers: {},
    } as Request;
    expect(extractToken(request1, "access_token")).toBe("token");

    const request2 = {
      cookies: {
        refresh_token: "token",
      },
      headers: {},
    } as Request;
    expect(extractToken(request2, "refresh_token")).toBe("token");

    const request3 = {
      cookies: {
        access_token: "no-token",
        refresh_token: "token",
      },
      headers: {},
    } as Request;
    expect(extractToken(request3, "refresh_token")).toBe("token");
  });

  it("should return null if specified cookie does not exist", () => {
    const request = {
      cookies: {
        access_token: "token",
      },
      headers: {},
    } as Request;

    expect(extractToken(request, "refresh_token")).toBe(null);
  });

  it("should return token from authorization header if specified cookie does not exist", () => {
    const request = {
      cookies: {
        access_token: "no-token",
      },
      headers: {
        authorization: "Bearer token",
      },
    } as Request;

    expect(extractToken(request, "refresh_token")).toBe("token");
  });

  it("should return token from cookies instead of authorization header if specified cookie does exist", () => {
    const request = {
      cookies: {
        access_token: "token",
      },
      headers: {
        authorization: "Bearer no-token",
      },
    } as Request;

    expect(extractToken(request, "access_token")).toBe("token");
  });

  it("should return null if neither specified cookie or authorization header does not exist", () => {
    const request = {
      cookies: {},
      headers: {},
    } as Request;

    expect(extractToken(request, "access_token")).toBe(null);
  });

  it("should return null if authorization header is invalid", () => {
    const request = {
      cookies: {},
      headers: {
        authorization: "token",
      },
    } as Request;

    expect(extractToken(request, "access_token")).toBe(null);
  });
});
