import { Injectable } from "@nestjs/common";

import type { OutboxCommandHandler } from "./outbox.types";
import type { DatabasePg } from "src/common";

/** Awaited command intake alongside CQRS's synchronous event publication. */
@Injectable()
export class OutboxDirectHandlerService {
  private readonly reactions = new Map<string, OutboxCommandHandler[]>();
  private readonly handlers = new Map<string, OutboxCommandHandler>();

  register(eventType: string, handler: OutboxCommandHandler): void {
    if (this.handlers.has(eventType)) {
      throw new Error(`Duplicate outbox handler: ${eventType}`);
    }

    this.handlers.set(eventType, handler);
  }

  /** Await durable reactions without replacing the event's existing CQRS subscribers. */
  registerReaction(eventType: string, handler: OutboxCommandHandler): void {
    const handlers = this.reactions.get(eventType) ?? [];
    handlers.push(handler);
    this.reactions.set(eventType, handlers);
  }

  async dispatchReactions(
    eventType: string,
    payload: Record<string, unknown>,
    id: string,
    transaction?: DatabasePg,
  ): Promise<void> {
    for (const reaction of this.reactions.get(eventType) ?? []) {
      await reaction(payload, id, transaction);
    }
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
