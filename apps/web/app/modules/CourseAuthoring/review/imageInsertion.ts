/** Projects structured image insertion without accepting replacement lesson prose. */
import type { AuthoringOperation } from "../courseAuthoring.types";

/** Builds the same escaped figure and asset marker used by native application. */
export const imageInsertionFigure = (payload: AuthoringOperation["payload"]): string => {
  if (
    typeof payload.assetId !== "string" ||
    typeof payload.anchorBlockId !== "string" ||
    typeof payload.altText !== "string" ||
    (payload.caption !== null && typeof payload.caption !== "string") ||
    (payload.position !== "before" && payload.position !== "after")
  )
    throw new Error("courseAuthoring.errors.invalidOperations");
  const document = new DOMParser().parseFromString("<figure><img></figure>", "text/html");
  const figure = document.body.firstElementChild;
  const image = figure?.querySelector("img");
  if (!figure || !image) throw new Error("courseAuthoring.errors.invalidOperations");
  figure.setAttribute("data-authoring-block-id", payload.assetId);
  image.setAttribute("data-authoring-asset-id", payload.assetId);
  image.setAttribute("src", `authoring-asset:${payload.assetId}`);
  image.setAttribute("alt", payload.altText);
  if (payload.caption !== null) {
    const caption = document.createElement("figcaption");
    caption.textContent = payload.caption;
    figure.append(caption);
  }
  return figure.outerHTML;
};

/** Requires an existing unique top-level anchor and preserves every sibling node. */
export const applyImageInsertion = (
  html: string,
  payload: AuthoringOperation["payload"],
): string => {
  const figure = imageInsertionFigure(payload);
  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks = Array.from(document.body.children);
  const anchors = blocks.filter(
    (element) => element.getAttribute("data-authoring-block-id") === payload.anchorBlockId,
  );
  if (
    anchors.length !== 1 ||
    blocks.some((element) => element.getAttribute("data-authoring-block-id") === payload.assetId)
  )
    throw new Error("courseAuthoring.errors.invalidBlockTarget");
  anchors[0].insertAdjacentHTML(payload.position === "before" ? "beforebegin" : "afterend", figure);
  return document.body.innerHTML;
};
