import { customType } from "drizzle-orm/pg-core";

export const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});
