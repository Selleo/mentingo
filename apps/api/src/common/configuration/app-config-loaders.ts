import bunnyConfig from "./bunny";
import callbackUrlConfig from "./callbackUrl";
import database from "./database";
import emailConfig from "./email";
import jwtConfig from "./jwt";
import livekitConfig from "./livekit";
import { getOptionalConfigs } from "./optional-config-loader";
import phishingConfig from "./phishing";
import redisConfig from "./redis";
import s3Config from "./s3";
import stripeConfig from "./stripe";

/** Configuration namespaces loaded by every Nest context of the API, including queue sandboxes. */
export function getAppConfigLoaders() {
  return [
    database,
    jwtConfig,
    emailConfig,
    s3Config,
    stripeConfig,
    phishingConfig,
    redisConfig,
    callbackUrlConfig,
    bunnyConfig,
    livekitConfig,
    ...getOptionalConfigs(),
  ];
}
