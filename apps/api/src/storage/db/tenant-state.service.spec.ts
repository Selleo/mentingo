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

describe("TenantStateService Google Calendar state", () => {
  const service = new TenantStateService(
    new ConfigService({ jwt: { secret: "test-state-secret" } }),
    {} as never,
  );
  const googleCalendarState = {
    tenantId: "d8f1afe6-6897-42a5-a12d-bf132f6c42cb",
    userId: "9fe8f29b-fb40-4d8c-b4cb-4be64ed59ed8",
    purpose: "google_calendar",
    nonce: "nonce",
    replace: true,
    outboundSync: true,
    origin: "https://tenant.example.com",
  } as const;

  it("binds tenant, user, purpose, nonce, origin, replacement and export intent", async () => {
    const state = await service.signGoogleCalendar(googleCalendarState);

    await expect(service.verifyGoogleCalendar(state)).resolves.toEqual(
      expect.objectContaining(googleCalendarState),
    );
  });

  it("rejects tampered state", async () => {
    const state = await service.signGoogleCalendar(googleCalendarState);

    await expect(service.verifyGoogleCalendar(`${state}x`)).resolves.toBeNull();
  });

  it("does not accept Microsoft Calendar state for the Google Calendar callback", async () => {
    const microsoftState = await service.signMicrosoftCalendar({
      tenantId: googleCalendarState.tenantId,
      userId: googleCalendarState.userId,
      purpose: "microsoft_calendar",
      nonce: googleCalendarState.nonce,
      replace: googleCalendarState.replace,
      origin: googleCalendarState.origin,
    });

    await expect(service.verifyGoogleCalendar(microsoftState)).resolves.toBeNull();
  });
});
