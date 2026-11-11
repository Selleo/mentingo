import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as featureTasks from "./feature-task";
import { captureFeatureTask } from "./run-feature";
import { sha256 } from "./semantic-evaluator";

import type {
  CoreAiFeature,
  FeatureCatalogue,
  FeatureModelRequest,
} from "./feature-catalogue.types";

const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const feature = (id: string): CoreAiFeature => {
  const found = catalogue.features.find((item) => item.featureId === id);
  if (!found) throw new Error("Missing capture test feature");
  return found;
};

describe("Core native report provenance (controlled model interface, no provider traffic)", () => {
  afterEach(() => jest.restoreAllMocks());

  it("retains the authoritative fixture while recording exact rendered model arguments separately", async () => {
    const selected = feature("mentor-teacher-chat");
    const item = selected.items[0];
    let received: FeatureModelRequest | undefined;
    const model = jest.fn(async (request: FeatureModelRequest) => {
      received = request;
      return "Badge issue is free at reception.";
    });
    const row = await captureFeatureTask(
      selected,
      item,
      { run: true, allowModelRequests: true, model },
      {
        model: "configured-test-model",
        configSha256: "configured-hash",
        apiKey: "synthetic-secret-never-report",
      },
    );
    expect(row.input).toEqual(item.input);
    expect(row.expectedOutput).toEqual(item.expectedOutput);
    expect(row.metadata.inputProvenance).toBe("declared_published_fixture");
    expect(row.metadata.expectedOutputProvenance).toBe("versioned_catalogue");
    expect(row.metadata.effectiveModelRequests).toHaveLength(1);
    const captured = row.metadata.effectiveModelRequests[0];
    expect(captured.request.messages).toEqual(received?.messages);
    expect(captured.request.messages[0].content).not.toBe(item.input.scenario);
    expect(captured.requestSha256).toBe(sha256(JSON.stringify(captured.request)));
    expect(captured.outcome).toBe("returned");
    expect(captured.outputSha256).toBe(sha256(JSON.stringify(row.output)));
    expect(row.metadata.effectiveProviderConfig).toEqual({
      model: "configured-test-model",
      configSha256: "configured-hash",
    });
    expect(row.metadata.rawProviderResponsesCaptured).toBe(false);
    expect(row.metadata.rawHttpRequestsCaptured).toBe(false);
    expect(JSON.stringify(row)).not.toContain("synthetic-secret-never-report");
    expect(row.status).toBe("needs_review");
  });

  it("keeps embedding texts and response evidence at the actual model-call boundary", async () => {
    const selected = feature("mentor-rag-embeddings");
    const item = selected.items[0];
    const row = await captureFeatureTask(selected, item, {
      run: true,
      allowModelRequests: true,
      model: jest.fn().mockResolvedValue([
        [1, 0],
        [0.9, 0.1],
        [0, 1],
      ]),
    });
    expect(row.metadata.effectiveModelRequests[0].request.kind).toBe("embedding");
    expect(row.metadata.effectiveModelRequests[0].request.texts).toEqual(item.input.task.texts);
    expect(row.checks.semanticNeighborOrdering).toBe(true);
    expect(row.metadata.modelProvenance).toBe("model_call_observed_configuration_unavailable");
  });

  it("retains failed attempts and fixture expectations without leaking private provider errors", async () => {
    const selected = feature("mentor-teacher-chat");
    const item = selected.items[0];
    const row = await captureFeatureTask(selected, item, {
      run: true,
      allowModelRequests: true,
      model: jest
        .fn()
        .mockRejectedValue(new Error("private provider error includes synthetic-credential")),
    });
    expect(row.status).toBe("failed");
    expect(row.input).toEqual(item.input);
    expect(row.expectedOutput).toEqual(item.expectedOutput);
    expect(row.metadata.effectiveModelRequests[0].outcome).toBe("failed");
    expect(row.metadata.runnerFailureCategory).toBe("Error");
    expect(JSON.stringify(row)).not.toContain("synthetic-credential");
  });

  it.each([
    { name: "AI_APICallError", statusCode: 400, category: "AI_APICallError", status: 400 },
    {
      name: "AI_NoOutputGeneratedError",
      statusCode: undefined,
      category: "AI_NoOutputGeneratedError",
      status: undefined,
    },
    {
      name: "synthetic-private-name",
      statusCode: 9001,
      category: "UnclassifiedError",
      status: undefined,
    },
  ])(
    "retains only a safe failure category and HTTP status: $category",
    async ({ name, statusCode, category, status }) => {
      const selected = feature("mentor-teacher-chat");
      const privateValue = "synthetic-private-provider-secret";
      const error = Object.assign(new Error(privateValue), {
        name,
        statusCode,
        responseBody: privateValue,
        responseHeaders: { Authorization: privateValue },
      });
      const row = await captureFeatureTask(selected, selected.items[0], {
        run: true,
        allowModelRequests: true,
        model: jest.fn().mockRejectedValue(error),
      });
      expect(row.status).toBe("failed");
      expect(row.metadata.runnerFailureCategory).toBe(category);
      expect(row.metadata.runnerFailureStatus).toBe(status);
      expect(JSON.stringify(row)).not.toContain(privateValue);
      expect(JSON.stringify(row)).not.toContain("synthetic-private-name");
      expect(row.metadata.rawProviderResponsesCaptured).toBe(false);
    },
  );

  it("does not attribute a configured CLI model to native application execution", async () => {
    const selected = feature("mentor-native-chat");
    const item = selected.items[0];
    const output = {
      threadId: "synthetic-thread",
      messages: [{ role: "assistant", content: "Persisted reply" }],
    };
    jest.spyOn(featureTasks, "runFeatureTask").mockResolvedValue({
      caseId: item.id,
      featureId: selected.featureId,
      status: "needs_review",
      executionLevel: "application_http",
      output,
      checks: { nativePersistence: false },
      promptFragments: [],
    });
    const model = jest.fn();
    const row = await captureFeatureTask(
      selected,
      item,
      { run: true, allowAppRequests: true, model },
      { model: "unrelated-cli-model" },
    );
    expect(row.status).toBe("failed");
    expect(row.output).toEqual(output);
    expect(row.checks.nativePersistence).toBe(false);
    expect(row.metadata.effectiveModelRequests).toEqual([]);
    expect(row.metadata.modelProvenance).toBe("native_runtime_not_observed");
    expect(row.metadata.effectiveProviderConfig).toBeUndefined();
    expect(row.metadata.nativeEvidenceProvenance).toBe("adapter_returned_checks_and_output");
    expect(row.metadata.rawHttpRequestsCaptured).toBe(false);
    expect(model).not.toHaveBeenCalled();
  });

  it("distinguishes preparation and missing native evidence from observed execution", async () => {
    const selected = feature("assistant-conversation");
    const item = selected.items[0];
    const model = jest.fn();
    const prepared = await captureFeatureTask(selected, item, { run: false, model });
    expect(prepared.status).toBe("prepared");
    expect(prepared.metadata.modelProvenance).toBe("no_model_request_observed");
    const failed = await captureFeatureTask(selected, item, { run: true });
    expect(failed.status).toBe("failed");
    expect(failed.metadata.nativeEvidenceProvenance).toBe("not_observed");
    expect(failed.metadata.effectiveModelRequests).toEqual([]);
    expect(model).not.toHaveBeenCalled();
  });
});
