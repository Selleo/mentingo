import { OutboxPublisher } from "./outbox.publisher";

class DatedEvent {
  constructor(
    public readonly datedData: { occurredAt: Date; note?: string; tags: (string | undefined)[] },
  ) {}
}

describe("OutboxPublisher", () => {
  it("stores dates as ISO strings and missing values as null", async () => {
    const outboxRepository = { createPending: jest.fn(), notifyPending: jest.fn() };
    const outboxPublisher = new OutboxPublisher(outboxRepository as never);
    const occurredAt = new Date("2026-11-12T10:00:00.000Z");

    await outboxPublisher.publish(
      new DatedEvent({ occurredAt, note: undefined, tags: ["first", undefined] }),
    );

    expect(outboxRepository.createPending).toHaveBeenCalledWith(
      {
        eventType: DatedEvent.name,
        payload: {
          datedData: { occurredAt: occurredAt.toISOString(), note: null, tags: ["first", null] },
        },
      },
      undefined,
    );
  });
});
