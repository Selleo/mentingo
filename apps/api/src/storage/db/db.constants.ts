/**
 * Safety net for connections that become idle while a tenant transaction is
 * still open (for example, while waiting on an external HTTP request).
 */
export const TENANT_DB_IDLE_TRANSACTION_TIMEOUT_MS = 60 * 1000;

/** Shared key serializing database setup across startup and CLI processes. */
export const DATABASE_MIGRATION_LOCK = [19283746, 50607080] as const;
