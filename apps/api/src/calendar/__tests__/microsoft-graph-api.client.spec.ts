import {
  MicrosoftGraphApiClient,
  MicrosoftGraphError,
} from "../clients/microsoft-graph-api.client";

describe("MicrosoftGraphApiClient configuration", () => {
  const envService = {
    getEnv: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const client = new MicrosoftGraphApiClient(envService as never, configService as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses tenant-managed secrets for the authorization URL", async () => {
    envService.getEnv.mockImplementation((name: string) =>
      Promise.resolve({
        name,
        value:
          name === "MICROSOFT_CALENDAR_CLIENT_ID" ? "tenant-calendar-client-id" : "tenant-secret",
      }),
    );

    const authorizationUrl = await client.getAuthorizationUrl(
      "signed-state",
      "https://tenant.example.com/api/auth/microsoft-calendar/callback",
    );

    expect(new URL(authorizationUrl).searchParams.get("client_id")).toBe(
      "tenant-calendar-client-id",
    );
    expect(envService.getEnv).toHaveBeenCalledWith("MICROSOFT_CALENDAR_CLIENT_ID");
    expect(envService.getEnv).toHaveBeenCalledWith("MICROSOFT_CALENDAR_CLIENT_SECRET");
    expect(configService.get).not.toHaveBeenCalled();
  });

  it("does not fall back to deployment configuration when tenant secrets are missing", async () => {
    envService.getEnv.mockRejectedValue(new Error("Secret not found"));
    configService.get.mockReturnValue("deployment-calendar-credential");

    await expect(client.isConfigured()).resolves.toBe(false);
    await expect(
      client.getAuthorizationUrl(
        "signed-state",
        "https://tenant.example.com/api/auth/microsoft-calendar/callback",
      ),
    ).rejects.toThrow(new MicrosoftGraphError("Microsoft Calendar is not configured"));
    expect(configService.get).not.toHaveBeenCalled();
  });
});
