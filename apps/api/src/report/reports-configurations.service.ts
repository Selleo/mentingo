import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  REPORT_CONFIGURATION_VISIBILITY,
  type ReportConfigurationVisibility,
} from "./constants/reports.constants";
import { REPORT_ERRORS } from "./constants/reports.errors";
import { getReportsAccess } from "./reports-access";
import { ReportsQueryService } from "./reports-query.service";
import { ReportsConfigurationsRepository } from "./repositories/reports-configurations.repository";

import type { ReportConfigurationView } from "./reports-configurations.types";
import type { ReportConfigurationRecord } from "./repositories/reports-configurations.repository";
import type {
  CreateReportConfiguration,
  UpdateReportConfiguration,
} from "./schemas/reports-configurations.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

@Injectable()
export class ReportsConfigurationsService {
  constructor(
    private readonly reportsConfigurationsRepository: ReportsConfigurationsRepository,
    private readonly reportsQueryService: ReportsQueryService,
  ) {}

  async listConfigurations(actor: CurrentUserType): Promise<ReportConfigurationView[]> {
    return this.reportsConfigurationsRepository.findVisibleWithAvailability(
      actor.tenantId,
      actor.userId,
      getReportsAccess(actor),
    );
  }

  async createConfiguration(input: CreateReportConfiguration, actor: CurrentUserType) {
    this.assertVisibilityAllowed(input.visibility, actor);
    this.assertNamePresent(input.name);
    await this.reportsQueryService.validateReportAccess(input.query, actor);

    const configuration = await this.reportsConfigurationsRepository.create(
      actor.tenantId,
      actor.userId,
      input,
    );
    return this.toAvailableResponse(configuration);
  }

  async updateConfiguration(id: string, input: UpdateReportConfiguration, actor: CurrentUserType) {
    const current = await this.findEditableConfiguration(id, actor);
    const nextVisibility = input.visibility ?? current.visibility;

    this.assertVisibilityAllowed(nextVisibility, actor);
    this.assertUpdateName(input.name);

    await this.validateUpdatedQuery(input.query, actor);

    const updatedConfiguration = await this.reportsConfigurationsRepository.update(
      actor.tenantId,
      id,
      input,
    );
    if (!updatedConfiguration) throw this.configurationNotFound();
    return this.toAvailableResponse(updatedConfiguration);
  }

  async deleteConfiguration(id: string, actor: CurrentUserType): Promise<void> {
    await this.findEditableConfiguration(id, actor);
    await this.reportsConfigurationsRepository.delete(actor.tenantId, id);
  }

  async getConfiguration(id: string, actor: CurrentUserType): Promise<ReportConfigurationView> {
    const configuration = await this.findVisibleConfiguration(id, actor);
    await this.reportsQueryService.validateReportAccess(configuration.query, actor);
    return this.toAvailableResponse(configuration);
  }

  private async validateUpdatedQuery(
    query: UpdateReportConfiguration["query"],
    actor: CurrentUserType,
  ) {
    if (query === undefined) return;
    await this.reportsQueryService.validateReportAccess(query, actor);
  }

  private assertUpdateName(name: string | undefined): void {
    if (name !== undefined) this.assertNamePresent(name);
  }

  private assertNamePresent(name: string): void {
    if (!name.trim()) throw new BadRequestException(REPORT_ERRORS.CONFIGURATION_NAME_REQUIRED);
  }

  private assertVisibilityAllowed(
    visibility: ReportConfigurationVisibility,
    actor: CurrentUserType,
  ): void {
    if (
      visibility === REPORT_CONFIGURATION_VISIBILITY.SHARED &&
      !getReportsAccess(actor).canManageShared
    ) {
      throw new ForbiddenException(REPORT_ERRORS.CONFIGURATION_SHARED_MANAGEMENT_FORBIDDEN);
    }
  }

  private async findEditableConfiguration(
    id: string,
    actor: CurrentUserType,
  ): Promise<ReportConfigurationRecord> {
    const configuration = await this.findVisibleConfiguration(id, actor);
    if (
      configuration.visibility === REPORT_CONFIGURATION_VISIBILITY.SHARED &&
      !getReportsAccess(actor).canManageShared
    ) {
      throw new ForbiddenException(REPORT_ERRORS.CONFIGURATION_SHARED_MANAGEMENT_FORBIDDEN);
    }
    return configuration;
  }

  private async findVisibleConfiguration(
    id: string,
    actor: CurrentUserType,
  ): Promise<ReportConfigurationRecord> {
    const configuration = await this.reportsConfigurationsRepository.findById(actor.tenantId, id);
    if (!configuration) throw this.configurationNotFound();

    const isPersonalAndNotOwned =
      configuration.visibility === REPORT_CONFIGURATION_VISIBILITY.PERSONAL &&
      configuration.ownerId !== actor.userId;
    if (isPersonalAndNotOwned) throw this.configurationNotFound();

    return configuration;
  }

  private configurationNotFound(): NotFoundException {
    return new NotFoundException(REPORT_ERRORS.CONFIGURATION_NOT_FOUND);
  }

  private toAvailableResponse(configuration: ReportConfigurationRecord): ReportConfigurationView {
    return { ...configuration, isAvailable: true, failureCode: null };
  }
}
