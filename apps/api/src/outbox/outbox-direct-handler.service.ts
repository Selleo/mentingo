import { Injectable } from "@nestjs/common";

import type { OutboxCommandHandler } from "./outbox.types";
import type { DatabasePg } from "src/common";

/** Awaited command intake alongside CQRS's synchronous event publication. */
@Injectable()
export class OutboxDirectHandlerService {
  private readonly handlers = new Map<string, OutboxCommandHandler>();

  register(eventType: string, handler: OutboxCommandHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`Duplicate outbox handler: ${eventType}`);
    }

    this.handlers.set(eventType, handler);
  }

  has(eventType: string): boolean {
    return this.handlers.has(eventType);
  }

  async dispatch(
    eventType: string,
    payload: Record<string, unknown>,
    id: string,
    transaction?: DatabasePg,
  ): Promise<boolean> {
    const handler = this.handlers.get(eventType);
    if (!handler) {
      return false;
    }

    await handler(payload, id, transaction);
    return true;
  }
}
