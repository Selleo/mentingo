import type { AiJudgeConfigurationInput } from "../../flows/curriculum/fill-ai-judge-configuration.flow";

export const BASE_AI_JUDGE_CONFIGURATION: AiJudgeConfigurationInput = {
  taskGoal: "Discover the customer's needs and agree on a useful next step.",
  passingThresholdPercent: 0,
  criterion: {
    title: "Uses SPIN discovery questions",
    expectedBehavior:
      "The student asks Situation, Problem, Implication, and Need-payoff questions.",
    maxScore: 2,
    scoreGuidance: [
      {
        score: 0,
        description: "The student does not ask a relevant discovery question.",
        example: "The student immediately presents the offer.",
      },
      {
        score: 1,
        description: "The student asks a Situation question but does not explore the problem.",
        example: "What process do you currently use?",
      },
      {
        score: 2,
        description:
          "The student identifies the situation and explores the problem or its implications.",
        example: "What happens when the current process delays the team?",
      },
    ],
  },
  blockingError: "The student invents customer information instead of asking about it.",
};

export const GERMAN_AI_JUDGE_CONFIGURATION: AiJudgeConfigurationInput = {
  taskGoal: "Kundenbedarf ermitteln und einen hilfreichen nächsten Schritt vereinbaren.",
  passingThresholdPercent: 0,
  criterion: {
    title: "Verwendet SPIN-Fragen",
    expectedBehavior:
      "Der Teilnehmer stellt Situations-, Problem-, Implikations- und Nutzenfragen.",
    maxScore: 2,
    scoreGuidance: [
      {
        score: 0,
        description: "Der Teilnehmer stellt keine relevante Analysefrage.",
        example: "Der Teilnehmer präsentiert sofort das Angebot.",
      },
      {
        score: 1,
        description: "Der Teilnehmer fragt nach der Situation, vertieft das Problem aber nicht.",
        example: "Welchen Prozess verwenden Sie derzeit?",
      },
      {
        score: 2,
        description:
          "Der Teilnehmer versteht die Situation und untersucht das Problem oder seine Folgen.",
        example: "Was passiert, wenn der aktuelle Prozess das Team verzögert?",
      },
    ],
  },
  blockingError: "Der Teilnehmer erfindet Kundendaten, anstatt danach zu fragen.",
};
