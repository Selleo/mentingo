import { Type, type TObject } from "@sinclair/typebox";

export function omitTenantId<T extends TObject>(schema: T) {
  return Type.Omit(schema, ["tenantId"]);
}
