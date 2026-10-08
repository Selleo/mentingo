import { JudgeService } from "src/ai/services/judge.service";
import { THREAD_STATUS } from "src/ai/utils/ai.type";

import type { AiJudgeRubric } from "src/ai/judge-configuration/judge-configuration.types";

const rubric: AiJudgeRubric = {
  configurationId: "configuration-id",
  taskGoal: "Report suspicious access without investigating customer systems.",
  passingThresholdPercent: 75,
  criteria: [
    {
      id: "criterion-id",
      title: "Report",
      expectedBehavior: "Report facts",
      maxScore: 1,
      scoreGuidance: [],
    },
  ],
  blockingErrors: [
    { id: "blocking-id", description: "Learner logs into the customer's system to investigate." },
  ],
};

const learnerMessages = [
  { content: "I saw a sign-in attempt on my own account after my work ended." },
  { content: "I did not log back into the customer's system or investigate its logs." },
];

const firstResult = {
  criterionResults: [
    { criterionRef: "C1", awardedScore: 1, learnerSafeFeedback: "You reported the event." },
  ],
  triggeredBlockingErrors: [
    { blockingErrorRef: "B1", learnerSafeFeedback: "You inspected your account." },
  ],
};

const setup = (
  results: Array<typeof firstResult | { criterionResults: []; triggeredBlockingErrors: [] }>,
) => {
  const runtime = { judgeMentor: jest.fn().mockResolvedValueOnce(results[0]) };
  for (const result of results.slice(1)) runtime.judgeMentor.mockResolvedValueOnce(result);
  const prompt = { loadPrompt: jest.fn().mockImplementation(async (id: string) => id) };
  const messages = {
    findMessageHistory: jest
      .fn()
      .mockResolvedValue({ history: learnerMessages, userLanguage: "en" }),
  };
  const service = new JudgeService(
    {} as never,
    {
      findJudgeRubricByThreadId: jest.fn().mockResolvedValue({ lessonTitle: "Incident", rubric }),
    } as never,
    runtime as never,
    { judge: jest.fn() } as never,
    {
      findThread: jest
        .fn()
        .mockResolvedValue({ data: { status: THREAD_STATUS.ACTIVE, userLanguage: "en" } }),
    } as never,
    messages as never,
    prompt as never,
  );
  const persist = jest
    .spyOn(service as never, "persistJudgement" as never)
    .mockResolvedValue(undefined as never);
  return { service, runtime, prompt, persist };
};

const run = (service: JudgeService) =>
  service.runJudge({ threadId: "thread-id" } as never, { userId: "user-id", permissions: [] });

