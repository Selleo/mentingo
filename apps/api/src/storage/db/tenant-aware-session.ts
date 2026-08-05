import { PgDatabase, PgPreparedQuery, PgSession } from "drizzle-orm/pg-core";
import { PgDialect } from "drizzle-orm/pg-core/dialect";

import { dbAls } from "./db-als.store";

import type { TenantDbRunnerService } from "./tenant-db-runner.service";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { SelectedFieldsOrdered } from "drizzle-orm/pg-core/query-builders/select.types";
import type { PgTransactionConfig, PreparedQueryConfig } from "drizzle-orm/pg-core/session";
import type { PostgresJsQueryResultHKT } from "drizzle-orm/postgres-js";
import type { ExtractTablesWithRelations, RelationalSchemaConfig } from "drizzle-orm/relations";
import type { Query } from "drizzle-orm/sql/sql";
import type { DatabasePg } from "src/common";
import type * as schema from "src/storage/schema";

type TenantRunner = Pick<TenantDbRunnerService, "transaction" | "transactionWithHandle">;
type ResultMapper<T> = (rows: unknown[][], mapColumnValue?: (value: unknown) => unknown) => T;
type TenantSchema = typeof schema;
type TenantRelations = ExtractTablesWithRelations<TenantSchema>;
type TenantSession = PgSession<PostgresJsQueryResultHKT, TenantSchema, TenantRelations>;
type TenantTransaction = PgTransaction<PostgresJsQueryResultHKT, TenantSchema, TenantRelations>;

/**
 * Executes Drizzle's lazy prepared queries inside a short tenant transaction.
 *
 * This uses Drizzle's internal PgSession boundary because Drizzle 0.31 has no
 * supported global execution middleware. Query builders remain untouched; only
 * the final prepared-query execution is made tenant-aware.
 */
class TenantAwarePreparedQuery<T extends PreparedQueryConfig> extends PgPreparedQuery<T> {
  constructor(
    private readonly baseSession: TenantSession,
    private readonly args: {
      query: Query;
      fields: SelectedFieldsOrdered | undefined;
      name: string | undefined;
      isResponseInArrayMode: boolean;
      customResultMapper?: ResultMapper<T["execute"]>;
    },
    private readonly runInTransaction: <R>(callback: () => Promise<R>) => Promise<R>,
  ) {
    super(args.query);
  }

  execute(placeholderValues: Record<string, unknown> = {}): Promise<T["execute"]> {
    return this.runInTransaction(() => this.prepareForCurrentContext().execute(placeholderValues));
  }

  all(placeholderValues: Record<string, unknown> = {}): Promise<T["all"]> {
    return this.runInTransaction(() => {
      const prepared = this.prepareForCurrentContext() as PgPreparedQuery<T> & {
        all(values?: Record<string, unknown>): Promise<T["all"]>;
      };
      return prepared.all(placeholderValues);
    });
  }

  isResponseInArrayMode(): boolean {
    return this.args.isResponseInArrayMode;
  }

  mapResult(response: unknown, isFromBatch?: boolean): unknown {
    return this.prepareForCurrentContext().mapResult(response, isFromBatch);
  }

  private prepareForCurrentContext(): PgPreparedQuery<T> {
    const transactionSession = (
      dbAls.getStore()?.trx as (DatabasePg & { session?: TenantSession }) | undefined
    )?.session;
    const session = transactionSession ?? this.baseSession;

    return session.prepareQuery<T>(
      this.args.query,
      this.args.fields,
      this.args.name,
      this.args.isResponseInArrayMode,
      this.args.customResultMapper,
    );
  }
}

class TenantAwareSession extends PgSession<
  PostgresJsQueryResultHKT,
  TenantSchema,
  TenantRelations
> {
  constructor(
    private readonly baseSession: TenantSession,
    private readonly runner: TenantRunner,
    dialect: PgDialect,
  ) {
    super(dialect);
  }

  prepareQuery<T extends PreparedQueryConfig = PreparedQueryConfig>(
    query: Query,
    fields: SelectedFieldsOrdered | undefined,
    name: string | undefined,
    isResponseInArrayMode: boolean,
    customResultMapper?: ResultMapper<T["execute"]>,
  ): PgPreparedQuery<T> {
    return new TenantAwarePreparedQuery<T>(
      this.baseSession,
      { query, fields, name, isResponseInArrayMode, customResultMapper },
      (callback) => this.runner.transaction(callback),
    );
  }

  transaction<T>(
    callback: (trx: TenantTransaction) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    return this.runner.transactionWithHandle(
      (trx) => callback(trx as unknown as TenantTransaction),
      config,
    );
  }
}

export function createTenantAwareDb(dbBase: DatabasePg, runner: TenantRunner): DatabasePg {
  const baseDb = dbBase as DatabasePg & {
    dialect: PgDialect;
    session: TenantSession;
    _: RelationalSchemaConfig<TenantRelations>;
  };
  const session = new TenantAwareSession(baseDb.session, runner, baseDb.dialect);

  return new PgDatabase(baseDb.dialect, session, baseDb._) as DatabasePg;
}
