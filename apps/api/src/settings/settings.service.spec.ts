import {
  DASHBOARD_DEFAULT_LAYOUTS,
  DASHBOARD_SCHEMA_VERSION,
  DASHBOARD_WIDGET_CATALOG,
  DASHBOARD_WIDGET_SIZES,
  DASHBOARD_WIDGET_TYPES,
  SYSTEM_ROLE_SLUGS,
} from "@repo/shared";
import sharp from "sharp";

import { SettingsService } from "./settings.service";

import type { DashboardSettingsResponseSchema } from "./schemas/settings.schema";
import type { DashboardSettings } from "@repo/shared";

describe("SettingsService email logo", () => {
  const logoKey = "tenant/platform-logos/variants/logo.webp";

  function createService(buffer: Buffer | null) {
    const service = Object.create(SettingsService.prototype) as SettingsService;
    const getFileBuffer = jest.fn().mockResolvedValue(buffer);
    Object.defineProperties(service, {
      db: {
        value: {
          select: () => ({
            from: () => ({
              where: async () => [{ platformLogoS3Key: logoKey }],
            }),
          }),
        },
      },
      fileService: { value: { getFileBuffer } },
    });
    return { service, getFileBuffer };
  }

  it.each(["png", "webp"] as const)(
    "returns actual PNG bytes and preserves alpha for a %s logo",
    async (format) => {
      const pixels = Buffer.from([255, 0, 0, 0, 0, 255, 0, 128, 0, 0, 255, 255]);
      const buffer = await sharp(pixels, { raw: { width: 3, height: 1, channels: 4 } })
        .toFormat(format)
        .toBuffer();
      const { service, getFileBuffer } = createService(buffer);

      const result = await service.getPlatformLogoBuffer();

      expect(getFileBuffer).toHaveBeenCalledWith(logoKey);
      expect(result).not.toBeNull();
      const metadata = await sharp(result!).metadata();
      expect(metadata.format).toBe("png");
      expect(metadata.hasAlpha).toBe(true);
      const decoded = await sharp(result!).raw().toBuffer();
      expect([decoded[3], decoded[7], decoded[11]]).toEqual([0, 128, 255]);
    },
  );

  it.each([null, Buffer.from("invalid image")])(
    "omits unavailable or invalid logos",
    async (buffer) => {
      const { service } = createService(buffer);
      await expect(service.getPlatformLogoBuffer()).resolves.toBeNull();
    },
  );
});

describe("SettingsService dashboard normalization", () => {
  it.each(Object.entries(DASHBOARD_DEFAULT_LAYOUTS))(
    "keeps every %s default widget size inside its catalog contract",
    (_roleSlug, widgets) => {
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

  it("uses the Group Manager dashboard profile before the student profile", async () => {
    const service = Object.create(SettingsService.prototype) as SettingsService;
    Object.defineProperty(service, "permissionsService", {
      value: {
        getUserAccess: jest.fn().mockResolvedValue({
          roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT, SYSTEM_ROLE_SLUGS.GROUP_MANAGER],
        }),
      },
    });
    const getDefaultDashboardLayout = (
      service as unknown as {
        getDefaultDashboardLayout: (userId: string) => Promise<DashboardSettings>;
      }
    ).getDefaultDashboardLayout;

    const layout = await getDefaultDashboardLayout.call(service, "user-id");

    expect(layout.widgets).toEqual([
      {
        type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
        size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
        visible: true,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        visible: true,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.TRAINING_COMPLETION,
        size: DASHBOARD_WIDGET_SIZES.TWO_BY_TWO,
        visible: true,
      },
    ]);
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
        alwaysVisible: true,
        allowedSizes: [DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO, DASHBOARD_WIDGET_SIZES.FOUR_BY_THREE],
        defaultSize: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
      },
      {
        type: DASHBOARD_WIDGET_TYPES.DEADLINE_RISKS,
        alwaysVisible: false,
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

  it("keeps required widgets visible and restores an omitted required widget", () => {
    const service = Object.create(SettingsService.prototype) as SettingsService;
    const normalize = (
      service as unknown as {
        normalizeDashboardLayout: (
          stored: DashboardSettings | null,
          catalog: DashboardSettingsResponseSchema["catalog"],
          defaults: DashboardSettings,
        ) => DashboardSettings;
      }
    ).normalizeDashboardLayout;
    const catalog = [
      {
        type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
        alwaysVisible: true,
        allowedSizes: [DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO],
        defaultSize: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
      },
    ];
    const defaults: DashboardSettings = {
      schemaVersion: DASHBOARD_SCHEMA_VERSION,
      revision: 0,
      widgets: [
        {
          type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
          size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
          visible: true,
        },
      ],
    };

    expect(
      normalize.call(
        service,
        {
          schemaVersion: DASHBOARD_SCHEMA_VERSION,
          revision: 3,
          widgets: [
            {
              type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
              size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
              visible: false,
            },
          ],
        },
        catalog,
        defaults,
      ).widgets,
    ).toEqual([
      {
        type: DASHBOARD_WIDGET_TYPES.EVENT_CALENDAR,
        size: DASHBOARD_WIDGET_SIZES.FOUR_BY_TWO,
        visible: true,
      },
    ]);
  });
});
