import { AutomationActivityEventData } from "./automation-activity-event.types";

export class AutomationActivityEvent {
  constructor(public readonly data: AutomationActivityEventData) {}
}
