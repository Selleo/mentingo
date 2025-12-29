import { TypeCompiler } from "@sinclair/typebox/compiler";
import { Value } from "@sinclair/typebox/value";
import { sql } from "drizzle-orm";
import { customType, type PgColumn } from "drizzle-orm/pg-core";
import { cloneDeep } from "lodash";
import { match, P } from "ts-pattern";

import type { Static, TObject } from "@sinclair/typebox";

export const safeJsonb = <Schema extends TObject>(name: string, schema: Schema) => {
  type DataType = Static<Schema>;
  const compiledSchema = TypeCompiler.Compile(schema);
  const defaultValue = Value.Create(schema) as DataType;

  const columnType = customType<{ data: DataType }>({
    dataType() {
      return "jsonb";
    },
    toDriver(value) {
      try {
        return compiledSchema.Encode(Value.Clean(schema, Value.Default(schema, value)));
      } catch {
        return cloneDeep(defaultValue);
      }
    },
    fromDriver(value) {
      try {
        const theValue = typeof value === "string" ? JSON.parse(value) : value;
        return compiledSchema.Decode(
          Value.Clean(schema, Value.Default(schema, theValue)),
        ) as DataType;
      } catch {
        return cloneDeep(defaultValue);
      }
    },
  })(name).$type<DataType>();

  const column = columnType.default(defaultValue);
  return {
    column,
    getHelpers: (buildedColumn: PgColumn) => ({
      select: <K extends keyof DataType>(key: K) => {
        type ReturnType = DataType[K];
        const fieldType = schema.properties[key as string]?.type;

        const typeSuffix = match(fieldType)
          .with("boolean", () => "::boolean")
          .with("number", () => "::numeric")
          .with("string", () => "::text")
          .otherwise(() => "");

        if (typeSuffix === "") {
          throw new Error(`Unsupported field type: ${fieldType} for key: ${String(key)}`);
        }

        const defaultFieldValue = match(defaultValue[key])
          .with(P.nullish, () => null)
          .otherwise(() => defaultValue[key]);

        return sql<ReturnType>`COALESCE((${buildedColumn}->>'${sql.raw(String(key))}')${sql.raw(
          typeSuffix,
        )}, ${defaultFieldValue})`;
      },
    }),
  };
};
