import { useTranslation } from "react-i18next";

import { useRichTextContentPolicy } from "~/components/RichText/contentPolicyContext";
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
  const safeContent = filter
    ? filter(resolved)
    : restrictAuthoringMedia(
        resolved,
        buildAuthoringMediaPolicy([trustedContent], assetPreviewUrls),
        t("courseAuthoring.review.mediaPreviewBlocked"),
      );
  return <ContentViewer content={safeContent} className={className} />;
};
