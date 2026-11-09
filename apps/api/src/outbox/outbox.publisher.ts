import { Injectable } from "@nestjs/common";
import { mapValues } from "lodash";
import { match, P } from "ts-pattern";

import { isRecord } from "src/common/utils/object.utils";

import { OutboxRepository } from "./outbox.repository";

import type { OutboxPublication } from "./outbox.types";
import type { DatabasePg } from "src/common";

@Injectable()
export class OutboxPublisher {
  constructor(private readonly outboxRepository: OutboxRepository) {}

  /**
   * Stores the event with the caller's transaction, so nothing is handled unless the change
   * commits. The dispatcher delivers it after the commit.
   */
  async publish(event: object, transaction?: DatabasePg): Promise<void> {
    await this.outboxRepository.createPending(this.buildPublication(event), transaction);
    await this.outboxRepository.notifyPending(transaction);
  }

  private getEventType(event: object): string {
    const candidate = (event as { constructor?: { name?: string } }).constructor?.name;
    if (candidate && candidate !== "Object") return candidate;
    return "UnknownEvent";
  }

  private buildPublication(event: object): OutboxPublication {
    return {
      eventType: this.getEventType(event),
      payload: mapValues(event as Record<string, unknown>, (value) =>
        this.replaceUndefinedWithNull(value),
      ),
    };
  }

  private replaceUndefinedWithNull(value: unknown): unknown {
    return match(value)
      .with(P.nullish, () => null)
      .with(P.array(), (items) => items.map((item) => this.replaceUndefinedWithNull(item)))
      .when(isRecord, (record) =>
        mapValues(record, (property) => this.replaceUndefinedWithNull(property)),
      )
      .otherwise((primitive) => primitive);
  }
}
