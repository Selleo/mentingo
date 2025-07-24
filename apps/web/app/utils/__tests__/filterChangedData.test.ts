import { filterChangedData } from "../filterChangedData";

describe("filterChangedData", () => {
  test("returns only changed and non-empty fields", async () => {
    const data = { name: "Alice", age: 25, city: "" };
    const original = { name: "Alice", age: 20, city: "Paris" };
    const result = filterChangedData(data, original);
    expect(result).toEqual({ age: 25 });
  });

  test("returns all non-empty fields if originalData is undefined", async () => {
    const data = { name: "Bob", age: 30, city: "London" };
    const result = filterChangedData(data);
    expect(result).toEqual({ name: "Bob", age: 30, city: "London" });
  });

  test("returns empty object if nothing changed", async () => {
    const data = { name: "Alice", age: 20 };
    const original = { name: "Alice", age: 20 };
    const result = filterChangedData(data, original);
    expect(result).toEqual({});
  });

  test("handles partial originalData", async () => {
    const data = { name: "Alice", age: 25 };
    const original = { name: "Bob" };
    const result = filterChangedData(data, original);
    expect(result).toEqual({ name: "Alice", age: 25 });
  });

  test("returns empty object if data is empty", async () => {
    const data = {};
    const original = { name: "Alice", age: 20 };
    const result = filterChangedData(data, original);
    expect(result).toEqual({});
  });

  test("handles undefined values", async () => {
    const data = { name: "Alice", age: 20, city: "Paris" };
    const original = { name: "Alice", age: undefined, city: undefined };
    const result = filterChangedData(data, original);
    expect(result).toEqual({ age: 20, city: "Paris" });
  });
});
