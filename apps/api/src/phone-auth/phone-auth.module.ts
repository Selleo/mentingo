import { Module } from "@nestjs/common";

import { AuthModule } from "src/auth/auth.module";
import { DisallowInSupportModeGuard } from "src/common/guards/disallow-support-mode.guard";
import { SettingsModule } from "src/settings/settings.module";

import { SMS_PROVIDER } from "./phone-auth.constants";
import { PhoneAuthController, UserPhoneController } from "./phone-auth.controller";
import { PhoneAuthService } from "./phone-auth.service";
import { PhoneOtpService } from "./phone-otp.service";
import { createSmsProvider } from "./sms/sms-provider.factory";

@Module({
  imports: [AuthModule, SettingsModule],
  controllers: [PhoneAuthController, UserPhoneController],
  providers: [
    PhoneAuthService,
    PhoneOtpService,
    DisallowInSupportModeGuard,
    {
      provide: SMS_PROVIDER,
      useFactory: () => createSmsProvider(),
    },
  ],
  exports: [PhoneAuthService],
})
export class PhoneAuthModule {}
