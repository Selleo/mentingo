import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthoringAssetPreviewUrls } from "./useAuthoringAssetPreviewUrls";

import type { PropsWithChildren } from "react";

const mocks = vi.hoisted(() => ({ previewAsset: vi.fn() }));

vi.mock("~/api/api-client", () => ({
  ApiClient: { api: { courseAuthoringControllerPreviewAuthoringAsset: mocks.previewAsset } },
}));

const assetId = "11111111-1111-4111-8111-111111111111";
const otherAssetId = "22222222-2222-4222-8222-222222222222";
const html =
  `<img data-authoring-asset-id="${assetId}" alt="Diagram">` +
  `<img data-authoring-asset-id="${otherAssetId}" alt="Not ready">`;
const createObjectUrl = vi.fn<(...args: Blob[]) => string>();
const revokeObjectUrl = vi.fn<(...args: string[]) => void>();

describe("useAuthoringAssetPreviewUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", { createObjectURL: createObjectUrl, revokeObjectURL: revokeObjectUrl });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads only referenced ready assets and revokes the blob URL on unmount", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    mocks.previewAsset.mockResolvedValue({ data: new Blob(["image"], { type: "image/png" }) });
    createObjectUrl.mockReturnValue("blob:preview-one");

    const { result, unmount } = renderHook(
      () =>
        useAuthoringAssetPreviewUrls({
          courseId: "course-1",
          sessionId: "session-1",
          html,
          readyAssetIds: [assetId],
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.urls[assetId]).toBe("blob:preview-one"));
    expect(mocks.previewAsset).toHaveBeenCalledTimes(1);
    expect(mocks.previewAsset).toHaveBeenCalledWith(
      "course-1",
      "session-1",
      assetId,
      { revision: 1 },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.current.urls[otherAssetId]).toBeUndefined();
    expect(result.current.loadingAssetIds).toEqual([]);
    expect(result.current.failedAssetIds).toEqual([]);

    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:preview-one");
    client.clear();
  });

  it("replaces and revokes a stale blob when the protected asset is refetched", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    mocks.previewAsset
      .mockResolvedValueOnce({ data: new Blob(["first"], { type: "image/png" }) })
      .mockResolvedValueOnce({ data: new Blob(["second"], { type: "image/png" }) });
    createObjectUrl.mockReturnValueOnce("blob:preview-one").mockReturnValueOnce("blob:preview-two");

    const { result, unmount } = renderHook(
      () =>
        useAuthoringAssetPreviewUrls({
          courseId: "course-1",
          sessionId: "session-1",
          html: `<img data-authoring-asset-id="${assetId}" alt="Diagram">`,
          readyAssetIds: [assetId],
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.urls[assetId]).toBe("blob:preview-one"));
    await act(async () => {
      await client.invalidateQueries({
        queryKey: ["course-authoring", "course-1", "session-1", "asset-preview", assetId, 1],
      });
    });
    await waitFor(() => expect(result.current.urls[assetId]).toBe("blob:preview-two"));
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:preview-one");

    unmount();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:preview-two");
    client.clear();
  });

  it("recovers a transient download failure automatically", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    mocks.previewAsset
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValue({ data: new Blob(["image"], { type: "image/png" }) });
    createObjectUrl.mockReturnValue("blob:recovered");

    const { result, unmount } = renderHook(
      () =>
        useAuthoringAssetPreviewUrls({
          courseId: "c",
          sessionId: "s",
          html,
          readyAssetIds: [assetId],
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.urls[assetId]).toBe("blob:recovered"), {
      timeout: 3000,
    });
    expect(mocks.previewAsset).toHaveBeenCalledTimes(2);
    expect(result.current.failedAssetIds).toEqual([]);
    unmount();
    client.clear();
  });

  it("exposes permanent failures and supports an explicit retry", async () => {
    const client = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const denied = new AxiosError("Forbidden", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 403,
    } as never);
    mocks.previewAsset
      .mockRejectedValueOnce(denied)
      .mockResolvedValue({ data: new Blob(["image"], { type: "image/png" }) });
    createObjectUrl.mockReturnValue("blob:retried");

    const { result, unmount } = renderHook(
      () =>
        useAuthoringAssetPreviewUrls({
          courseId: "c",
          sessionId: "s",
          html,
          readyAssetIds: [assetId],
        }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.failedAssetIds).toEqual([assetId]));
    expect(mocks.previewAsset).toHaveBeenCalledTimes(1);
    await act(() => result.current.retryFailedPreviews());
    await waitFor(() => expect(result.current.urls[assetId]).toBe("blob:retried"));
    expect(result.current.failedAssetIds).toEqual([]);
    unmount();
    client.clear();
  });
});
