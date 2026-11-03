import { PgDialect } from "drizzle-orm/pg-core";

import { OutboxRepository } from "./outbox.repository";

describe("competency outbox recovery", () => {
  const eventTypes = [
    "LessonCompletedEvent",
    "LessonProgressChangedEvent",
    "LearningSourceWithdrawnEvent",
    "UserCourseFinishedEvent",
    "CertificateArchivedEmailEvent",
  ];

  it.each(eventTypes)("delays failed %s intake before retrying", async (eventType) => {
    const execute = jest.fn().mockResolvedValue([]);
    const repository = new OutboxRepository({ execute } as never);

    await repository.claimNext();

    const { sql: query, params } = new PgDialect().sqlToQuery(execute.mock.calls[0][0]);
    expect(query).toContain('"outbox_events"."event_type" not in');
    expect(params).toContain(eventType);
    expect(query).toContain("updated_at < NOW() - INTERVAL '5 seconds'");
    expect(query).toContain("FOR UPDATE SKIP LOCKED");
  });

  it.each(eventTypes)("recovers stalled %s intake after a restart", async (eventType) => {
    const where = jest.fn().mockResolvedValue([]);
    const set = jest.fn().mockReturnValue({ where });
    const update = jest.fn().mockReturnValue({ set });
    const repository = new OutboxRepository({ update } as never);

    await repository.recoverStalledIntake();

    const { sql: query, params } = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query).toContain('"outbox_events"."event_type" in');
    expect(params).toContain(eventType);
    expect(params).toContain("processing");
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ status: "pending" }));
    expect(query).toContain("< NOW() - INTERVAL '5 minutes'");
  });
});
