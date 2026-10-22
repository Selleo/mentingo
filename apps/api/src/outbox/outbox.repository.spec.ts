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

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    const delayedTypes = query.match(/event_type NOT IN\s*\(([^)]*)\)/)?.[1];
    expect(delayedTypes).toContain(`'${eventType}'`);
    expect(query).toContain("updated_at < NOW() - INTERVAL '5 seconds'");
    expect(query).toContain("FOR UPDATE SKIP LOCKED");
  });

  it.each(eventTypes)("recovers stalled %s intake after a restart", async (eventType) => {
    const execute = jest.fn().mockResolvedValue([]);
    const repository = new OutboxRepository({ execute } as never);

    await repository.recoverStalledIntake();

    const query = new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql;
    const recoverableTypes = query.match(/event_type IN\s*\(([^)]*)\)/)?.[1];
    expect(recoverableTypes).toContain(`'${eventType}'`);
    expect(query).toContain("updated_at < NOW() - INTERVAL '5 minutes'");
  });
});
