import { Type } from "@sinclair/typebox";

export const passwordSchema = Type.Intersect([
  Type.String({
    minLength: 8,
    errorMessage: "Password must be at least 8 characters long",
  }),
  Type.String({
    maxLength: 64,
    errorMessage: "Password cannot be longer than 64 characters",
  }),
  Type.String({
    pattern: "(?=.*[A-Z])",
    errorMessage: "Password must contain at least one uppercase letter",
  }),
  Type.String({
    pattern: "(?=.*[a-z])",
    errorMessage: "Password must contain at least one lowercase letter",
  }),
  Type.String({
    pattern: "(?=.*\\d)",
    errorMessage: "Password must contain at least one digit",
  }),
  Type.String({
    pattern: "(?=.*[!@#$%^&*()_+\\-=[\\]{};:'\",.<>?])",
    errorMessage: "Password must contain at least one special character",
  }),
]);
