import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";

import { COURSE_TRANSFER_RELATIONSHIP_ERRORS } from "../course-transfer.constants";
import { CourseTransferRelationshipRepository } from "../repositories/course-transfer-relationship.repository";

import type {
  CourseTransferKind,
  CourseTransferRelationship,
  CourseTransferRelationshipPair,
} from "../course-transfer.types";
import type { MasterCourseExportSyncStatus } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class CourseTransferRelationshipService {
  constructor(
    private readonly courseTransferRelationshipRepository: CourseTransferRelationshipRepository,
  ) {}

  async getRelationship(kind: CourseTransferKind, id: UUIDType) {
    const relationship = await this.courseTransferRelationshipRepository.findById(kind, id);
    if (!relationship)
      throw new NotFoundException(COURSE_TRANSFER_RELATIONSHIP_ERRORS[kind].missing);

    return relationship;
  }

  async findOrCreateRelationship(pair: CourseTransferRelationshipPair, transaction: DatabasePg) {
    const created = await this.courseTransferRelationshipRepository.insertIfMissing(
      pair,
      transaction,
    );
    const relationship = await this.courseTransferRelationshipRepository.findByPair(
      pair,
      transaction,
    );
    if (!relationship) {
      throw new NotFoundException(COURSE_TRANSFER_RELATIONSHIP_ERRORS[pair.kind].missing);
    }

    return { relationship, created };
  }

  /** Locks an active relationship until the destination graph and its operation commit. */
  async lockActiveRelationshipForWrite(
    relationship: CourseTransferRelationship,
    transaction: DatabasePg,
  ): Promise<void> {
    const syncStatus = await this.courseTransferRelationshipRepository.findSyncStatusForUpdate(
      relationship,
      transaction,
    );
    this.assertSyncStatusIsActive(relationship.kind, syncStatus);
  }

  async markRelationshipProcessing(
    kind: CourseTransferKind,
    id: UUIDType,
    transaction: DatabasePg,
  ): Promise<void> {
    const marked = await this.courseTransferRelationshipRepository.markProcessing(
      kind,
      id,
      transaction,
    );
    if (marked) return;

    const relationship = await this.courseTransferRelationshipRepository.findById(
      kind,
      id,
      transaction,
    );
    this.assertSyncStatusIsActive(kind, relationship?.syncStatus);
  }

  assertRelationshipIsActive(relationship: CourseTransferRelationship): void {
    this.assertSyncStatusIsActive(relationship.kind, relationship.syncStatus);
  }

  private assertSyncStatusIsActive(
    kind: CourseTransferKind,
    syncStatus: MasterCourseExportSyncStatus | undefined,
  ): void {
    const errors = COURSE_TRANSFER_RELATIONSHIP_ERRORS[kind];
    if (!syncStatus) throw new NotFoundException(errors.missing);
    if (syncStatus === MASTER_COURSE_EXPORT_SYNC_STATUSES.PAUSED) {
      throw new ConflictException(errors.paused);
    }
  }
}
