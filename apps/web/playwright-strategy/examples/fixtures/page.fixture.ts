import { dataFixture } from "./data.fixture";

export const pageFixture = dataFixture.extend<{
  appBasePath: string;
}>({
  appBasePath: async (args, use) => {
    void args;
    await use("/");
  },
});
