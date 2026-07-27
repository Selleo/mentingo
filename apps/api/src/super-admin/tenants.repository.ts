import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";

import { DatabasePg } from "src/common";
import { getSortOptions } from "src/common/helpers/getSortOptions";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { activityLogs, tenants, users } from "src/storage/schema";

import type {
  CountAllTenantsParams,
  CreateTenantRecord,
  FindAllTenantsParams,
  Tenant,
  TenantsListItemResponse,
  UpdateTenantRecord,
} from "./types";
import type { SQL, SQLWrapper } from "drizzle-orm";

const TENANT_ACTIVITY_PREVIEW_LIMIT = 5;

@Injectable()
export class TenantsRepository {
  constructor(@Inject(DB_ADMIN) private readonly dbBase: DatabasePg) {}

  async findAll({
    page,
    perPage,
    search,
    status,
    sort,
    currentTenantId,
  }: FindAllTenantsParams): Promise<TenantsListItemResponse[]> {
    const whereClause = this.buildWhereClause(search, status);

    const lastActivity = this.dbBase
      .selectDistinctOn([activityLogs.tenantId], {
        tenantId: activityLogs.tenantId,
        occurredAt: activityLogs.createdAt,
        actorEmail: activityLogs.actorEmail,
      })
      .from(activityLogs)
      .orderBy(activityLogs.tenantId, desc(activityLogs.createdAt), desc(activityLogs.id))
      .as("last_activity");

    const activitySummary = this.dbBase
      .select({
        tenantId: activityLogs.tenantId,
        currentCount:
          sql<number>`count(*) filter (where ${activityLogs.createdAt} >= now() - interval '14 days')::integer`.as(
            "activity_count_last_14_days",
          ),
        previousCount:
          sql<number>`count(*) filter (where ${activityLogs.createdAt} < now() - interval '14 days')::integer`.as(
            "activity_count_previous_14_days",
          ),
      })
      .from(activityLogs)
      .where(gte(activityLogs.createdAt, sql`now() - interval '28 days'`))
      .groupBy(activityLogs.tenantId)
      .as("activity_summary");

    const activeUserSummary = this.dbBase
      .select({
        tenantId: activityLogs.tenantId,
        count: sql<number>`count(distinct ${activityLogs.actorId})::integer`.as(
          "active_users_last_14_days",
        ),
      })
      .from(activityLogs)
      .innerJoin(
        users,
        and(
          eq(users.id, activityLogs.actorId),
          eq(users.tenantId, activityLogs.tenantId),
          eq(users.archived, false),
          isNull(users.deletedAt),
        ),
      )
      .where(gte(activityLogs.createdAt, sql`now() - interval '14 days'`))
      .groupBy(activityLogs.tenantId)
      .as("active_user_summary");

    const totalUserSummary = this.dbBase
      .select({
        tenantId: users.tenantId,
        count: sql<number>`count(*)::integer`.as("total_users"),
      })
      .from(users)
      .where(and(eq(users.archived, false), isNull(users.deletedAt)))
      .groupBy(users.tenantId)
      .as("total_user_summary");

    const activityCountLast14Days = sql<number>`coalesce(${activitySummary.currentCount}, 0)`;
    const activityCountPrevious14Days = sql<number>`coalesce(${activitySummary.previousCount}, 0)`;

    const query = this.dbBase
      .select({
        ...getTableColumns(tenants),
        isCurrentTenant: sql<boolean>`${tenants.id} = ${currentTenantId}`,
        lastActivityOccurredAt: lastActivity.occurredAt,
        lastActivityActorEmail: lastActivity.actorEmail,
        activityCountLast14Days,
        activityCountPrevious14Days,
        activeUsersLast14Days: sql<number>`coalesce(${activeUserSummary.count}, 0)`,
        totalUsers: sql<number>`coalesce(${totalUserSummary.count}, 0)`,
      })
      .from(tenants)
      .leftJoin(lastActivity, eq(lastActivity.tenantId, tenants.id))
      .leftJoin(activitySummary, eq(activitySummary.tenantId, tenants.id))
      .leftJoin(activeUserSummary, eq(activeUserSummary.tenantId, tenants.id))
      .leftJoin(totalUserSummary, eq(totalUserSummary.tenantId, tenants.id))
      .orderBy(...this.buildOrderBy(sort, lastActivity.occurredAt, activityCountLast14Days))
      .limit(perPage)
      .offset((page - 1) * perPage);

    if (whereClause) query.where(whereClause);

    const rows = await query;
    const recentActivitiesByTenant = await this.findRecentActivitiesByTenant(
      rows.map((tenant) => tenant.id),
    );

    return rows.map(
      ({
        lastActivityOccurredAt,
        lastActivityActorEmail,
        activityCountPrevious14Days,
        ...tenant
      }) => {
        const hasLastActivity = lastActivityOccurredAt !== null && lastActivityActorEmail !== null;

        return {
          ...tenant,
          recentActivities: recentActivitiesByTenant.get(tenant.id) ?? [],
          activityTrendPercentage: this.calculateActivityTrend(
            tenant.activityCountLast14Days,
            activityCountPrevious14Days,
          ),
          lastActivity: hasLastActivity
            ? {
                occurredAt: lastActivityOccurredAt,
                actorEmail: lastActivityActorEmail,
              }
            : null,
        };
      },
    );
  }

