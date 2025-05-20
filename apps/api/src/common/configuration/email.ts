import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  SMTP_HOST: Type.String(),
  SMTP_PORT: Type.Number(),
  SMTP_USER: Type.String(),
  SMTP_PASSWORD: Type.String(),
  EMAIL_ADAPTER: Type.Union([
    Type.Literal("mailhog"),
    Type.Literal("smtp"),
    Type.Literal("ses"),
    Type.Literal("mailgun"),
  ]),
});

export type EmailConfigSchema = Static<typeof schema>;

const validateEmailConfig = configValidator(schema);

export default registerAs("email", (): EmailConfigSchema => {
  const values = {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: parseInt(process.env.SMTP_PORT || "465", 10),
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASSWORD: process.env.SMTP_PASSWORD,
    EMAIL_ADAPTER: process.env.EMAIL_ADAPTER,
  };

  return validateEmailConfig(values);
});
