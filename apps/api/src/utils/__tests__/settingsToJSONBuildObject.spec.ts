import { settingsToJSONBuildObject } from "src/utils/settings-to-json-build-object";

import type { BuildQueryConfig } from "drizzle-orm";

describe("settingsToJSONBuildObject", () => {
  const toQueryConfig = {
    escapeName: (name) => `"${name}"`,
    escapeParam: (num, _value) => `$${num}`,
    escapeString: (str) => `'${str}'`,
    inlineParams: false,
  } as BuildQueryConfig;

  it("returned object entries should match input object entries", () => {
    const object = { a: "test" };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, $1::text)",
      params: ["a", "test"],
    });
  });

  it("should correctly handle basic data types", () => {
    const object = { a: "test", b: true, c: 1 };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, $1::text, $2::text, $3::boolean, $4::text, $5::numeric)",
      params: ["a", "test", "b", true, "c", 1],
    });
  });

  it("should correctly handle null or undefined types", () => {
    const object = { a: null, b: undefined };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, NULL, $1::text, NULL)",
      params: ["a", "b"],
    });
  });

  it("returned object values should be json build objects if input object values are objects", () => {
    const object = { a: { b: true, c: 1 } };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, json_build_object($1::text, $2::boolean, $3::text, $4::numeric))",
      params: ["a", "b", true, "c", 1],
    });
  });

  it("returned object values should be json arrays if input object values are arrays", () => {
    const object = { a: [null, "test"] };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, jsonb_build_array(NULL, $1::text))",
      params: ["a", "test"],
    });
  });

  it("should handle empty objects", () => {
    const object = { a: {} };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, json_build_object())",
      params: ["a"],
    });
  });

  it("should handle empty arrays", () => {
    const object = { a: [] };
    expect(settingsToJSONBuildObject(object).toQuery(toQueryConfig)).toStrictEqual({
      sql: "json_build_object($0::text, jsonb_build_array())",
      params: ["a"],
    });
  });
});
