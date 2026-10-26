import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { Store } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useContentMarketplaceConfiguration } from "~/api/queries/useContentMarketplaceConfiguration";
import { Button } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";
import { cn } from "~/lib/utils";

import { CONTENT_MARKETPLACE_PATH } from "../contentMarketplace.constants";

type ContentMarketplaceLinkProps = {
  className?: string;
  buttonClassName?: string;
};

/** Opens the content marketplace; hidden unless the user may browse it and it is enabled. */
export function ContentMarketplaceLink({
  className,
  buttonClassName,
}: ContentMarketplaceLinkProps) {
  const { t } = useTranslation();
  const { hasAccess: canBrowse } = usePermissions({
    required: PERMISSIONS.CONTENT_MARKETPLACE_BROWSE,
  });
  const { data: configuration, isError } = useContentMarketplaceConfiguration(canBrowse);

  if (!canBrowse || isError || !configuration?.enabled) return null;

  return (
    <Link to={CONTENT_MARKETPLACE_PATH} className={className}>
      <Button variant="outline" className={cn("w-full whitespace-nowrap", buttonClassName)}>
        <Store className="mr-2 size-5" aria-hidden />
        {t("contentMarketplace.title")}
      </Button>
    </Link>
  );
}
