import { UnauthorizedException } from "@nestjs/common";

import { AuthController } from "./auth.controller";

const createController = (inviteOnlyRegistration = false) => {
  const controller = Object.create(AuthController.prototype);
  controller.settingsService = {
    getGlobalSettings: jest.fn().mockResolvedValue({ enforceSSO: true, inviteOnlyRegistration }),
  };
  controller.authService = {
    register: jest.fn().mockResolvedValue(undefined),
    login: jest.fn().mockResolvedValue({
      accessToken: "access",
      refreshToken: "refresh",
      shouldVerifyMFA: false,
    }),
  };
  controller.tokenService = { setTokenCookies: jest.fn(), setTemporaryTokenCookies: jest.fn() };
  return controller;
};

const credentials = { email: "user@example.com", password: "Password123@" };

describe("legacy SSO enforcement is not an authentication policy", () => {
  it("allows the enabled password login and sets its session cookies", async () => {
    const controller = createController();
    const response = {} as never;
    await expect(
      (controller as AuthController).login(credentials, response),
    ).resolves.toBeDefined();
    expect(controller.tokenService.setTokenCookies).toHaveBeenCalledWith(
      response,
      "access",
      "refresh",
      undefined,
    );
  });

  it("allows password registration despite a persisted legacy flag", async () => {
    const controller = createController();
    await expect(
      (controller as AuthController).register(credentials as never, {} as never),
    ).resolves.toBeDefined();
    expect(controller.authService.register).toHaveBeenCalledWith(credentials);
  });

  it("still rejects invite-only self-registration", async () => {
    const controller = createController(true);
    await expect(
      (controller as AuthController).register(credentials as never, {} as never),
    ).rejects.toThrow("inviteOnlyRegistrationView.toast.registerRedirect");
    expect(controller.authService.register).not.toHaveBeenCalled();
  });

  it("preserves the authentication service's rejection", async () => {
    const controller = createController();
    controller.authService.login.mockRejectedValue(
      new UnauthorizedException("invalid credentials"),
    );
    await expect((controller as AuthController).login(credentials, {} as never)).rejects.toThrow(
      "invalid credentials",
    );
    expect(controller.tokenService.setTokenCookies).not.toHaveBeenCalled();
  });
});
