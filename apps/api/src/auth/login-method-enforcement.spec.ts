import { UnauthorizedException } from "@nestjs/common";
import { LOGIN_METHOD_ERROR_KEYS } from "@repo/shared";

import { AuthService } from "./auth.service";

import type { LoginMethodsService } from "src/env/services/login-methods.service";

const createAuthServiceWithDisabledLoginMethods = () => {
  const databaseSelect = jest.fn();
  const service = Object.create(AuthService.prototype);
  service.loginMethodsService = {
    assertLoginMethodEnabled: jest
      .fn()
      .mockRejectedValue(new UnauthorizedException(LOGIN_METHOD_ERROR_KEYS.DISABLED)),
  } satisfies Pick<LoginMethodsService, "assertLoginMethodEnabled">;
  service.db = { select: databaseSelect, transaction: jest.fn() };
  service.userService = { getUserByEmail: jest.fn() };

  return { authService: service as AuthService, databaseSelect };
};

const DISABLED_LOGIN_METHOD_FLOWS = [
  {
    flow: "password recovery",
    run: (service: AuthService) => service.forgotPassword("user@example.com"),
  },
  {
    flow: "password reset",
    run: (service: AuthService) => service.resetPassword("old-token", "unused"),
  },
  {
    flow: "password creation",
    run: (service: AuthService) => service.createPassword({} as never),
  },
  {
    flow: "password validation",
    run: (service: AuthService) => service.validateUser("user@example.com", "unused"),
  },
  {
    flow: "password registration",
    run: (service: AuthService) =>
      service.register({ email: "user@example.com", password: "unused" } as never),
  },
  {
    flow: "magic-link issuance",
    run: (service: AuthService) => service.createMagicLink("user@example.com"),
  },
  {
    flow: "magic-link consumption",
    run: (service: AuthService) => service.handleMagicLinkLogin({} as never, "old-token"),
  },
];

describe("disabled organization email login methods", () => {
  it.each(DISABLED_LOGIN_METHOD_FLOWS)(
    "blocks $flow before touching the database",
    async ({ run }) => {
      const { authService, databaseSelect } = createAuthServiceWithDisabledLoginMethods();

      await expect(run(authService)).rejects.toThrow(LOGIN_METHOD_ERROR_KEYS.DISABLED);
      expect(databaseSelect).not.toHaveBeenCalled();
    },
  );
});
