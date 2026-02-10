import { dbAls } from "./db-als.store";

import type { DatabasePg } from "src/common";

export const DB_ADMIN = "DB_ADMIN";
export const DB_APP = "DB_APP";
export const DB = "DB";

export function createDbProxy(dbBase: DatabasePg): DatabasePg {
  return new Proxy({} as DatabasePg, {
    get(_target, prop) {
      const store = dbAls.getStore();
      const active = store?.trx ?? dbBase;

      // @ts-expect-error Proxy forwards dynamic members
      const value = active[prop];
      if (typeof value === "function") return value.bind(active);
      return value;
    },
  });
}
