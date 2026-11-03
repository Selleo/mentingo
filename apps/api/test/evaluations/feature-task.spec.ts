import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { AI_TELEMETRY_FUNCTION_IDS } from "src/ai/utils/ai-telemetry";

import {
  normalizePromptSnapshots,
  prepareFeaturePrompt,
  runFeatureTask,
  validateFeatureCatalogue,
} from "./feature-task";

import type { FeatureCatalogue, PromptSnapshots } from "./feature-catalogue.types";

const catalogue = JSON.parse(
  readFileSync(resolve(__dirname, "feature-catalogue.v1.json"), "utf8"),
) as FeatureCatalogue;
const feature = (id: string) => {
  const found = catalogue.features.find((candidate) => candidate.featureId === id);
  if (!found) throw new Error("Missing feature fixture");
  return found;
};

describe("normalized manual Core feature tasks (no model or application calls)", () => {
  it("covers every declared Core AI telemetry function and keeps source evidence links valid", () => {
    validateFeatureCatalogue(catalogue);
    const functions = new Set(catalogue.features.flatMap((item) => item.functionIds));
    for (const id of Object.values(AI_TELEMETRY_FUNCTION_IDS)) expect(functions.has(id)).toBe(true);
    for (const item of catalogue.features)
      for (const path of item.sourcePaths)
        expect(existsSync(resolve(__dirname, "../../../..", path))).toBe(true);
    expect(catalogue.features).toHaveLength(31);
    expect(catalogue.features.flatMap((item) => item.items)).toHaveLength(103);
  });

  it.each(catalogue.features)(
    "prepares source-grounded $featureId cases without executing a provider",
    async (item) => {
      const model = jest.fn();
      for (const candidate of item.items) {
        const result = await runFeatureTask(item, candidate, { run: false, model });
        expect(["prepared", "not_run"]).toContain(result.status);
        if (candidate.input.task.kind === "prompt") {
          expect(
            result.promptFragments.every(
              (fragment) => fragment.origin === "local_source" && fragment.production === false,
            ),
          ).toBe(true);
        }
      }
      expect(model).not.toHaveBeenCalled();
    },
  );

  it("uses pinned managed production snapshots and fails when any required fragment is absent", () => {
    const item = feature("mentor-teacher-chat").items[0];
    const snapshots: PromptSnapshots = {
      prompts:
        item.input.task.promptFragments?.map((fragment) => ({
          name: fragment.promptId,
          version: 99,
          label: "production",
          prompt: "Managed {{language}} facts: {{contentScope}}",
        })) ?? [],
    };
    const prepared = prepareFeaturePrompt(item, snapshots);
    expect(
      prepared.fragments.every((fragment) => fragment.version === 99 && fragment.production),
    ).toBe(true);
    expect(prepared.request.messages[0].content).toContain("Managed en facts:");
    expect(() => prepareFeaturePrompt(item, { prompts: snapshots.prompts.slice(1) })).toThrow(
      "snapshot is missing",
    );
  });

  it("normalizes centrally fetched top-level production labels without claiming local fallbacks are production", () => {
    const snapshots = normalizePromptSnapshots({
      label: "production",
      prompts: [
        {
          name: "teacherPrompt",
          version: 7,
          prompt: "Managed template",
          labels: ["latest", "production"],
        },
      ],
    });
    expect(snapshots.prompts[0].label).toBe("production");
    expect(
      prepareFeaturePrompt(feature("mentor-teacher-chat").items[0]).fragments.every(
        (fragment) => !fragment.production,
      ),
    ).toBe(true);
  });

  it("requires explicit model opt-in and never treats nonempty text as semantic acceptance", async () => {
    const selected = feature("mentor-teacher-chat");
    const model = jest
      .fn()
      .mockResolvedValue("The badge costs 500 euros. The lesson is completed.");
    await expect(runFeatureTask(selected, selected.items[0], { run: true, model })).rejects.toThrow(
      "opt-in",
    );
    expect(model).not.toHaveBeenCalled();
    const result = await runFeatureTask(selected, selected.items[0], {
      run: true,
      allowModelRequests: true,
      model,
    });
    expect(result.status).toBe("needs_review");
    expect(result.checks.nonemptyOutput).toBe(true);
  });

  it("validates actual production output schema after model generation", async () => {
    const selected = feature("mentor-config-create");
    const result = await runFeatureTask(selected, selected.items[0], {
      run: true,
      allowModelRequests: true,
      model: jest.fn().mockResolvedValue({ fakeSuccess: true }),
    });
    expect(result.status).toBe("failed");
    expect(result.checks.productionOutputSchema).toBe(false);
  });

  it("checks embedding semantic ordering, rejecting finite but reversed or zero vectors", async () => {
    const selected = feature("mentor-rag-embeddings");
    const run = (vectors: number[][]) =>
      runFeatureTask(selected, selected.items[0], {
        run: true,
        allowModelRequests: true,
        model: jest.fn().mockResolvedValue(vectors),
      });
    expect(
      (
        await run([
          [1, 0],
          [0.9, 0.1],
          [0, 1],
        ])
      ).checks.semanticNeighborOrdering,
    ).toBe(true);
    expect(
      (
        await run([
          [1, 0],
          [0, 1],
          [1, 0],
        ])
      ).status,
    ).toBe("failed");
    expect(
      (
        await run([
          [0, 0],
          [0, 0],
          [0, 0],
        ])
      ).status,
    ).toBe("failed");
  });

  it("prepares real audio/tool adapters that require fixtures, without substituting a model answer", async () => {
    for (const id of ["mentor-transcription", "assistant-authorized-read-tools"]) {
      const selected = feature(id);
      const model = jest.fn();
      expect(
        (
          await runFeatureTask(selected, selected.items[0], {
            run: false,
            model,
          })
        ).status,
      ).toBe("prepared");
      await expect(
        runFeatureTask(selected, selected.items[0], {
          run: true,
          allowModelRequests: true,
          model,
        }),
      ).rejects.toThrow("application opt-in");
      expect(model).not.toHaveBeenCalled();
    }
  });
});
