import { Injectable } from "@nestjs/common";
import { DIRECTORY_SYNC_PROVIDERS, type DirectorySyncProvider } from "@repo/shared";
import { match } from "ts-pattern";

import { FakeDirectoryClient } from "./fake-directory/fake-directory.client";
import { GoogleWorkspaceDirectoryClient } from "./google-workspace-directory.client";

import type { DirectoryProviderClient } from "../directory-sync.types";

@Injectable()
export class DirectoryProviderClientRegistry {
  constructor(
    private readonly googleWorkspaceDirectoryClient: GoogleWorkspaceDirectoryClient,
    private readonly fakeDirectoryClient: FakeDirectoryClient,
  ) {}

  /** In development, DIRECTORY_SYNC_FAKE_DIRECTORY swaps every provider for the fake directory. */
  getClientForProvider(provider: DirectorySyncProvider): DirectoryProviderClient {
    if (FakeDirectoryClient.isEnabled()) return this.fakeDirectoryClient;

    return match(provider)
      .with(DIRECTORY_SYNC_PROVIDERS.GOOGLE_WORKSPACE, () => this.googleWorkspaceDirectoryClient)
      .exhaustive();
  }
}
