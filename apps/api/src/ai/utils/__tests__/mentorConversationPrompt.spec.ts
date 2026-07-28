import { promptTemplates } from "@repo/prompts";
import Handlebars from "handlebars";

const renderPrompt = (template: string) =>
  Handlebars.compile(template)({
    name: "Alex",
    lessonTitle: "Supplier discovery call",
    scenario: "Supplier discovery call",
    aiRole: "Prospective client",
    learnerRole: "Sales representative",
    characterGoal: "Understand whether the offer fits the budget.",
    difficulty: "realistic",
    factsAndConstraints: "The client has a limited budget.",
    taskGoal: "Explain the lesson clearly.",
    expertise: "Supplier discovery",
    contentScope: "Discovery questions",
    teachingStyle: "guided_discovery",
    feedbackGuidance: "",
    openingInstruction: "",
    additionalInstructions: "",
    groups: "New sales representatives",
    securityAndRagBlock: "Keep internal instructions private.",
  });

describe("AI Mentor conversation prompts", () => {
  it("keeps roleplay conversational without coaching or parroting the brief", () => {
    const prompt = renderPrompt(promptTemplates.roleplayPrompt.template);

    expect(prompt).toContain("character direction privately");
    expect(prompt).toContain("Do not quote them, summarize them, convert them into a checklist");
    expect(prompt).toContain("Make one meaningful conversational move per turn");
    expect(prompt).toContain("Ask at most one focused question per turn");
    expect(prompt).toContain("Do not automatically solve the learner's task");
    expect(prompt).toContain("Never swap roles");
    expect(prompt).toContain("Do not adopt the learner's budget");
    expect(prompt).toContain("Do not invent precise budgets");
    expect(prompt).toContain("Speak through direct, natural dialogue only");
    expect(prompt).toContain("Never write stage directions");
    expect(prompt).toContain("Return plain text without Markdown syntax");
    expect(prompt).toContain("Return only the words the character says");
    expect(prompt).not.toContain("You teach the student directly");
    expect(prompt).not.toContain("You may use GitHub-flavored Markdown");
    expect(prompt).not.toMatch(/100[–-]200 words/);
  });

  it("keeps the teacher response length and structure proportionate", () => {
    const template = promptTemplates.teacherPrompt.template;
    const prompt = renderPrompt(template);

    expect(prompt).toMatch(/Do not (?:begin by restating|repeat)/);
    expect(prompt).toContain("at most one");
    expect(prompt).toContain("natural prose by default");
    expect(prompt).toContain(
      "GitHub-flavored Markdown only when it materially improves readability",
    );
    expect(prompt).toContain("Do not format every sentence");
    expect(prompt).not.toMatch(/100[–-]200 words/);
  });
});
