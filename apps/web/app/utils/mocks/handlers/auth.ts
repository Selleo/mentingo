import { AUTH_SESSION_STATUS } from "@repo/shared";
import { http, HttpResponse } from "msw";

import { currentUser } from "../data/currentUser";

interface Credentials {
  email: string;
  password: string;
}

export const handlers = [
  http.get("/api/auth/session", () =>
    HttpResponse.json({ data: { status: AUTH_SESSION_STATUS.AUTHENTICATED } }),
  ),
  http.post("/api/auth/login", async ({ request }) => {
    const credentials = (await request.json()) as Credentials;

    if (credentials.email === "test@example.com" && credentials.password === "password123") {
      return HttpResponse.json({ token: "fake_token" }, { status: 200 });
    } else {
      return new HttpResponse(null, { status: 401 });
    }
  }),
  http.post("/api/auth/register", async ({ request }) => {
    const credentials = (await request.json()) as Credentials;

    if (credentials.email === "test@example.com" && credentials.password === "password123") {
      return HttpResponse.json({ token: "fake_token" }, { status: 200 });
    } else {
      return new HttpResponse(null, { status: 401 });
    }
  }),
  http.get("/api/auth/current-user", () => {
    return HttpResponse.json(currentUser);
  }),
  http.post("/api/auth/refresh", () => {
    return HttpResponse.json({
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
    });
  }),
];
