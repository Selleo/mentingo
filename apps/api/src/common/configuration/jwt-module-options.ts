import { ConfigService } from "@nestjs/config";

import type { JwtModuleAsyncOptions } from "@nestjs/jwt";

/** JWT module setup shared by every Nest context of the API, including queue sandboxes. */
export const jwtModuleOptions: JwtModuleAsyncOptions = {
  useFactory(configService: ConfigService) {
    return {
      secret: configService.get<string>("jwt.secret")!,
      signOptions: {
        expiresIn: configService.get<string>("jwt.expirationTime"),
      },
    };
  },
  inject: [ConfigService],
  global: true,
};
