import { PROPOSAL_DECISION, REVIEW_DECISION } from "./curriculumReview.constants";

import type { ReviewDecision, ReviewProposal } from "./curriculumReview.types";

type StagedVerdict = typeof REVIEW_DECISION.ACCEPTED | typeof REVIEW_DECISION.REJECTED;

export type StagedDecisions = Record<string, StagedVerdict>;

export const initialDecisions = (proposals: ReviewProposal[]): StagedDecisions =>
  Object.fromEntries(
    proposals.flatMap<[string, StagedVerdict]>((proposal) => {
      if (
        proposal.decision === PROPOSAL_DECISION.ACCEPTED ||
        proposal.decision === PROPOSAL_DECISION.APPLIED
      )
        return [[proposal.id, REVIEW_DECISION.ACCEPTED]];
      if (
        proposal.decision === PROPOSAL_DECISION.REJECTED ||
        proposal.decision === PROPOSAL_DECISION.SUPERSEDED
      )
        return [[proposal.id, REVIEW_DECISION.REJECTED]];
      // Draft changes are included by default. Authors can exclude individual
      // changes before committing the request as one review action.
      return [[proposal.id, REVIEW_DECISION.ACCEPTED]];
    }),
  );

const walk = (start: string[], next: (id: string) => string[]) => {
  const visited = new Set<string>();
  const queue = [...start];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    queue.push(...next(id));
  }
  return visited;
};

/** Includes `ids` and everything they transitively depend on. */
export const requiredProposalIds = (ids: string[], proposals: ReviewProposal[]) => {
  const byId = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  return walk(ids, (id) => byId.get(id)?.dependsOnProposalIds ?? []);
};

/** Includes `ids` and everything that transitively depends on them. */
export const dependentProposalIds = (ids: string[], proposals: ReviewProposal[]) =>
  walk(ids, (id) =>
    proposals
      .filter((proposal) => proposal.dependsOnProposalIds.includes(id))
      .map((proposal) => proposal.id),
  );

const stage = (
  ids: Set<string>,
  verdict: StagedVerdict,
  decisions: StagedDecisions,
  proposals: ReviewProposal[],
): StagedDecisions => {
  const next = { ...decisions };
  proposals.forEach((proposal) => {
    if (ids.has(proposal.id) && proposal.decision !== PROPOSAL_DECISION.APPLIED)
      next[proposal.id] = verdict;
  });
  return next;
};

export const acceptProposals = (
  ids: string[],
  decisions: StagedDecisions,
  proposals: ReviewProposal[],
) => stage(requiredProposalIds(ids, proposals), REVIEW_DECISION.ACCEPTED, decisions, proposals);

export const rejectProposals = (
  ids: string[],
  decisions: StagedDecisions,
  proposals: ReviewProposal[],
) => stage(dependentProposalIds(ids, proposals), REVIEW_DECISION.REJECTED, decisions, proposals);

export const nodeDecision = (proposalIds: string[], decisions: StagedDecisions): ReviewDecision => {
  if (proposalIds.length === 0) return REVIEW_DECISION.PENDING;
  const verdicts = proposalIds.map((id) => decisions[id]);
  if (verdicts.every((verdict) => verdict === REVIEW_DECISION.ACCEPTED))
    return REVIEW_DECISION.ACCEPTED;
  if (verdicts.every((verdict) => verdict === REVIEW_DECISION.REJECTED))
    return REVIEW_DECISION.REJECTED;
  if (verdicts.some((verdict) => verdict !== undefined)) return REVIEW_DECISION.PARTIAL;
  return REVIEW_DECISION.PENDING;
};

export const decisionSummary = (proposals: ReviewProposal[], decisions: StagedDecisions) => {
  const open = proposals.filter((proposal) => proposal.decision !== PROPOSAL_DECISION.APPLIED);
  return {
    accepted: open.filter((proposal) => decisions[proposal.id] === REVIEW_DECISION.ACCEPTED),
    rejected: open.filter(
      (proposal) =>
        decisions[proposal.id] === REVIEW_DECISION.REJECTED &&
        proposal.decision !== PROPOSAL_DECISION.REJECTED &&
        proposal.decision !== PROPOSAL_DECISION.SUPERSEDED,
    ),
    pending: open.filter((proposal) => decisions[proposal.id] === undefined),
  };
};
