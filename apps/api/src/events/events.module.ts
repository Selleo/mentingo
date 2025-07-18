import { Global, Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { EmailModule } from "src/common/emails/emails.module";
import { NotifyAdminsHandler } from "src/user/handlers/notify-admins.handler";
import { UserModule } from "src/user/user.module";

@Global()
@Module({
  imports: [CqrsModule, UserModule, EmailModule],
  exports: [CqrsModule],
  providers: [NotifyAdminsHandler],
})
export class EventsModule {}
