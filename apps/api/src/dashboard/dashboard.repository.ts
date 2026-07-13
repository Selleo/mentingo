import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, sql } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { dashboardLayouts, dashboardLayoutWidgets } from "src/storage/schema";

import type { DashboardLayout, DashboardLayoutWidget } from "./dashboard.types";
import type { UUIDType } from "src/common";

@Injectable()
export class DashboardRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async findByUserId(userId: UUIDType, tenantId: UUIDType): Promise<DashboardLayout | null> {
    const [layout] = await this.db
      .select({
        id: dashboardLayouts.id,
        version: dashboardLayouts.version,
      })
      .from(dashboardLayouts)
      .where(and(eq(dashboardLayouts.userId, userId), eq(dashboardLayouts.tenantId, tenantId)))
      .limit(1);

    if (!layout) return null;

    const widgets = await this.db
      .select({
        widgetId: dashboardLayoutWidgets.widgetId,
        order: dashboardLayoutWidgets.order,
        enabled: dashboardLayoutWidgets.enabled,
        size: dashboardLayoutWidgets.size,
        settings: dashboardLayoutWidgets.settings,
      })
      .from(dashboardLayoutWidgets)
      .where(
        and(
          eq(dashboardLayoutWidgets.dashboardLayoutId, layout.id),
          eq(dashboardLayoutWidgets.tenantId, tenantId),
        ),
      )
      .orderBy(asc(dashboardLayoutWidgets.order));

    return {
      ...layout,
      widgets,
    };
  }

  async replace(
    userId: UUIDType,
    tenantId: UUIDType,
    widgets: DashboardLayoutWidget[],
    version = 1,
  ): Promise<DashboardLayout> {
    return this.db.transaction(async (trx) => {
      const [layout] = await trx
        .insert(dashboardLayouts)
        .values({ userId, tenantId, version })
        .onConflictDoUpdate({
          target: [dashboardLayouts.tenantId, dashboardLayouts.userId],
          set: {
            version,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          },
        })
        .returning({
          id: dashboardLayouts.id,
          version: dashboardLayouts.version,
        });

      await trx
        .delete(dashboardLayoutWidgets)
        .where(eq(dashboardLayoutWidgets.dashboardLayoutId, layout.id));

      if (widgets.length) {
        await trx.insert(dashboardLayoutWidgets).values(
          widgets.map((widget) => ({
            tenantId,
            dashboardLayoutId: layout.id,
            widgetId: widget.widgetId,
            order: widget.order,
            enabled: widget.enabled,
            size: widget.size,
            settings: widget.settings,
          })),
        );
      }

      return {
        ...layout,
        widgets: widgets.map((widget) => ({
          ...widget,
          settings: { ...widget.settings },
        })),
      };
    });
  }
}