describe("JudgeService blocking-error verification", () => {
  it("does not fail a learner when an independent check finds only a denied or reported action", async () => {
    const { service, runtime, prompt, persist } = setup([
      firstResult,
      { criterionResults: [], triggeredBlockingErrors: [] },
    ]);

    const result = await run(service);

    expect(runtime.judgeMentor).toHaveBeenCalledTimes(2);
    for (const [input] of runtime.judgeMentor.mock.calls) {
      expect(input).not.toHaveProperty("temperature");
    }
    expect(prompt.loadPrompt).toHaveBeenNthCalledWith(2, "judgeBlockingErrorVerificationPrompt", {
      language: "en",
      blockingError: rubric.blockingErrors[0].description,
    });
    const verifierInput = runtime.judgeMentor.mock.calls[1][0].messages;
    expect(verifierInput[0].content).toBe("judgeBlockingErrorVerificationPrompt");
    expect(verifierInput[1].content).toContain(learnerMessages[1].content);
    expect(JSON.stringify(verifierInput)).not.toContain(
      firstResult.triggeredBlockingErrors[0].learnerSafeFeedback,
    );
    expect(JSON.stringify(verifierInput)).not.toContain(rubric.criteria[0].expectedBehavior);
    expect(result.data).toMatchObject({
      passed: true,
      blockingErrors: [],
      status: THREAD_STATUS.COMPLETED,
    });
    expect(persist).toHaveBeenCalledWith(
      "thread-id",
      "en",
      rubric,
      expect.objectContaining({ passed: true, blockingErrors: [] }),
    );
  });

  it("keeps a clearly corroborated blocking error and its learner-facing explanation", async () => {
    const { service, runtime } = setup([
      firstResult,
      {
        criterionResults: [],
        triggeredBlockingErrors: [
          {
            blockingErrorRef: "B1",
            learnerSafeFeedback: "You said you logged back into the customer system.",
          },
        ],
      },
    ]);
    const messageService = service["messageService"] as unknown as {
      findMessageHistory: jest.Mock;
    };
    messageService.findMessageHistory.mockResolvedValue({
      history: [{ content: "I logged back into the customer system and checked its logs." }],
      userLanguage: "en",
    });

    const result = await run(service);

    expect(runtime.judgeMentor).toHaveBeenCalledTimes(2);
    expect(result.data).toMatchObject({
      passed: false,
      blockingErrors: [
        {
          blockingErrorId: "blocking-id",
          learnerSafeFeedback: "You said you logged back into the customer system.",
        },
      ],
    });
  });

  it("does not make another model call when no blocking error was proposed", async () => {
    const { service, runtime } = setup([{ ...firstResult, triggeredBlockingErrors: [] }]);

    expect((await run(service)).data.passed).toBe(true);
    expect(runtime.judgeMentor).toHaveBeenCalledTimes(1);
  });

  it("does not complete the attempt when the verifier produces an invalid reference", async () => {
    const { service, persist } = setup([
      firstResult,
      {
        criterionResults: [],
        triggeredBlockingErrors: [{ blockingErrorRef: "B2", learnerSafeFeedback: "Unrelated." }],
      },
    ]);

    await expect(run(service)).rejects.toThrow("blocking-error reference");
    expect(persist).not.toHaveBeenCalled();
  });

  it("does not persist an unverified failure if the independent check is unavailable", async () => {
    const { service, runtime, persist } = setup([firstResult]);
    runtime.judgeMentor.mockRejectedValueOnce(new Error("verification unavailable"));

    await expect(run(service)).rejects.toThrow("verification unavailable");
    expect(persist).not.toHaveBeenCalled();
  });

  it.each([
    "Ktoś zalogował się na moje konto po zakończeniu pracy; odrzuciłem MFA.",
    "Nie mam uprawnień do badania systemu klienta i nie sprawdzałem logów.",
    "Tomasz polecił nie logować się ponownie; zastosowałem się.",
    "Gdybym miał uprawnienia, mógłbym sprawdzić logi, ale ich nie mam.",
  ])(
    "does not block on reported, denied, mentor-directed or hypothetical behavior: %s",
    async (statement) => {
      const { service, runtime, persist } = setup([
        firstResult,
        { criterionResults: [], triggeredBlockingErrors: [] },
      ]);
      const messageService = service["messageService"] as unknown as {
        findMessageHistory: jest.Mock;
      };
      messageService.findMessageHistory.mockResolvedValue({
        history: [{ content: statement }],
        userLanguage: "pl",
      });

      const result = await run(service);

      expect(runtime.judgeMentor.mock.calls[1][0].messages[1].content).toContain(statement);
      expect(result.data).toMatchObject({ passed: true, blockingErrors: [] });
      expect(persist).toHaveBeenCalledWith(
        "thread-id",
        "en",
        rubric,
        expect.objectContaining({ passed: true, blockingErrors: [] }),
      );
    },
  );

  it("verifies each proposed error separately and keeps only the corroborated one", async () => {
    const secondRule = { id: "second-blocking-id", description: "Learner deletes client logs." };
    const twoRules = { ...rubric, blockingErrors: [...rubric.blockingErrors, secondRule] };
    const { service, runtime, prompt, persist } = setup([
      {
        ...firstResult,
        triggeredBlockingErrors: [
          { blockingErrorRef: "B1", learnerSafeFeedback: "Unverified login." },
          { blockingErrorRef: "B2", learnerSafeFeedback: "Unverified deletion." },
        ],
      },
      { criterionResults: [], triggeredBlockingErrors: [] },
      {
        criterionResults: [],
        triggeredBlockingErrors: [
          { blockingErrorRef: "B1", learnerSafeFeedback: "You deleted the client logs." },
        ],
      },
    ]);
    const repository = service["aiRepository"] as unknown as {
      findJudgeRubricByThreadId: jest.Mock;
    };
    repository.findJudgeRubricByThreadId.mockResolvedValue({
      lessonTitle: "Incident",
      rubric: twoRules,
    });
    const messageService = service["messageService"] as unknown as {
      findMessageHistory: jest.Mock;
    };
    messageService.findMessageHistory.mockResolvedValue({
      history: [{ content: "I did not log back in, but I deleted the client's logs." }],
      userLanguage: "en",
    });

    const result = await run(service);

    expect(runtime.judgeMentor).toHaveBeenCalledTimes(3);
    expect(prompt.loadPrompt).toHaveBeenNthCalledWith(2, "judgeBlockingErrorVerificationPrompt", {
      language: "en",
      blockingError: rubric.blockingErrors[0].description,
    });
    expect(prompt.loadPrompt).toHaveBeenNthCalledWith(3, "judgeBlockingErrorVerificationPrompt", {
      language: "en",
      blockingError: secondRule.description,
    });
    expect(result.data).toMatchObject({
      score: 1,
      passed: false,
      blockingErrors: [
        { blockingErrorId: secondRule.id, learnerSafeFeedback: "You deleted the client logs." },
      ],
    });
    expect(persist).toHaveBeenCalledWith(
      "thread-id",
      "en",
      twoRules,
      expect.objectContaining({
        blockingErrors: [expect.objectContaining({ blockingErrorId: secondRule.id })],
      }),
    );
  });

  it("starts independent checks concurrently when several blocking errors are proposed", async () => {
    const twoRules = {
      ...rubric,
      blockingErrors: [
        ...rubric.blockingErrors,
        { id: "second-blocking-id", description: "Learner deletes client logs." },
      ],
    };
    const { service, runtime, persist } = setup([
      {
        ...firstResult,
        triggeredBlockingErrors: [
          { blockingErrorRef: "B1", learnerSafeFeedback: "First candidate." },
          { blockingErrorRef: "B2", learnerSafeFeedback: "Second candidate." },
        ],
      },
    ]);
    const repository = service["aiRepository"] as unknown as {
      findJudgeRubricByThreadId: jest.Mock;
    };
    repository.findJudgeRubricByThreadId.mockResolvedValue({
      lessonTitle: "Incident",
      rubric: twoRules,
    });
    let releaseFirst!: (value: { criterionResults: []; triggeredBlockingErrors: [] }) => void;
    runtime.judgeMentor.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseFirst = resolve;
        }),
    );
    runtime.judgeMentor.mockResolvedValueOnce({
      criterionResults: [],
      triggeredBlockingErrors: [],
    });

    const evaluation = run(service);
    await new Promise((resolve) => setImmediate(resolve));
    const callsBeforeRelease = runtime.judgeMentor.mock.calls.length;
    releaseFirst({ criterionResults: [], triggeredBlockingErrors: [] });
    await evaluation;

    expect(callsBeforeRelease).toBe(3);
    expect(persist).toHaveBeenCalledWith(
      "thread-id",
      "en",
      twoRules,
      expect.objectContaining({ passed: true, blockingErrors: [] }),
    );
  });

  it("does not turn a Polish denial of investigating client logs into an automatic failure", async () => {
    const { service, runtime, persist } = setup([
      firstResult,
      { criterionResults: [], triggeredBlockingErrors: [] },
    ]);
    const history = [
      {
        content: "O 16:32 moje konto połączyło się z systemem klienta, po zakończeniu moich prac.",
      },
      { content: "Odrzuciłem prośbę MFA. Od 16:10 nie używam konta." },
      {
        content:
          "Tylko widzę próbę zalogowania. Nie mam uprawnień do samodzielnego badania systemu klienta ani usuwania śladów.",
      },
    ];
    const messageService = service["messageService"] as unknown as {
      findMessageHistory: jest.Mock;
    };
    messageService.findMessageHistory.mockResolvedValue({ history, userLanguage: "pl" });
    const threadService = service["threadService"] as unknown as { findThread: jest.Mock };
    threadService.findThread.mockResolvedValue({
      data: { status: THREAD_STATUS.ACTIVE, userLanguage: "pl" },
    });

    const result = await run(service);

    expect(runtime.judgeMentor.mock.calls[1][0].messages[1].content).toContain(history[2].content);
    expect(result.data).toMatchObject({ passed: true, blockingErrors: [] });
    expect(persist).toHaveBeenCalledWith(
      "thread-id",
      "pl",
      rubric,
      expect.objectContaining({ passed: true }),
    );
  });
});
