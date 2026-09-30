import { Test } from "@nestjs/testing";

import { ActivityLogsService } from "src/activity-logs/activity-logs.service";
import {
  AddEmailTemplateLanguageEvent,
  ArchiveEmailTemplateEvent,
  CreateEmailTemplateEvent,
  DeleteEmailTemplateEvent,
  PublishEmailTemplateEvent,
  RemoveEmailTemplateLanguageEvent,
  RestoreEmailTemplateEvent,
  UpdateEmailTemplateEvent,
} from "src/events";
import { materializeLegacyEvent } from "src/outbox/outbox.event-registry";

import { EmailTemplateActivityHandler } from "../email-template-activity.handler";

describe("EmailTemplateActivityHandler", () => {
  const recordActivity = jest.fn();
  const actor = {
    userId: "00000000-0000-4000-8000-000000000001",
    email: "admin@example.com",
    roleSlugs: ["admin"],
    permissions: [],
    tenantId: "00000000-0000-4000-8000-000000000002",
  };
  const resource = {
    id: "00000000-0000-4000-8000-000000000003",
    event: "password_recovery" as const,
    name: "Reset password",
    status: "published",
    baseLanguage: "en",
    availableLocales: ["en"],
  };
  let handler: EmailTemplateActivityHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailTemplateActivityHandler,
        { provide: ActivityLogsService, useValue: { recordActivity } },
      ],
    }).compile();
    handler = moduleRef.get(EmailTemplateActivityHandler);
  });

  it.each([
    [CreateEmailTemplateEvent, "create"],
    [UpdateEmailTemplateEvent, "update"],
    [PublishEmailTemplateEvent, "publish_email_template"],
    [ArchiveEmailTemplateEvent, "archive_email_template"],
    [RestoreEmailTemplateEvent, "restore_email_template"],
    [AddEmailTemplateLanguageEvent, "add_email_template_language"],
    [RemoveEmailTemplateLanguageEvent, "remove_email_template_language"],
    [DeleteEmailTemplateEvent, "delete"],
  ] as const)("records %s as %s", async (Event, expectedAction) => {
    const original = new Event({ actor, resource });
    const materialized = materializeLegacyEvent(Event.name, JSON.parse(JSON.stringify(original)));
    expect(materialized).toBeInstanceOf(Event);
    await handler.handle(materialized as typeof original);

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        actor,
        operation: expectedAction,
        resourceType: "email_template",
        resourceId: resource.id,
      }),
    );
  });

  it("records changed fields for an edit without storing email body content", async () => {
    const previous = { ...resource, name: "Reset password" };
    const updated = { ...resource, name: "Reset your password" };

    await handler.handle(new UpdateEmailTemplateEvent({ actor, resource: updated, previous }));

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFields: ["name"],
        before: { name: "Reset password" },
        after: { name: "Reset your password" },
      }),
    );
  });

  it("keeps declared changed fields when an event has no value snapshots", async () => {
    await handler.handle(
      new UpdateEmailTemplateEvent({
        actor,
        resource,
        previous: resource,
        changedFields: ["subject", "content"],
      }),
    );

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ changedFields: ["subject", "content"] }),
    );
    expect(recordActivity.mock.calls[0][0]).not.toHaveProperty("subject");
    expect(recordActivity.mock.calls[0][0]).not.toHaveProperty("content");
  });

  it("keeps safe content edit details in activity context", async () => {
    await handler.handle(
      new UpdateEmailTemplateEvent({
        actor,
        resource,
        previous: resource,
        changedFields: ["content"],
        context: { languages: "pl", changedFields: "content" },
      }),
    );

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({ context: { languages: "pl", changedFields: "content" } }),
    );
  });

  it("records localized name, subject, and content values in Before/After metadata", async () => {
    const previous = {
      ...resource,
      pl: { name: "Resetuj hasło", subject: "Stary temat", content: { text: "Stara treść" } },
    };
    const updated = {
      ...resource,
      pl: { name: "Zresetuj hasło", subject: "Nowy temat", content: { text: "Nowa treść" } },
    };

    await handler.handle(
      new UpdateEmailTemplateEvent({
        actor,
        resource: updated,
        previous,
        changedFields: ["name", "subject", "content"],
        context: { languages: "pl", changedFields: "name, subject, content" },
      }),
    );

    expect(recordActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        before: {
          pl: JSON.stringify(previous.pl),
        },
        after: {
          pl: JSON.stringify(updated.pl),
        },
        context: { languages: "pl", changedFields: "name, subject, content" },
      }),
    );
  });

  it("records a base-language name edit once under its language", async () => {
    const snapshot = {
      id: resource.id,
      event: resource.event,
      status: resource.status,
      baseLanguage: resource.baseLanguage,
      availableLocales: resource.availableLocales,
    };
    await handler.handle(
      new UpdateEmailTemplateEvent({
        actor,
        previous: { ...snapshot, de: { name: "Kurszuweisung" } },
        resource: { ...snapshot, de: { name: "Kurszuweisung 1312313" } },
        context: { name: "Kurszuweisung 1312313", languages: "de" },
      }),
    );

    const log = recordActivity.mock.calls[0][0];
    expect(log.before).toEqual({ de: '{"name":"Kurszuweisung"}' });
    expect(log.after).toEqual({ de: '{"name":"Kurszuweisung 1312313"}' });
    expect(log.before).not.toHaveProperty("name");
    expect(log.after).not.toHaveProperty("name");
  });

  it.each([AddEmailTemplateLanguageEvent, RemoveEmailTemplateLanguageEvent])(
    "keeps the language code in %s context",
    async (Event) => {
      await handler.handle(
        new Event({
          actor,
          resource: { ...resource, availableLocales: ["en", "pl"] },
          previous: resource,
          changedFields: ["language"],
          context: { language: "pl" },
        }),
      );

      expect(recordActivity).toHaveBeenCalledWith(
        expect.objectContaining({ context: { language: "pl" } }),
      );
    },
  );
});
