import { Injectable } from "@nestjs/common";
import { AUTOMATION_RECIPIENT_TYPES } from "@repo/shared";
import { and, eq, exists, isNull, ne, sql } from "drizzle-orm";

import { dbAls } from "src/storage/db/db-als.store";
import { groupUsers, permissionUserRoles, settings, users } from "src/storage/schema";

import type { AutomationRecipientSelection } from "@repo/shared";
import type { DatabasePg } from "src/common";

@Injectable()
export class AutomationRecipientRepository {
  async listAutomationRecipients(
    selection: Exclude<
      AutomationRecipientSelection,
      { type: typeof AUTOMATION_RECIPIENT_TYPES.EVENT }
    >,
    transaction: DatabasePg,
  ) {
    if (
      ![
        AUTOMATION_RECIPIENT_TYPES.EVERYONE,
        AUTOMATION_RECIPIENT_TYPES.USER,
        AUTOMATION_RECIPIENT_TYPES.GROUP,
        AUTOMATION_RECIPIENT_TYPES.ROLE,
      ].includes(selection.type)
    ) {
      return [];
    }

    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) {
      throw new Error("Automation recipients require tenant context");
    }

    const conditions = [
      eq(users.tenantId, tenantId),
      eq(users.archived, false),
      isNull(users.deletedAt),
      ne(users.email, ""),
    ];

    if (selection.type === AUTOMATION_RECIPIENT_TYPES.USER) {
      conditions.push(eq(users.id, selection.userId));
    }

    if (selection.type === AUTOMATION_RECIPIENT_TYPES.GROUP) {
      conditions.push(
        exists(
          transaction
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
    }

    if (selection.type === AUTOMATION_RECIPIENT_TYPES.ROLE) {
      conditions.push(
        exists(
          transaction
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
    }

    return transaction
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        language: sql<string | null>`${settings.settings}->>'language'`,
      })
      .from(users)
      .leftJoin(settings, and(eq(settings.userId, users.id), eq(settings.tenantId, tenantId)))
      .where(and(...conditions))
      .orderBy(users.id);
  }
}
