import { Link } from "@remix-run/react";
import { PERMISSIONS } from "@repo/shared";
import { ArrowRight, Store } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useContentMarketplaceConfiguration } from "~/api/queries/useContentMarketplaceConfiguration";
import { buttonVariants } from "~/components/ui/button";
import { usePermissions } from "~/hooks/usePermissions";

import { COURSES_INLINE_EDIT_HANDLES } from "../../../../e2e/data/courses/handles";
import { CONTENT_MARKETPLACE_PATH } from "../contentMarketplace.constants";

/** Catalog entry point for users who may browse an enabled marketplace. */
export function ContentMarketplaceCoursesRow() {
  const { t } = useTranslation();
  const { hasAccess: canBrowse } = usePermissions({
    required: PERMISSIONS.CONTENT_MARKETPLACE_BROWSE,
  });
  const { data: configuration, isError } = useContentMarketplaceConfiguration(canBrowse);

  if (!canBrowse || isError || !configuration?.enabled) return null;

  return (
    <section className="pb-6" data-testid={COURSES_INLINE_EDIT_HANDLES.MARKETPLACE_ROW}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 md:px-8">
        <h2 className="h2 flex items-center gap-3 text-2xl leading-snug md:text-[32px] md:leading-relaxed">
          <Store className="size-6 shrink-0 text-primary-700 md:size-7" aria-hidden />
          {t("contentMarketplace.title")}
        </h2>
        <Link
          to={CONTENT_MARKETPLACE_PATH}
          className={buttonVariants({ variant: "outline" })}
          data-testid={COURSES_INLINE_EDIT_HANDLES.MARKETPLACE_BROWSE_ALL}
        >
          {t("contentMarketplace.browseAll")}
          <ArrowRight className="ml-2 size-4" aria-hidden />
        </Link>
      </div>
    </section>
  );
}
