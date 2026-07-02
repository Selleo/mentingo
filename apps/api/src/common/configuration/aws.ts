import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  AWS_REGION: Type.String(),
  AWS_BUCKET_NAME: Type.String(),
  // Optional — when absent the AWS SDK default provider chain is used
  // (ECS task role, EC2 instance profile, shared config, ...).
  AWS_ACCESS_KEY_ID: Type.Optional(Type.String()),
  AWS_SECRET_ACCESS_KEY: Type.Optional(Type.String()),
});

type AWSConfigSchema = Static<typeof schema>;

const validateAwsConfig = configValidator(schema);

export default registerAs("aws", (): AWSConfigSchema => {
  const values = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
    ...(process.env.AWS_ACCESS_KEY_ID && { AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID }),
    ...(process.env.AWS_SECRET_ACCESS_KEY && {
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    }),
  };

  return validateAwsConfig(values);
});