  async countAll({ search, status }: CountAllTenantsParams): Promise<number> {
    const whereClause = this.buildWhereClause(search, status);
    const query = this.dbBase.select({ totalItems: count() }).from(tenants);

    if (whereClause) query.where(whereClause);

    const [{ totalItems }] = await query;

    return totalItems;
  }

  async findById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.dbBase.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    return tenant ?? null;
  }

  async findIdByHost(host: string): Promise<{ id: string } | null> {
    const [tenant] = await this.dbBase
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.host, host))
      .limit(1);

    return tenant ?? null;
  }

  async create(input: CreateTenantRecord): Promise<Tenant> {
    const [tenant] = await this.dbBase
      .insert(tenants)
      .values({
        name: input.name,
        host: input.host,
        status: input.status,
      })
      .returning();
    return tenant;
  }

  async update(id: string, updates: UpdateTenantRecord): Promise<Tenant | null> {
    const [tenant] = await this.dbBase
      .update(tenants)
      .set(updates)
      .where(eq(tenants.id, id))
      .returning();

    return tenant ?? null;
  }

  async deleteById(id: string): Promise<Tenant | null> {
    const [tenant] = await this.dbBase.delete(tenants).where(eq(tenants.id, id)).returning();

    return tenant ?? null;
  }

  private buildSearchClause(search?: string) {
    if (!search) return undefined;
    const query = `%${search.toLowerCase()}%`;

    return or(ilike(tenants.name, query), ilike(tenants.host, query));
  }

  private buildWhereClause(search?: string, status?: FindAllTenantsParams["status"]) {
    return and(this.buildSearchClause(search), status ? eq(tenants.status, status) : undefined);
  }

  private buildOrderBy(
    sort: FindAllTenantsParams["sort"],
    lastActivityOccurredAt: SQLWrapper,
    activityCountLast14Days: SQL<number>,
  ) {
    const { sortedField, sortOrder } = getSortOptions(sort);

    if (sortedField === "lastActivity") {
      return [
        sql`${sortOrder(lastActivityOccurredAt)} nulls last`,
        asc(tenants.createdAt),
        asc(tenants.id),
      ];
    }

    if (sortedField === "activityCountLast14Days") {
      return [sortOrder(activityCountLast14Days), asc(tenants.createdAt), asc(tenants.id)];
    }

    return [asc(tenants.createdAt), asc(tenants.id)];
  }

  private calculateActivityTrend(currentCount: number, previousCount: number): number | null {
    if (currentCount === 0 && previousCount === 0) return null;
    if (previousCount === 0) return 100;

    return Math.round(((currentCount - previousCount) / previousCount) * 100);
  }

  private async findRecentActivitiesByTenant(
    tenantIds: string[],
  ): Promise<Map<string, TenantsListItemResponse["recentActivities"]>> {
    const activitiesByTenant = new Map<string, TenantsListItemResponse["recentActivities"]>();

    if (tenantIds.length === 0) return activitiesByTenant;

    const rankedActivities = this.dbBase
      .select({
        id: activityLogs.id,
        tenantId: activityLogs.tenantId,
        occurredAt: activityLogs.createdAt,
        actorEmail: activityLogs.actorEmail,
        actionType: activityLogs.actionType,
        rowNumber:
          sql<number>`row_number() over (partition by ${activityLogs.tenantId} order by ${activityLogs.createdAt} desc, ${activityLogs.id} desc)`.as(
            "row_number",
          ),
      })
      .from(activityLogs)
      .where(inArray(activityLogs.tenantId, tenantIds))
      .as("ranked_tenant_activities");

    const recentActivities = await this.dbBase
      .select({
        id: rankedActivities.id,
        tenantId: rankedActivities.tenantId,
        occurredAt: rankedActivities.occurredAt,
        actorEmail: rankedActivities.actorEmail,
        actionType: rankedActivities.actionType,
      })
      .from(rankedActivities)
      .where(lte(rankedActivities.rowNumber, TENANT_ACTIVITY_PREVIEW_LIMIT))
      .orderBy(asc(rankedActivities.tenantId), asc(rankedActivities.rowNumber));

    for (const { tenantId, ...activity } of recentActivities) {
      const tenantActivities = activitiesByTenant.get(tenantId) ?? [];
      tenantActivities.push(activity);
      activitiesByTenant.set(tenantId, tenantActivities);
    }

    return activitiesByTenant;
  }
}
