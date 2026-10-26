export type MigrationRows = { rows: Record<string, unknown>[] };
export type MigrationClient = {
  query(text: string, values?: unknown[]): Promise<MigrationRows>;
  release(): void;
};
export type MigrationPool = {
  query(text: string, values?: unknown[]): Promise<MigrationRows>;
  connect(): Promise<MigrationClient>;
  end(): Promise<void>;
};
export type WorkflowMigrationRuntime = {
  Pool: new (config: { connectionString: string; max: number }) => MigrationPool;
  drizzle(pool: MigrationPool): unknown;
  migrate(
    db: unknown,
    config: { migrationsFolder: string; migrationsTable: string; migrationsSchema: string },
  ): Promise<void>;
  makeWorkerUtils(options: {
    pgPool: MigrationPool;
  }): Promise<{ migrate(): Promise<void>; release(): Promise<void> }>;
};
