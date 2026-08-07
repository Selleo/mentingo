import { DASHBOARD_WIDGET_IDS, DASHBOARD_WIDGET_WIDTHS } from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { studentSettingsJSONContentSchema } from "./settings.schema";

const createSettings = (widget: { id: string; width: number }) => ({
  language: "en",
  isMFAEnabled: false,
  MFASecret: null,
  dashboard: {
    widgets: [
      {
        ...widget,
        order: 0,
      },
    ],
  },
});

describe("studentSettingsJSONContentSchema dashboard validation", () => {
  it("accepts a valid dashboard widget item", () => {
    expect(
      Value.Check(
        studentSettingsJSONContentSchema,
        createSettings({
          id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING,
          width: DASHBOARD_WIDGET_WIDTHS.MEDIUM,
        }),
      ),
    ).toBe(true);
  });

  it("rejects an unknown widget ID", () => {
    expect(
      Value.Check(
        studentSettingsJSONContentSchema,
        createSettings({ id: "unknown_widget", width: 1 }),
      ),
    ).toBe(false);
  });

  it("rejects a width outside the dashboard width enum", () => {
    expect(
      Value.Check(
        studentSettingsJSONContentSchema,
        createSettings({ id: DASHBOARD_WIDGET_IDS.STUDENT_CONTINUE_LEARNING, width: 3 }),
      ),
    ).toBe(false);
  });
});
