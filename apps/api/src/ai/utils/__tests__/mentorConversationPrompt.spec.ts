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
  it("requires a role-labeled, third-person practice brief", () => {
    const prompt = promptTemplates.aiMentorPracticeContentGenerator.template;

    expect(prompt).toContain("role-labeled scenario brief");
    expect(prompt).toContain("concise AI Mentor display name");
    expect(prompt).toContain("aiMentorName");
    expect(prompt).toContain("Learner objective");
    expect(prompt).toContain("AI Mentor behavior");
    expect(prompt).toContain("AI Mentor identity and persona");
    expect(prompt).toContain("AI Mentor responsibility");
    expect(prompt).toContain("The learner request describes the practice");
    expect(prompt).toContain("First separate the practice into two actors");
    expect(prompt).toContain("Make the accountable actor explicit");
    expect(prompt).toContain("AI Mentor, Maya Chen, missed the delivery deadline");
    expect(prompt).toContain("instructions must begin with explicit role ownership");
    expect(prompt).toContain(
      "Assign ownership of the scenario's source of tension to the AI Mentor",
    );
    expect(prompt).toContain("Do not address either participant directly");
    expect(prompt).toContain('Never use an unlabeled "you"');
  });

  it("requires a self-contained first line for standalone practice roleplay", () => {
    const prompt = Handlebars.compile(promptTemplates.aiMentorPracticeOpeningPrompt.template)({
      practiceInstructions: "Learner role: employee. Counterpart role: interrupting colleague.",
    });

    expect(prompt).toContain("This is the first visible message in the conversation");
    expect(prompt).toContain("The learner has not spoken yet");
    expect(prompt).toContain("Learner or Uczeń means the human participant");
    expect(prompt).toContain("never take it as your own objective");
    expect(prompt).toContain("own the events assigned to AI Mentor");
    expect(prompt).toContain("Do not refer to an unseen earlier conversation");
    expect(prompt).toContain("1 or 2 brief, natural sentences");
    expect(prompt).toContain("must stand on its own");
    expect(prompt).toContain("has already spoken");
    expect(prompt).toContain("zanim dokończysz");
    expect(prompt).toContain("Do not end with a generic invitation");
    expect(prompt).toContain("abstract topic such as priorities");
    expect(prompt).toContain("yesterday we agreed");
    expect(prompt).not.toContain("{{#if");
  });

  it("keeps roleplay conversational without coaching or parroting the brief", () => {
    const prompt = renderPrompt(promptTemplates.roleplayPrompt.template);

    expect(prompt).toContain("character direction privately");
    expect(prompt).toContain("Do not quote them, summarize them, convert them into a checklist");
    expect(prompt).toContain("Make one meaningful conversational move per turn");
    expect(prompt).toContain("Ask at most one focused question per turn");
    expect(prompt).toContain("Do not automatically solve the learner's task");
    expect(prompt).toContain("Never swap roles");
    expect(prompt).toContain("Treat explicit role labels as authoritative over pronouns");
    expect(prompt).toContain('Learner" or "Uczeń" always means the human participant');
    expect(prompt).toContain("Never ask the learner what they want to say");
    expect(prompt).toContain("Do not hand the exercise back to the learner");
    expect(prompt).toContain("What exactly should I hear from you?");
    expect(prompt).toContain("If the scenario assigns the source of a delay");
    expect(prompt).toContain("Do not transfer the event or its responsibility to the learner");
    expect(prompt).toContain("specific situation and immediate tension");
    expect(prompt).toContain("generic discussion about priorities");
    expect(prompt).toContain("only the words your character would say aloud");
    expect(prompt).toContain("Never add narration, stage directions, parenthetical actions");
    expect(prompt).toContain("never write an action such as");
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
