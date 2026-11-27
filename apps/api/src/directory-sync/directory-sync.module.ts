import { Module } from "@nestjs/common";

import { GroupModule } from "src/group/group.module";
import { LocalizationModule } from "src/localization/localization.module";
import { PermissionsModule } from "src/permissions/permissions.module";
import { UserModule } from "src/user/user.module";

import { DirectorySyncUserController } from "./directory-sync-user.controller";
import { DirectorySyncController } from "./directory-sync.controller";
import { DirectoryProviderClientRegistry } from "./providers/directory-provider-client.registry";
import { FakeDirectoryClient } from "./providers/fake-directory/fake-directory.client";
import { GoogleWorkspaceDirectoryClient } from "./providers/google-workspace-directory.client";
import { DirectoryAccountRepository } from "./repositories/directory-account.repository";
import { DirectorySyncConnectionRepository } from "./repositories/directory-sync-connection.repository";
import { DirectorySyncGroupMappingRepository } from "./repositories/directory-sync-group-mapping.repository";
import { DirectorySyncRoleMappingRepository } from "./repositories/directory-sync-role-mapping.repository";
import { DirectorySyncRunRepository } from "./repositories/directory-sync-run.repository";
import { UserExternalIdentityRepository } from "./repositories/user-external-identity.repository";
import { DirectoryAccountProvisioningService } from "./services/directory-account-provisioning.service";
import { DirectorySyncConnectionService } from "./services/directory-sync-connection.service";
import { DirectorySyncQueueService } from "./services/directory-sync-queue.service";
import { DirectorySyncRunService } from "./services/directory-sync-run.service";
import { DirectorySyncService } from "./services/directory-sync.service";
import { DirectorySyncCron } from "./workers/directory-sync.cron";
import { DirectorySyncWorker } from "./workers/directory-sync.worker";

@Module({
  imports: [UserModule, GroupModule, LocalizationModule, PermissionsModule],
  controllers: [DirectorySyncController, DirectorySyncUserController],
  providers: [
    DirectorySyncConnectionRepository,
    DirectorySyncRoleMappingRepository,
    DirectorySyncGroupMappingRepository,
    DirectorySyncRunRepository,
    UserExternalIdentityRepository,
    DirectoryAccountRepository,
    GoogleWorkspaceDirectoryClient,
    FakeDirectoryClient,
    DirectoryProviderClientRegistry,
    DirectoryAccountProvisioningService,
    DirectorySyncQueueService,
    DirectorySyncRunService,
    DirectorySyncConnectionService,
    DirectorySyncService,
    DirectorySyncWorker,
    DirectorySyncCron,
  ],
  exports: [UserExternalIdentityRepository],
})
export class DirectorySyncModule {}
