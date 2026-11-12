import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useListedRowSelection } from "../useListedRowSelection";

describe("useListedRowSelection", () => {
  it("keeps selected rows that are still listed after the rows change", () => {
    const { result, rerender } = renderHook(({ rowIds }) => useListedRowSelection(rowIds), {
      initialProps: { rowIds: ["first", "second", "third"] },
    });

    act(() => result.current[1]({ first: true, second: true }));
    rerender({ rowIds: ["second", "fourth"] });

    expect(result.current[0]).toEqual({ second: true });
  });

  it("keeps a selection made before the listed rows load", () => {
    const { result, rerender } = renderHook(({ rowIds }) => useListedRowSelection(rowIds), {
      initialProps: { rowIds: ["first", "second"] },
    });

    act(() => result.current[1]({ second: true }));
    rerender({ rowIds: ["second"] });

    expect(result.current[0]).toEqual({ second: true });
  });
});
