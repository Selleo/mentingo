import { useTranslation } from "react-i18next";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";

import { SETTINGS_PAGE_HANDLES } from "../../../../../../e2e/data/settings/handles";

const PREVIEW_TABS = { overview: "overview", lessons: "lessons" } as const;
const PREVIEW_PROGRESS_PERCENT = 60;

export const OrganizationThemePreview = () => {
  const { t } = useTranslation();

  return (
    <section
      aria-label={t("organizationTheme.preview.title")}
      className="flex h-full flex-col rounded-xl border border-neutral-200 bg-primary-50 p-6"
      data-testid={SETTINGS_PAGE_HANDLES.THEME_PREVIEW}
    >
      <div className="flex flex-1 items-center">
        <div className="flex w-full flex-col gap-5 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col">
              <p className="body-base-md text-neutral-950">
                <span className="uppercase text-neutral-500">
                  [{t("organizationTheme.preview.title")}]
                </span>{" "}
                {t("organizationTheme.preview.courseTitle")}
              </p>
              <p className="body-sm text-neutral-600">
                {t("organizationTheme.preview.courseDetails")}
              </p>
            </div>
            <Badge variant="secondaryWithOutline">{t("organizationTheme.preview.badge")}</Badge>
          </div>
          <Tabs defaultValue={PREVIEW_TABS.overview}>
            <TabsList>
              <TabsTrigger value={PREVIEW_TABS.overview}>
                {t("organizationTheme.preview.overviewTab")}
              </TabsTrigger>
              <TabsTrigger value={PREVIEW_TABS.lessons}>
                {t("organizationTheme.preview.lessonsTab")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-1.5">
            <div className="body-sm flex justify-between">
              <span className="text-neutral-600">{t("organizationTheme.preview.progress")}</span>
              <span className="body-sm-md text-primary-700">{PREVIEW_PROGRESS_PERCENT}%</span>
            </div>
            <Progress value={PREVIEW_PROGRESS_PERCENT} className="h-2" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" size="sm">
              {t("organizationTheme.preview.primaryButton")}
            </Button>
            <Button type="button" size="sm" variant="outline">
              {t("organizationTheme.preview.outlineButton")}
            </Button>
            <span className="body-sm-md text-primary-700 underline-offset-4 hover:underline">
              {t("organizationTheme.preview.link")}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
