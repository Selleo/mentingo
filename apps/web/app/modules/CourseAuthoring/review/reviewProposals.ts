import { AUTHORING_OPERATION_TYPE } from "./curriculumReview.constants";

import type { ReviewProposal } from "./curriculumReview.types";
import type { ProposalView } from "../courseAuthoring.types";

const COURSE_LEVEL_TYPES = new Set<string>([
  AUTHORING_OPERATION_TYPE.COURSE_METADATA_UPDATE,
  AUTHORING_OPERATION_TYPE.COURSE_SETTINGS_UPDATE,
]);

export const toReviewProposals = (proposals: ProposalView[]): ReviewProposal[] => {
  const ownerByOperationId = new Map(
    proposals.flatMap((proposal) =>
      proposal.operations.map((operation) => [operation.operationId, proposal.id] as const),
    ),
  );
  return proposals.map((proposal) => ({
    id: proposal.id,
    summary: proposal.summary,
    rationale: proposal.rationale,
    warnings: proposal.warnings,
    blockedQuality: proposal.blockedQuality,
    decision: proposal.decision,
    operationIds: proposal.operations.map((operation) => operation.operationId),
    dependsOnProposalIds: [
      ...new Set(
        proposal.operations.flatMap((operation) =>
          operation.dependencies.flatMap((dependency) => {
            if (proposal.operations.some((operation) => operation.operationId === dependency))
              return [];
            const owner = ownerByOperationId.get(dependency);
            return owner && owner !== proposal.id ? [owner] : [];
          }),
        ),
      ),
    ],
    courseLevel:
      proposal.operations.length > 0 &&
      proposal.operations.every((operation) => COURSE_LEVEL_TYPES.has(operation.type)),
  }));
};
