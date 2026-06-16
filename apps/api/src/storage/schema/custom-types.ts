import { customType } from "drizzle-orm/pg-core";

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
