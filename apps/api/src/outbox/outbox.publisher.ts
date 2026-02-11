import { Inject, Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { outboxEvents } from "src/storage/schema";

@Injectable()
export class OutboxPublisher {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly eventBus: EventBus,
  ) {}

  async publish(event: object, dbInstance?: DatabasePg): Promise<void> {
    if (process.env.NODE_ENV === "test") {
      await this.eventBus.publish(event);
      return;
    }

    const db = dbInstance ?? this.db;

    const eventType = this.getEventType(event);
    const payload = this.sanitizeValue(event) as Record<string, unknown>;

    await db.insert(outboxEvents).values({
      eventType,
      payload,
      status: "pending",
      attemptCount: 0,
    });
  }

  private getEventType(event: object): string {
    const candidate = (event as { constructor?: { name?: string } }).constructor?.name;
    if (candidate && candidate !== "Object") return candidate;
    return "UnknownEvent";
  }

  private sanitizeValue(value: unknown): unknown {
    if (value === undefined) return null;
    if (value === null) return null;
    if (Array.isArray(value)) return value.map((item) => this.sanitizeValue(item));
    if (typeof value === "object") {
      const entries = Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        this.sanitizeValue(item),
      ]);
      return Object.fromEntries(entries);
    }
    return value;
  }
}
