import { registerAs } from "@nestjs/config";
import { type Static, Type } from "@sinclair/typebox";

import { configValidator } from "src/utils/configValidator";

const schema = Type.Object({
  AWS_REGION: Type.String(),
  AWS_ACCESS_KEY_ID: Type.String(),
  AWS_SECRET_ACCESS_KEY: Type.String(),
});

type AWSConfigSchema = Static<typeof schema>;

const validateAwsConfig = configValidator(schema);

export default registerAs("aws", (): AWSConfigSchema => {
  const values = {
    AWS_REGION: process.env.AWS_REGION,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_BUCKET_NAME: process.env.AWS_BUCKET_NAME,
  };

  return validateAwsConfig(values);
});
