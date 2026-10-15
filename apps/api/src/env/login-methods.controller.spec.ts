import { EnvController } from "./env.controller";

import type { EnvService } from "./services/env.service";

describe("login method API", () => {
  it("exposes only boolean methods publicly and keeps setup separate", async () => {
    const methods = {
      google: false,
      microsoft: false,
      slack: false,
      password: true,
      magicLink: true,
    };
    const service = {
      getLoginMethods: jest.fn().mockResolvedValue(methods),
      getLoginMethodSetup: jest.fn(),
    };
    const controller = new EnvController(service as unknown as EnvService);
    expect((await controller.getLoginMethods()).data).toEqual(methods);
    expect(service.getLoginMethodSetup).not.toHaveBeenCalled();
  });
  it("passes the administrator identity to the atomic update", async () => {
    const service = {
      updateLoginMethod: jest.fn(),
      getLoginMethodSetup: jest.fn().mockResolvedValue({}),
    };
    const controller = new EnvController(service as unknown as EnvService);
    const actor = { userId: "admin" } as never;
    const data = { method: "password" as const, enabled: false };
    await controller.updateLoginMethod(data, actor);
    expect(service.updateLoginMethod).toHaveBeenCalledWith(data, actor);
  });
});
