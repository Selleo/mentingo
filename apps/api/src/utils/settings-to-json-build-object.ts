import { sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";

export const settingsToJsonBuildObject = (settingsObject: Record<string, any>): SQL<unknown> => {
  const convertValueWithType = (value: any): SQL<unknown> => {
    if (value === null || value === undefined) {
      return sql`NULL`;
    }

    switch (typeof value) {
      case "boolean":
        return sql`${value}::boolean`;
      case "number":
        return sql`${value}::numeric`;
      default:
        return sql`${value}::text`;
    }
  };

  const convertedSettings = Object.entries(settingsObject).flatMap(([key, value]) => [
    sql`${key}::text`,
    convertValueWithType(value),
  ]);

  return sql`json_build_object(${sql.join(convertedSettings, sql`, `)})`;
};
