import { Inject, Injectable } from "@nestjs/common";
import { AUTOMATION_RECIPIENT_TYPES } from "@repo/shared";
import { and, asc, count, eq, exists, isNull, sql, type SQL } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import {
  groups,
  groupUsers,
  permissionRoles,
  permissionUserRoles,
  settings,
  users,
} from "src/storage/schema";

import type {
  AutomationRecipientOptionsQuery,
  AutomationRecipientSelection,
  SupportedLanguages,
} from "@repo/shared";

@Injectable()
export class AutomationRecipientOptionsRepository {
  constructor(
    @Inject(DB) private readonly database: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async findAutomationRecipientOptionsPage(
    query: AutomationRecipientOptionsQuery,
    tenantId: UUIDType,
  ) {
    const { type, search, id, page = 1, perPage = 20 } = query;
    const table = this.getRecipientSelectionTable(type);
    const label = this.getLocalizedRecipientLabelSql(type, query.language);
    const conditions: SQL[] = [eq(table.tenantId, tenantId)];

    if (type === AUTOMATION_RECIPIENT_TYPES.USER) {
      conditions.push(
        eq(users.archived, false),
        isNull(users.deletedAt),
        sql`trim(${users.email}) <> ''`,
      );
    }

    if (id) {
      conditions.push(eq(table.id, id));
    }

    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;

      conditions.push(
        type === AUTOMATION_RECIPIENT_TYPES.USER
          ? sql`(${label} ILIKE ${pattern} OR ${users.email} ILIKE ${pattern})`
          : sql`${label} ILIKE ${pattern}`,
      );
    }

    const [{ totalItems }] = await this.database
      .select({ totalItems: count() })
      .from(table)
      .where(and(...conditions));

    const rows = await this.database
      .select({
        id: table.id,
        label,
        ...(type === AUTOMATION_RECIPIENT_TYPES.USER ? { description: users.email } : {}),
      })
      .from(table)
      .where(and(...conditions))
      .orderBy(asc(label), asc(table.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return { rows, pagination: { totalItems, page, perPage } };
  }

  async doesAutomationRecipientSelectionExist(
    selection: AutomationRecipientSelection,
    tenantId?: UUIDType,
  ) {
    if (
      selection.type === AUTOMATION_RECIPIENT_TYPES.EVENT ||
      selection.type === AUTOMATION_RECIPIENT_TYPES.EVERYONE
    ) {
      return true;
    }

    const table = this.getRecipientSelectionTable(selection.type);
    let id: UUIDType;

    switch (selection.type) {
      case AUTOMATION_RECIPIENT_TYPES.USER:
        id = selection.userId;
        break;
      case AUTOMATION_RECIPIENT_TYPES.GROUP:
        id = selection.groupId;
        break;
      case AUTOMATION_RECIPIENT_TYPES.ROLE:
        id = selection.roleId;
        break;
    }

    const conditions: SQL[] = [eq(table.id, id)];

    if (tenantId) {
      conditions.push(eq(table.tenantId, tenantId));
    }

    if (selection.type === AUTOMATION_RECIPIENT_TYPES.USER) {
      conditions.push(
        eq(users.archived, false),
        isNull(users.deletedAt),
        sql`trim(${users.email}) <> ''`,
      );
    }

    const [row] = await this.database
      .select({ id: table.id })
      .from(table)
      .where(and(...conditions))
      .limit(1);

    return Boolean(row);
  }

  async findAutomationSampleRecipient(selection: AutomationRecipientSelection, tenantId: UUIDType) {
    const conditions: SQL[] = [
      eq(users.tenantId, tenantId),
      eq(users.archived, false),
      isNull(users.deletedAt),
      sql`trim(${users.email}) <> ''`,
    ];

    switch (selection.type) {
      case AUTOMATION_RECIPIENT_TYPES.EVENT:
        return undefined;
      case AUTOMATION_RECIPIENT_TYPES.USER:
        conditions.push(eq(users.id, selection.userId));
        break;
      case AUTOMATION_RECIPIENT_TYPES.GROUP:
        conditions.push(
          exists(
            this.database
              .select({ id: groupUsers.id })
              .from(groupUsers)
              .where(
                and(
                  eq(groupUsers.tenantId, tenantId),
                  eq(groupUsers.userId, users.id),
                  eq(groupUsers.groupId, selection.groupId),
                ),
              ),
          ),
        );
        break;
      case AUTOMATION_RECIPIENT_TYPES.ROLE:
        conditions.push(
          exists(
            this.database
              .select({ id: permissionUserRoles.id })
              .from(permissionUserRoles)
              .where(
                and(
                  eq(permissionUserRoles.tenantId, tenantId),
                  eq(permissionUserRoles.userId, users.id),
                  eq(permissionUserRoles.roleId, selection.roleId),
                ),
              ),
          ),
        );
        break;
      case AUTOMATION_RECIPIENT_TYPES.EVERYONE:
        break;
    }

    const [recipient] = await this.database
      .select({
        email: users.email,
        name: sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`,
        language: sql<string | null>`${settings.settings}->>'language'`,
      })
      .from(users)
      .leftJoin(settings, and(eq(settings.userId, users.id), eq(settings.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(asc(users.id))
      .limit(1);

    return recipient;
  }

  private getRecipientSelectionTable(type: AutomationRecipientOptionsQuery["type"]) {
    switch (type) {
      case AUTOMATION_RECIPIENT_TYPES.USER:
        return users;
      case AUTOMATION_RECIPIENT_TYPES.GROUP:
        return groups;
      case AUTOMATION_RECIPIENT_TYPES.ROLE:
        return permissionRoles;
    }
  }

  private getLocalizedRecipientLabelSql(
    type: AutomationRecipientOptionsQuery["type"],
    language?: SupportedLanguages,
  ): SQL<string> {
    switch (type) {
      case AUTOMATION_RECIPIENT_TYPES.USER:
        return sql<string>`trim(concat(${users.firstName}, ' ', ${users.lastName}))`;
      case AUTOMATION_RECIPIENT_TYPES.GROUP:
        return this.localizationService.getLocalizedSqlField(groups.name, language, groups);
      case AUTOMATION_RECIPIENT_TYPES.ROLE:
        return sql<string>`${permissionRoles.name}`;
    }
  }
}
