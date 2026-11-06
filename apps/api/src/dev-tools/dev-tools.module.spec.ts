import { isDevToolsEnabled } from "./dev-tools.module";

describe("isDevToolsEnabled", () => {
  it("requires explicit opt-in", () => {
    expect(isDevToolsEnabled({})).toBe(false);
    expect(isDevToolsEnabled({ DEV_USER_SWITCHER: "true" })).toBe(true);
    expect(isDevToolsEnabled({ DEV_USER_SWITCHER: "true", NODE_ENV: "development" })).toBe(true);
  });

  it.each(["production", "staging", "test"])("stays off in %s even when opted in", (NODE_ENV) => {
    expect(isDevToolsEnabled({ DEV_USER_SWITCHER: "true", NODE_ENV })).toBe(false);
  });
});
