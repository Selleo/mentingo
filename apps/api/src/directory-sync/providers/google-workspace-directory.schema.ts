import { Type } from "@sinclair/typebox";

export const googleServiceAccountKeySchema = Type.Object({
  client_email: Type.String({ minLength: 1 }),
  client_id: Type.String({ minLength: 1 }),
  private_key: Type.String({ minLength: 1 }),
});

export const googleApiErrorWithStatusSchema = Type.Object({
  response: Type.Object({ status: Type.Number() }),
});
