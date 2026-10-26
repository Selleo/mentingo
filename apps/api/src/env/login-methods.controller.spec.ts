import { LOGIN_METHODS } from "@repo/shared";

import { EnvController } from "./env.controller";

import type { EnvService } from "./services/env.service";
import type { LoginMethodsService } from "./services/login-methods.service";
import type { CurrentUserType } from "src/common/types/current-user.type";

const createController = (loginMethodsService: Partial<LoginMethodsService>) =>
  new EnvController({} as EnvService, loginMethodsService as LoginMethodsService);

describe("login method API", () => {
  it("exposes only boolean methods publicly and keeps setup separate", async () => {
    const methods = {
      google: false,
      microsoft: false,
      slack: false,
      password: true,
      magicLink: true,
    };
    const loginMethodsService = {
      getLoginMethods: jest.fn().mockResolvedValue(methods),
      getLoginMethodSetup: jest.fn(),
    };
    const controller = createController(loginMethodsService);

    expect((await controller.getLoginMethods()).data).toEqual(methods);
    expect(loginMethodsService.getLoginMethodSetup).not.toHaveBeenCalled();
  });

  it("passes the administrator identity to the update and returns the fresh setup", async () => {
    const setup = { methods: {}, missingCredentials: {} };
    const loginMethodsService = {
      updateLoginMethod: jest.fn(),
      getLoginMethodSetup: jest.fn().mockResolvedValue(setup),
    };
    const controller = createController(loginMethodsService);
    const actor = { userId: "admin" } as CurrentUserType;
    const data = { method: LOGIN_METHODS.PASSWORD, enabled: false };

    const response = await controller.updateLoginMethod(data, actor);

    expect(loginMethodsService.updateLoginMethod).toHaveBeenCalledWith(data, actor);
    expect(response.data).toBe(setup);
  });
});
