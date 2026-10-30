import { AUTOMATION_EVENT_CATALOG } from "./automation-event-catalog";

describe("Group assignment trigger", () => {
  it("exposes group identity and personalized learner variables independently of templates", () => {
    const event = AUTOMATION_EVENT_CATALOG.find(
      (item) => String(item.kind) === "user_assigned_to_group",
    );
    expect(event).toBeDefined();
    expect(event!.providedVariables.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        "group_id",
        "group_name",
        "user_first_name",
        "user_last_name",
        "user_email",
      ]),
    );
  });
});
