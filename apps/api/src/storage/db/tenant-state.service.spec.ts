import { ConfigService } from "@nestjs/config";

import { TenantStateService } from "./tenant-state.service";

describe("TenantStateService Microsoft Calendar state", () => {
  const service = new TenantStateService(
    new ConfigService({ jwt: { secret: "test-state-secret" } }),
    {} as never,
  );

  it("binds tenant, user, purpose, nonce, origin, replacement intent and expiry", async () => {
    const state = await service.signMicrosoftCalendar({
      tenantId: "d8f1afe6-6897-42a5-a12d-bf132f6c42cb",
      userId: "9fe8f29b-fb40-4d8c-b4cb-4be64ed59ed8",
      purpose: "microsoft_calendar",
      nonce: "nonce",
      replace: true,
      origin: "https://tenant.example.com",
    });

    await expect(service.verifyMicrosoftCalendar(state)).resolves.toEqual(
      expect.objectContaining({
        tenantId: "d8f1afe6-6897-42a5-a12d-bf132f6c42cb",
        userId: "9fe8f29b-fb40-4d8c-b4cb-4be64ed59ed8",
        purpose: "microsoft_calendar",
        nonce: "nonce",
        replace: true,
        origin: "https://tenant.example.com",
      }),
    );
  });

  it("rejects tampered state", async () => {
    const state = await service.signMicrosoftCalendar({
      tenantId: "d8f1afe6-6897-42a5-a12d-bf132f6c42cb",
      userId: "9fe8f29b-fb40-4d8c-b4cb-4be64ed59ed8",
      purpose: "microsoft_calendar",
      nonce: "nonce",
      replace: false,
      origin: "https://tenant.example.com",
    });

    await expect(service.verifyMicrosoftCalendar(`${state}x`)).resolves.toBeNull();
  });
});
