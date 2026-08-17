import {
  DASHBOARD_WIDGET_IDS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  DASHBOARD_WIDGET_WIDTHS,
} from "@repo/shared";
import { Value } from "@sinclair/typebox/value";

import { dashboardSettingsSchema, studentSettingsJSONContentSchema } from "./settings.schema";

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

describe("semantic dashboard settings validation", () => {
  it("accepts a canonical layout with a revision", () => {
    expect(
      Value.Check(dashboardSettingsSchema, {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        revision: 4,
        widgets: [
          {
            type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
            size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
            visible: true,
          },
        ],
      }),
    ).toBe(true);
  });

  it("rejects legacy IDs and numeric widths in the semantic layout", () => {
    expect(
      Value.Check(dashboardSettingsSchema, {
        schemaVersion: DASHBOARD_SCHEMA_VERSION,
        revision: 0,
        widgets: [{ type: DASHBOARD_WIDGET_IDS.STUDENT_EVENT_CALENDAR, size: 2, visible: true }],
      }),
    ).toBe(false);
  });

  it("rejects the obsolete staging schema version", () => {
    expect(
      Value.Check(dashboardSettingsSchema, {
        schemaVersion: 1,
        revision: 4,
        widgets: [],
      }),
    ).toBe(false);
  });
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
