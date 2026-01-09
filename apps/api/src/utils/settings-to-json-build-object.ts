import { sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";

export const settingsToJSONBuildObject = (settingsObject: Record<string, any>): SQL<unknown> => {
  const convertValueWithType = (value: any): SQL<unknown> => {
    if (value === null || value === undefined) {
      return sql`NULL`;
    }

    switch (typeof value) {
      case "boolean":
        return sql`${value}::boolean`;

      case "number":
        return sql`${value}::numeric`;

      case "object":
        if (Array.isArray(value)) {
          return sql`jsonb_build_array(${sql.join(
            value.map((v) => convertValueWithType(v)),
            sql`, `,
          )})`;
        } else {
          return settingsToJSONBuildObject(value);
        }

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
