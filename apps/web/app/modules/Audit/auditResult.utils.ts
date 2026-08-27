export type AuditLevelKey = "level1" | "level2" | "level3" | "level4";
export type RoadmapPace = "3" | "6" | "12";

export const getAuditLevelKey = (score: number): AuditLevelKey => {
  if (score < 60) return "level1";
  if (score < 75) return "level2";
  if (score < 90) return "level3";
  return "level4";
};

export const getRoadmapPhasePeriods = (pace: RoadmapPace) => {
  if (pace === "6") return ["1", "2", "3", "4", "5", "6"];
  if (pace === "12") return ["q1", "q2", "q3", "q4"];
  return ["1", "2", "3"];
};
