import axios from "axios";
import { Strategy } from "passport-oauth2";

import { OAUTH_LOGIN_ERROR_KEYS } from "src/auth/oauth/oauth-login.constants";
import { OAuthLoginException } from "src/auth/oauth/oauth-login.exception";

import { SlackStrategy } from "./slack.strategy";

import type { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import type { EnvService } from "src/env/services/env.service";

jest.mock("axios");

const mockedAxios = jest.mocked(axios);

describe("SlackStrategy.validate", () => {
  const slackStrategy = new SlackStrategy({} as ConfigService, {} as EnvService);

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("reads the user from the OpenID Connect user info endpoint", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        ok: true,
        email: "jane@example.com",
        name: "Jane Doe",
        given_name: "Jane",
        family_name: "Doe",
      },
    });

    await expect(slackStrategy.validate("slack-access-token")).resolves.toEqual({
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
    });
    expect(mockedAxios.get).toHaveBeenCalledWith("https://slack.com/api/openid.connect.userInfo", {
      headers: { Authorization: "Bearer slack-access-token" },
    });
  });

  it("falls back to the display name when Slack has no given name", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { ok: true, email: "jane@example.com", name: "jane.doe" },
    });

    await expect(slackStrategy.validate("slack-access-token")).resolves.toEqual({
      firstName: "jane.doe",
      lastName: "",
      email: "jane@example.com",
    });
  });

  it.each([
    ["Slack rejects the token", { ok: false, error: "invalid_auth" }],
    ["Slack returns no email", { ok: true, name: "Jane Doe" }],
  ])("throws a provider error when %s", async (_description, userInfo) => {
    mockedAxios.get.mockResolvedValue({ data: userInfo });

    const validation = slackStrategy.validate("slack-access-token");

    await expect(validation).rejects.toBeInstanceOf(OAuthLoginException);
    await expect(validation).rejects.toMatchObject({
      errorKey: OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR,
    });
  });
});

describe("SlackStrategy.authenticate", () => {
  const authenticateWithInnerError = async (innerError: Error) => {
    const envService = {
      getEnv: async (name: string) => ({ name, value: `test-${name}` }),
    } as EnvService;
    const slackStrategy = new SlackStrategy({} as ConfigService, envService);
    const errorHandler = jest.fn();
    Object.assign(slackStrategy, {
      success: jest.fn(),
      fail: jest.fn(),
      redirect: jest.fn(),
      pass: jest.fn(),
      error: errorHandler,
    });

    jest.spyOn(Strategy.prototype, "authenticate").mockImplementation(function (this: Strategy) {
      this.error(innerError);
    });

    slackStrategy.authenticate({} as Request);
    await new Promise(process.nextTick);

    return errorHandler.mock.calls[0]?.[0];
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("reports a token response without an access token as a provider error", async () => {
    const reportedError = await authenticateWithInnerError(
      new Error("Failed to obtain access token"),
    );

    expect(reportedError).toBeInstanceOf(OAuthLoginException);
    expect(reportedError).toMatchObject({ errorKey: OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR });
  });

  it("keeps OAuth login errors raised while validating the user", async () => {
    const validationError = new OAuthLoginException(OAUTH_LOGIN_ERROR_KEYS.PROVIDER_ERROR);

    await expect(authenticateWithInnerError(validationError)).resolves.toBe(validationError);
  });
});
