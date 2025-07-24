import { isEmpty } from "lodash-es";

/**
 * Filters out unchanged or empty fields from the provided data object compared to the original data.
 *
 * Note: This function currently accepts only objects as input for `data` and `originalData`, but can be extended.
 *
 * @template T - The type of the data objects.
 * @param {Partial<T>} data - The new data object with potentially changed fields.
 * @param {Partial<T>} [originalData] - The original data object to compare against.
 * @returns {Partial<T>} An object containing only the fields from `data` that are not empty and have changed compared to `originalData`.
 *
 * @example
 * const data = { name: "Alice", age: 25, city: "" };
 * const original = { name: "Alice", age: 20, city: "Paris" };
 * filterChangedData(data, original); // Returns: { age: 25 }
 */
export const filterChangedData = <T>(data: Partial<T>, originalData?: Partial<T>) =>
  Object.entries(data).reduce<Partial<T>>((acc, [key, value]) => {
    const isValueEmpty =
      typeof value === "string" ? isEmpty(value) : value === undefined || value === null;

    if (
      !isValueEmpty &&
      (!originalData ||
        originalData[key as keyof T] === undefined ||
        value !== originalData[key as keyof T])
    ) {
      acc[key as keyof T] = value as T[keyof T];
    }
    return acc;
  }, {});
