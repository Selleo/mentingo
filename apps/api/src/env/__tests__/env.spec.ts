import { EnvService } from "src/env/services/env.service";

import { createUnitTest } from "../../../test/create-unit-test";
import { truncateTables } from "../../../test/helpers/test-helpers";

import type { TestContext } from "../../../test/create-unit-test";
import type { DatabasePg } from "src/common";

describe("EnvService", () => {
  let testContext: TestContext;
  let db: DatabasePg;
  let envService: EnvService;

  beforeAll(async () => {
    testContext = await createUnitTest();

    envService = testContext.module.get(EnvService);
    db = testContext.db;
  }, 30000);

  afterAll(async () => {
    await truncateTables(db, ["secrets"]);
    await testContext.teardown();
  });

  describe("Create ENV", () => {
    it("should create one env", async () => {
      const envToInsert = "VITE_GOOGLE_OAUTH_ENABLED";
      const valueToInsert = "true";

      await envService.bulkUpsertEnv([{ name: envToInsert, value: valueToInsert }]);

      const env = await envService.getEnv(envToInsert);

      expect(env).toBeDefined();
    });

    it("should create multiple envs", async () => {
      const envsToInsert = [
        { name: "MICROSOFT_CLIENT_ID", value: "value1" },
        { name: "MICROSOFT_CLIENT_SECRET", value: "value2" },
        { name: "MICROSOFT_OAUTH_ENABLED", value: "value3" },
      ];

      await envService.bulkUpsertEnv(envsToInsert);

      for (const envItem of envsToInsert) {
        const env = await envService.getEnv(envItem.name);
        expect(env).toBeDefined();
        expect(env.value).toEqual(envItem.value);
      }
    });

    it("should fail to create env", async () => {
      const envToInsert = "ENV_ONE";
      const valueToInsert = "value1";

      await expect(
        envService.bulkUpsertEnv([{ name: envToInsert, value: valueToInsert }]),
      ).rejects.toThrow();
    });
  });

  describe("Update ENV", () => {
    it("should update env correctly", async () => {
      const envName = "BUNNY_STREAM_API_KEY";
      const initialValue = "value1";
      const updatedValue = "value2";

      await envService.bulkUpsertEnv([{ name: envName, value: initialValue }]);

      const initialEnv = await envService.getEnv(envName);

      expect(initialEnv.value).toEqual(initialValue);

      await envService.bulkUpsertEnv([{ name: envName, value: updatedValue }]);

      const updatedEnv = await envService.getEnv(envName);

      expect(updatedEnv.value).toEqual(updatedValue);
    });
  });

  describe("Read ENV", () => {
    it("should read env correctly", async () => {
      const envToInsert = "OPENAI_API_KEY";
      const valueToInsert = "openai_key";

      await envService.bulkUpsertEnv([{ name: envToInsert, value: valueToInsert }]);

      const env = await envService.getEnv(envToInsert);

      expect(env.value).toEqual(valueToInsert);
    });

    it("should fail to read env", async () => {
      const envToCheck = "ENV_ONE";
      await expect(envService.getEnv(envToCheck)).rejects.toThrow();
    });

    it("should read sso enabled correctly", async () => {
      const envsToInsert = [
        { name: "VITE_GOOGLE_OAUTH_ENABLED", value: "false" },
        { name: "VITE_MICROSOFT_OAUTH_ENABLED", value: "true" },
      ];

      await envService.bulkUpsertEnv(envsToInsert);

      const ssoEnabled = await envService.getSSOEnabled();

      expect(ssoEnabled.google).toEqual(envsToInsert[0].value);
      expect(ssoEnabled.microsoft).toEqual(envsToInsert[1].value);
    });
  });
});
