/** Default interaction boundary and product-wide scoring rule for assessed Mentor sessions. */
export const MENTOR_CONDUCT_INSTRUCTIONS = [
  "If the scenario explicitly defines how the character reacts to disrespect, follow that behavior.",
  "Otherwise, when the learner directs an insult or abusive language at a participant, react naturally in character, set a brief boundary, and pause the exercise.",
  "If the abuse is severe or repeated, end the roleplay politely and stay disengaged in later turns. Do not resume just because the learner changes the subject.",
  "Treat neutral discussion or quotations of abusive language as discussion when the learner is not using it against someone.",
].join(" ");

export const MENTOR_CONDUCT_BLOCKING_ERROR = {
  id: "d1c45bd7-b07b-409f-933d-9068fcd493cb",
  description:
    "The learner uses profanity, an insult, a slur, or abusive language in their own speech or text. Include direct use even when phrased casually. Do not count neutral quotation, reporting what someone else said, discussion of a term without using it as an insult, or ambiguous transcription.",
} as const;
