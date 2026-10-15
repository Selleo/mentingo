import { AuthService } from "./auth.service";

const disabledService = () => {
  const service = Object.create(AuthService.prototype);
  service.envService = {
    getLoginMethods: async () => ({ password: false, magicLink: false }),
  };
  service.db = { select: jest.fn(), transaction: jest.fn() };
  service.userService = { getUserByEmail: jest.fn() };
  return service as AuthService;
};

describe("disabled organization email login methods", () => {
  it("blocks password recovery when password login is disabled", async () => {
    await expect(disabledService().forgotPassword("user@example.com")).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
  it("blocks password reset when password login is disabled", async () => {
    await expect(disabledService().resetPassword("old-token", "unused")).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
  it("blocks password creation when password login is disabled", async () => {
    await expect(disabledService().createPassword({} as never)).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
  it("blocks password validation before querying credentials", async () => {
    await expect(disabledService().validateUser("user@example.com", "unused")).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
  it("blocks password registration before creating accounts", async () => {
    await expect(
      disabledService().register({ email: "user@example.com", password: "unused" } as never),
    ).rejects.toThrow("loginMethods.errors.disabled");
  });
  it("blocks magic-link issuance before sending mail", async () => {
    await expect(disabledService().createMagicLink("user@example.com")).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
  it("blocks consumption of previously issued magic links", async () => {
    await expect(disabledService().handleMagicLinkLogin({} as never, "old-token")).rejects.toThrow(
      "loginMethods.errors.disabled",
    );
  });
});
