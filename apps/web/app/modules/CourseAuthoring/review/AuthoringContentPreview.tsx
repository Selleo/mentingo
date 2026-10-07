import { ContentViewer } from "~/components/RichText/Viever";

import { withAuthoringAssetPreviewUrls } from "./authoringAssetPreview";

type Props = {
  content: string;
  className?: string;
  assetPreviewUrls?: Readonly<Record<string, string>>;
};

/** Keep staged image nodes in place while their protected preview files load. */
export const AuthoringContentPreview = ({ content, className, assetPreviewUrls = {} }: Props) => (
  <ContentViewer
    content={withAuthoringAssetPreviewUrls(content, assetPreviewUrls)}
    className={className}
  />
);
