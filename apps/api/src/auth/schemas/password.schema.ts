import { Type } from "@sinclair/typebox";

export const passwordSchema = Type.String({
  minLength: 8,
  maxLength: 64,
  pattern: "^(?=.*[A-Z])(?=.*[a-z])(?=.*\\d)(?=.*[!@#$%^&*()_+\\-=[\\]{};:'\",.<>?]).+$",
});
