import { hasDataToUpdate } from "src/utils/hasDataToUpdate";

describe("hasDataToUpdate", () => {
  it("should return true if one of the values is not undefined or null", () => {
    const object1 = {
      a: "test",
      b: undefined,
    };
    expect(hasDataToUpdate(object1)).toBe(true);

    const object2 = {
      a: true,
      b: null,
    };
    expect(hasDataToUpdate(object2)).toBe(true);

    const object3 = {
      a: 1,
      b: "test",
    };
    expect(hasDataToUpdate(object3)).toBe(true);
  });

  it("should return false if object is empty", () => {
    const object = {};
    expect(hasDataToUpdate(object)).toBe(false);
  });

  it("should return false if all of the values are undefined or null", () => {
    const object = {
      a: null,
      b: undefined,
    };
    expect(hasDataToUpdate(object)).toBe(false);
  });

  it("should return true if value is falsy but not null or undefined", () => {
    const object1 = {
      a: "",
    };
    expect(hasDataToUpdate(object1)).toBe(true);

    const object2 = {
      a: 0,
    };
    expect(hasDataToUpdate(object2)).toBe(true);

    const object3 = {
      a: false,
    };
    expect(hasDataToUpdate(object3)).toBe(true);
  });
});
