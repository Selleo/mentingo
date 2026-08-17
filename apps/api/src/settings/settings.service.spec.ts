import {
  DASHBOARD_DEFAULT_LAYOUTS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";

import { SettingsService } from "./settings.service";

import type { DashboardSettings } from "@repo/shared";

describe("SettingsService dashboard normalization", () => {
  it.each(Object.entries(DASHBOARD_DEFAULT_LAYOUTS))(
    "keeps every %s default widget size inside its catalog contract",
    (_roleSlug, widgets) => {
      expect(widgets.slice(0, 2).map(({ type }) => type)).toEqual([
        DASHBOARD_WIDGET_TYPES.AI_MENTOR_PRACTICE,
        DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
      ]);

      for (const widget of widgets) {
        expect(DASHBOARD_WIDGET_CATALOG[widget.type].allowedSizes).toContain(widget.size);
        expect(widget.size.endsWith("x1")).toBe(false);
      }
    },
  );

  it("uses the admin profile for a user who also has the student role", async () => {
    const service = Object.create(SettingsService.prototype) as SettingsService;
    Object.defineProperty(service, "permissionsService", {
      value: {
        getUserAccess: jest.fn().mockResolvedValue({
          roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT, SYSTEM_ROLE_SLUGS.ADMIN],
        }),
      },
    });
    const getDefaultDashboardLayout = (
      service as unknown as {
        getDefaultDashboardLayout: (userId: string) => Promise<DashboardSettings>;
      }
    ).getDefaultDashboardLayout;

    const layout = await getDefaultDashboardLayout.call(service, "user-id");

    expect(layout.widgets).toEqual(
      DASHBOARD_DEFAULT_LAYOUTS[SYSTEM_ROLE_SLUGS.ADMIN].map((widget) => ({
        ...widget,
        visible: true,
      })),
    );
  });

  it.each([
    {
      schemaVersion: 1,
      revision: 4,
      widgets: [
        {
          type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
          size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
          visible: true,
        },
      ],
    },
    {
      widgets: [{ id: "s_event_calendar", order: 0, width: 2 }],
    },
  ])("resets an obsolete dashboard layout instead of translating it", (obsoleteLayout) => {
    const service = Object.create(SettingsService.prototype) as SettingsService;
    const readDashboardLayout = (
      service as unknown as {
        readDashboardLayout: (value: unknown) => DashboardSettings | null;
      }
    ).readDashboardLayout;

    expect(readDashboardLayout.call(service, obsoleteLayout)).toBeNull();
  });

  it("maps unsupported Calendar and Deadline Risks sizes to their current catalog defaults", () => {
    const storedLayout: DashboardSettings = {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      revision: 1,
      widgets: [
        {
          type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
          size: DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
          visible: true,
        },
        {
          type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
          size: DASHBOARD_WIDGET_SIZES.FOUR_BY_ONE,
          visible: true,
        },
      ],
    };
    const defaults: DashboardSettings = {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      revision: 0,
      widgets: [
        {
          type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
          size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
          visible: true,
        },
        {
          type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
          size: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
          visible: true,
        },
      ],
    };
    const catalog = [
      {
        type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
        allowedSizes: [DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO, DASHBOARD_WIDGET_SIZES.FOUR_BY_THREE],
        defaultSize: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        allowedSizes: [
          DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
          DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
          DASHBOARD_WIDGET_SIZES.THREE_BY_TWO,
        ],
        defaultSize: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
      },
    ];
    type DashboardCatalog = typeof catalog;

    const service = Object.create(SettingsService.prototype) as SettingsService;
    const normalize = (
      service as unknown as {
        normalizeDashboardLayout: (
          stored: DashboardSettings | null,
          catalog: DashboardCatalog,
          defaults: DashboardSettings,
        ) => DashboardSettings;
      }
    ).normalizeDashboardLayout;

    const normalized = normalize.call(service, storedLayout, catalog, defaults);

    expect(normalized.widgets).toEqual([
      {
        type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
        size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
        visible: true,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_ONE,
        visible: true,
      },
    ]);
  });
});
