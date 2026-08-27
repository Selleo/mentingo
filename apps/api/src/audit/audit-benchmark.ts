import type { AuditBenchmark, AuditBenchmarkSubmission } from "./audit.types";
import type { UUIDType } from "src/common";

export const buildAuditBenchmark = (
  submissions: AuditBenchmarkSubmission[],
  currentTenantId: UUIDType,
): AuditBenchmark => {
  const submissionsByTenant = new Map<UUIDType, AuditBenchmarkSubmission[]>();
  for (const submission of submissions) {
    const tenantSubmissions = submissionsByTenant.get(submission.tenantId) ?? [];
    tenantSubmissions.push(submission);
    submissionsByTenant.set(submission.tenantId, tenantSubmissions);
  }

  const participants = [...submissionsByTenant.values()]
    .map((tenantSubmissions) => {
      const [latest, previous] = tenantSubmissions.sort(
        (left, right) => left.submissionOrder - right.submissionOrder,
      );
      return {
        tenantId: latest.tenantId,
        name: latest.name,
        score: latest.score,
        improvement: previous ? latest.score - previous.score : null,
      };
    })
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name));

  let previousScore: number | null = null;
  let currentRank = 0;
  const rankedParticipants = participants.map((participant, index) => {
    if (previousScore === null || participant.score !== previousScore) currentRank = index + 1;
    previousScore = participant.score;
    return { ...participant, rank: currentRank };
  });

  const currentIndex = rankedParticipants.findIndex(
    (participant) => participant.tenantId === currentTenantId,
  );
  const current = currentIndex >= 0 ? rankedParticipants[currentIndex] : null;
  const comparisons = current
    ? rankedParticipants
        .slice(Math.max(0, currentIndex - 2), currentIndex + 3)
        .map((participant) => ({
          name: participant.name,
          score: participant.score,
          improvement: participant.improvement,
          isCurrentTenant: participant.tenantId === currentTenantId,
          rank: participant.rank,
        }))
    : [];
  const averageScore = rankedParticipants.length
    ? Math.round(
        rankedParticipants.reduce((total, participant) => total + participant.score, 0) /
          rankedParticipants.length,
      )
    : null;

  return {
    currentScore: current?.score ?? null,
    averageScore,
    improvement: current?.improvement ?? null,
    rank: current?.rank ?? null,
    participantCount: rankedParticipants.length,
    comparisons,
  };
};
