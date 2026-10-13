import { customType } from "drizzle-orm/pg-core";

export const nativeJsonb = <Data extends object>(name: string) =>
  customType<{ data: Data; driverData: Data | string }>({
    dataType() {
      return "jsonb";
    },
    toDriver(value) {
      return value;
    },
    fromDriver(value) {
      return (typeof value === "string" ? JSON.parse(value) : value) as Data;
    },
  })(name);

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

export const int4multirange = customType<{ data: string; driverData: string }>({
  dataType() {
    return "int4multirange";
  },
});
