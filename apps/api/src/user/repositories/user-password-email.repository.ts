import { Inject, Injectable } from "@nestjs/common";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DatabasePg, type UUIDType } from "src/common";
import { DB, DB_ADMIN } from "src/storage/db/db.providers";
import {
  createTokens,
  credentials,
  resetTokens,
  settings,
  tenants,
  users,
} from "src/storage/schema";

import type {
  FindUserPasswordEmailRecipientsByIdsOptions,
  UserCreatePasswordTokenInsert,
  UserPasswordEmailRecipient,
  UserPasswordEmailTokenInsert,
} from "src/user/user.types";

@Injectable()
export class UserPasswordEmailRepository {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
  ) {}

  async findRecipientsByIds(
    userIds: UUIDType[],
    options: FindUserPasswordEmailRecipientsByIdsOptions = {},
    dbInstance: DatabasePg = this.db,
  ): Promise<UserPasswordEmailRecipient[]> {
    if (!userIds.length) return [];

    const userSettings = alias(settings, "user_settings");
    const globalSettings = alias(settings, "global_settings");

    return dbInstance
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        tenantId: users.tenantId,
        hasCredentials: sql<boolean>`${credentials.userId} IS NOT NULL`,
        defaultEmailSettings: sql<UserPasswordEmailRecipient["defaultEmailSettings"]>`
          jsonb_build_object(
            'language',
            COALESCE(NULLIF(${userSettings.settings}->>'language', ''), ${SUPPORTED_LANGUAGES.EN}),
            'primaryColor',
            COALESCE(NULLIF(${globalSettings.settings}->>'primaryColor', ''), '#4796FD'),
            'companyName',
            COALESCE(NULLIF(${globalSettings.settings} #>> '{companyInformation,companyName}', ''), 'Mentingo.com')
          )
        `,
      })
      .from(users)
      .leftJoin(credentials, eq(credentials.userId, users.id))
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .leftJoin(
        globalSettings,
        and(isNull(globalSettings.userId), eq(globalSettings.tenantId, users.tenantId)),
      )
      .where(
        and(
          inArray(users.id, userIds),
          eq(users.archived, false),
          isNull(users.deletedAt),
          this.getCredentialsFilter(options.hasCredentials),
        ),
      );
  }

  async findRecipientByEmail(
    email: string,
    dbInstance: DatabasePg = this.db,
  ): Promise<UserPasswordEmailRecipient | null> {
    const [recipient] = await this.findRecipientsByEmails([email], dbInstance);

    return recipient ?? null;
  }

  async findRecipientsByEmails(
    emails: string[],
    dbInstance: DatabasePg = this.db,
  ): Promise<UserPasswordEmailRecipient[]> {
    if (!emails.length) return [];

    const userSettings = alias(settings, "user_settings");
    const globalSettings = alias(settings, "global_settings");

    return dbInstance
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        tenantId: users.tenantId,
        hasCredentials: sql<boolean>`${credentials.userId} IS NOT NULL`,
        defaultEmailSettings: sql<UserPasswordEmailRecipient["defaultEmailSettings"]>`
          jsonb_build_object(
            'language',
            COALESCE(NULLIF(${userSettings.settings}->>'language', ''), ${SUPPORTED_LANGUAGES.EN}),
            'primaryColor',
            COALESCE(NULLIF(${globalSettings.settings}->>'primaryColor', ''), '#4796FD'),
            'companyName',
            COALESCE(NULLIF(${globalSettings.settings} #>> '{companyInformation,companyName}', ''), 'Mentingo.com')
          )
        `,
      })
      .from(users)
      .leftJoin(credentials, eq(credentials.userId, users.id))
      .leftJoin(userSettings, eq(userSettings.userId, users.id))
      .leftJoin(
        globalSettings,
        and(isNull(globalSettings.userId), eq(globalSettings.tenantId, users.tenantId)),
      )
      .where(and(inArray(users.email, emails), eq(users.archived, false), isNull(users.deletedAt)));
  }

  private getCredentialsFilter(hasCredentials?: boolean) {
    if (hasCredentials === true) return isNotNull(credentials.userId);
    if (hasCredentials === false) return isNull(credentials.userId);

    return undefined;
  }

  async findTenantOrigin(tenantId: UUIDType) {
    const [tenant] = await this.dbAdmin
      .select({ origin: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) throw new Error("superAdminTenants.error.notFound");

    return tenant.origin;
  }

  async insertResetTokens(rows: UserPasswordEmailTokenInsert[], dbInstance: DatabasePg = this.db) {
    if (!rows.length) return;

    await dbInstance.insert(resetTokens).values(
      rows.map(({ userId, tokenHash, expiryDate }) => ({
        userId,
        tokenHash,
        expiryDate,
      })),
    );
  }

  async replaceCreateTokens(
    rows: UserCreatePasswordTokenInsert[],
    dbInstance: DatabasePg = this.db,
  ) {
    if (!rows.length) return;

    const userIds = rows.map(({ userId }) => userId);

    const replaceTokens = async (database: DatabasePg) => {
      await database.delete(createTokens).where(inArray(createTokens.userId, userIds));

      await database.insert(createTokens).values(rows);
    };

    await dbInstance.transaction(replaceTokens);
  }
}
