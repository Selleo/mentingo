import { Global, Module } from "@nestjs/common";

import { NotificationCollectorService } from "./services/notification-collector.service";

@Global()
@Module({ providers: [NotificationCollectorService], exports: [NotificationCollectorService] })
export class NotificationsModule {}
