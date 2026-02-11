import * as events from "src/events";
import { UserFirstLoginEvent } from "src/events/user/user-first-login.event";
import { UserInviteEvent } from "src/events/user/user-invite.event";
import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";

type EventConstructor = new (...args: any[]) => object;

const legacyEvents = {
  ...events,
  UserFirstLoginEvent,
  UserInviteEvent,
  UsersLongInactivityEvent,
  UsersShortInactivityEvent,
} as Record<string, unknown>;

const eventRegistry = new Map<string, EventConstructor>();

for (const [name, value] of Object.entries(legacyEvents)) {
  if (typeof value === "function" && name.endsWith("Event")) {
    eventRegistry.set(name, value as EventConstructor);
  }
}

export function materializeLegacyEvent(
  eventType: string,
  payload: Record<string, unknown>,
): object {
  const event = eventRegistry.get(eventType);

  if (!event) throw new Error(`Unknown outbox event type: ${eventType}`);

  const args = buildConstructorArgs(payload);

  return new event(...args);
}

function buildConstructorArgs(payload: Record<string, unknown>): unknown[] {
  const keys = Object.keys(payload);
  if (keys.length === 1) {
    const [first] = keys;
    if (first) return [payload[first]];
  }

  return [payload];
}
