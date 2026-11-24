import { useTranslation } from "react-i18next";

import {
  RichTextAuthoringAssetUrlsContext,
  RichTextMediaUrlsContext,
  useRichTextContentPolicy,
} from "~/components/RichText/contentPolicyContext";
import { ContentViewer } from "~/components/RichText/Viever";

import { withAuthoringAssetPreviewUrls } from "./authoringAssetPreview";
import { buildAuthoringMediaPolicy, restrictAuthoringMedia } from "./authoringMediaPolicy";

type Props = {
  content: string;
  className?: string;
  trustedContent?: string;
  assetPreviewUrls?: Readonly<Record<string, string>>;
};

export const AuthoringContentPreview = ({
  content,
  className,
  assetPreviewUrls = {},
  trustedContent = "",
}: Props) => {
  const { t } = useTranslation();
  const filter = useRichTextContentPolicy();
  const resolved = withAuthoringAssetPreviewUrls(content, assetPreviewUrls);
  const localPolicy = buildAuthoringMediaPolicy([trustedContent], assetPreviewUrls);
  const safeContent = filter
    ? filter(resolved)
    : restrictAuthoringMedia(
        resolved,
        localPolicy,
        t("courseAuthoring.review.mediaPreviewBlocked"),
      );
  const viewer = <ContentViewer content={safeContent} className={className} />;
  return filter ? (
    viewer
  ) : (
    <RichTextMediaUrlsContext.Provider value={localPolicy.urls}>
      <RichTextAuthoringAssetUrlsContext.Provider value={assetPreviewUrls}>
        {viewer}
      </RichTextAuthoringAssetUrlsContext.Provider>
    </RichTextMediaUrlsContext.Provider>
  );
};
