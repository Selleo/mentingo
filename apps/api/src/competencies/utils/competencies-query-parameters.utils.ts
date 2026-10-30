import type { TObject, TProperties } from "@sinclair/typebox";

/**
 * Validates every property of a query schema as its own query parameter. nestjs-typebox binds
 * validators to handler parameters by position, so handlers declare `@Query` params in schema order.
 */
export const queryParameters = <T extends TProperties>(schema: TObject<T>) =>
  Object.entries(schema.properties).map(([name, property]) => ({
    type: "query" as const,
    name,
    schema: property,
  }));
