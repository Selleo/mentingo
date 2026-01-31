import { AsyncLocalStorage } from "node:async_hooks";

import type { DatabasePg } from "src/common";

export type DbAlsContext = { tenantId: string; trx: DatabasePg };

export const dbAls = new AsyncLocalStorage<DbAlsContext>();
