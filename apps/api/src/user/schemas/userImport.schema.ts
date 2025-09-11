import { type Static, Type } from "@sinclair/typebox";

import { USER_ROLES } from "./userRoles";

// Schema for individual user row in CSV/XLSX
export const importUserRowSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 64 }),
  surname: Type.String({ minLength: 1, maxLength: 64 }),
  email: Type.String({ format: "email" }),
  role: Type.Enum(USER_ROLES),
});

// Schema for import request validation
export const userImportRequestSchema = Type.Object({
  // Additional metadata can be added here if needed
  validateOnly: Type.Optional(Type.Boolean()),
});

// Schema for import response
export const userImportResponseSchema = Type.Object({
  message: Type.String(),
  successCount: Type.Number(),
  totalRows: Type.Number(),
  createdUsers: Type.Array(Type.Object({
    id: Type.String(),
    email: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    role: Type.Enum(USER_ROLES),
  })),
});

// Schema for import validation error response
export const userImportErrorResponseSchema = Type.Object({
  message: Type.String(),
  errors: Type.Array(Type.Object({
    row: Type.Number(),
    field: Type.String(),
    value: Type.Union([Type.String(), Type.Null()]),
    message: Type.String(),
  })),
  totalRows: Type.Number(),
});

export type ImportUserRow = Static<typeof importUserRowSchema>;
export type UserImportRequest = Static<typeof userImportRequestSchema>;
export type UserImportResponse = Static<typeof userImportResponseSchema>;
export type UserImportErrorResponse = Static<typeof userImportErrorResponseSchema>;

// Validation error type for internal use
export interface ValidationError {
  row: number;
  field: string;
  value: string | null;
  message: string;
}