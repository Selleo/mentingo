import {
  ACTIVITY_LOG_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_ACTION_TYPES,
  ACTIVITY_LOG_RESOURCE_TYPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

const translations = import.meta.glob<{
  activityLogsView: { actions: Record<string, string>; entity: Record<string, string> };
}>("../../locales/*/translation.json", { eager: true, import: "default" });

describe("Automation activity filters and labels", () => {
  const actions = ACTIVITY_LOG_RESOURCE_ACTION_TYPES[ACTIVITY_LOG_RESOURCE_TYPES.AUTOMATION];

  it("allows filtering deletions, draft saves, and simulations alongside lifecycle actions", () => {
    expect(actions).toEqual(
      expect.arrayContaining([
        ACTIVITY_LOG_ACTION_TYPES.DELETE,
        ACTIVITY_LOG_ACTION_TYPES.SAVE_AUTOMATION_DRAFT,
        ACTIVITY_LOG_ACTION_TYPES.SIMULATE_AUTOMATION,
        ACTIVITY_LOG_ACTION_TYPES.APPLY_AUTOMATION,
        ACTIVITY_LOG_ACTION_TYPES.ENABLE_AUTOMATION,
        ACTIVITY_LOG_ACTION_TYPES.DISABLE_AUTOMATION,
        ACTIVITY_LOG_ACTION_TYPES.ARCHIVE_AUTOMATION,
        ACTIVITY_LOG_ACTION_TYPES.DUPLICATE_AUTOMATION,
      ]),
    );
  });

  it.each(Object.values(SUPPORTED_LANGUAGES))(
    "translates every automation action in %s",
    (language) => {
      const { activityLogsView } = translations[`../../locales/${language}/translation.json`];
      expect(activityLogsView.entity.automation).toBeTruthy();
      for (const action of actions) {
        expect(activityLogsView.actions[action]).toBeTruthy();
        expect(activityLogsView.actions[action]).not.toBe(action);
      }
    },
  );
});
