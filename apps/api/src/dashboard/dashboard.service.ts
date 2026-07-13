import { BadRequestException, Injectable } from "@nestjs/common";
import { SYSTEM_ROLE_SLUGS } from "@repo/shared";

import { hasAllPermissions } from "src/common/permissions/permission.utils";

import { DEFAULT_LAYOUT_BY_SYSTEM_ROLE } from "./constants/dashboard-default-layouts";
import { DASHBOARD_WIDGET_DEFINITIONS } from "./constants/dashboard-widgets";
import { DashboardRepository } from "./dashboard.repository";

import type { DashboardLayoutWidget } from "./dashboard.types";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class DashboardService {
  constructor(private readonly dashboardRepository: DashboardRepository) {}

  async getLayout(currentUser: CurrentUserType): Promise<DashboardLayoutWidget[]> {
    const savedLayout = await this.dashboardRepository.findByUserId(
      currentUser.userId,
      currentUser.tenantId,
    );
    const layout = savedLayout?.widgets ?? this.getDefaultLayout(currentUser);

    return layout
      .filter((layoutWidget) => this.canUseWidget(layoutWidget, currentUser))
      .sort((first, second) => first.order - second.order);
  }

  async replaceLayout(
    currentUser: CurrentUserType,
    widgets: DashboardLayoutWidget[],
  ): Promise<DashboardLayoutWidget[]> {
    this.assertValidLayout(widgets, currentUser);

    const normalizedWidgets = [...widgets]
      .sort((first, second) => first.order - second.order)
      .map((widget, index) => ({
        ...widget,
        order: index + 1,
        settings: { ...widget.settings },
      }));

    const layout = await this.dashboardRepository.replace(
      currentUser.userId,
      currentUser.tenantId,
      normalizedWidgets,
    );

    return layout.widgets;
  }

  getDefaultLayout(currentUser: CurrentUserType): DashboardLayoutWidget[] {
    const layouts = currentUser.roleSlugs.flatMap((roleSlug) => {
      if (!this.isSystemRoleSlug(roleSlug)) return [];

      return DEFAULT_LAYOUT_BY_SYSTEM_ROLE[roleSlug];
    });

    const uniqueWidgets = new Map(
      layouts.map((layoutWidget) => [layoutWidget.widgetId, layoutWidget]),
    );

    return Array.from(uniqueWidgets.values())
      .filter((layoutWidget) => this.canUseWidget(layoutWidget, currentUser))
      .sort((first, second) => first.order - second.order)
      .map((layoutWidget, index) => ({
        ...layoutWidget,
        order: index + 1,
        settings: { ...layoutWidget.settings },
      }));
  }

  private assertValidLayout(widgets: DashboardLayoutWidget[], currentUser: CurrentUserType): void {
    const widgetIds = widgets.map(({ widgetId }) => widgetId);

    if (new Set(widgetIds).size !== widgetIds.length) {
      throw new BadRequestException("dashboardView.errors.duplicateWidgets");
    }

    if (widgets.some((widget) => !this.canUseWidget(widget, currentUser))) {
      throw new BadRequestException("dashboardView.errors.widgetNotAvailable");
    }
  }

  private canUseWidget(layoutWidget: DashboardLayoutWidget, currentUser: CurrentUserType): boolean {
    const definition = DASHBOARD_WIDGET_DEFINITIONS[layoutWidget.widgetId];

    return hasAllPermissions(currentUser.permissions, definition.requiredPermissions);
  }

  private isSystemRoleSlug(
    roleSlug: string,
  ): roleSlug is keyof typeof DEFAULT_LAYOUT_BY_SYSTEM_ROLE {
    return Object.values(SYSTEM_ROLE_SLUGS).some((systemRoleSlug) => systemRoleSlug === roleSlug);
  }
}
