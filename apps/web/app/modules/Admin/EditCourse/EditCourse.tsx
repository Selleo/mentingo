import { Link, useNavigate, useParams, useSearchParams } from "@remix-run/react";
import { COURSE_ORIGIN_TYPES, type SupportedLanguages } from "@repo/shared";
import { Building } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useExportMasterCourse } from "~/api/mutations/admin/useExportMasterCourse";
import useGenerateMissingTranslations from "~/api/mutations/admin/useGenerateMissingTranslations";
import { useBetaCourseById } from "~/api/queries/admin/useBetaCourse";
import { useMissingTranslations } from "~/api/queries/admin/useHasMissingTranslations";
import { useMasterCourseExportCandidates } from "~/api/queries/admin/useMasterCourseExportCandidates";
import { useAIConfigured } from "~/api/queries/useAIConfigured";
import { useStripeConfigured } from "~/api/queries/useStripeConfigured";
import { Icon } from "~/components/Icon";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { LeaveModalProvider } from "~/context/LeaveModalContext";
import { useTrackDataUpdatedAt } from "~/hooks/useTrackDataUpdatedAt";
import { useUserRole } from "~/hooks/useUserRole";
import { CourseLanguageSelector } from "~/modules/Admin/EditCourse/compontents/CourseLanguageSelector";
import { CourseEnrolled } from "~/modules/Admin/EditCourse/CourseEnrolled/CourseEnrolled";
import { useEditCourseTabs } from "~/modules/Admin/EditCourse/hooks/useEditCourseTabs";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { getCourseBadgeVariant } from "../Courses/utils";

import { SharedCourseExportsTabContent } from "./components/SharedCourseExportsTabContent";
import { SharedCourseReadonlyNotice } from "./components/SharedCourseReadonlyNotice";
import CourseLessons from "./CourseLessons/CourseLessons";
import CoursePricing from "./CoursePricing/CoursePricing";
import CourseSettings from "./CourseSettings/CourseSettings";
import CourseStatus from "./CourseStatus/CourseStatus";

import type { Chapter } from "./EditCourse.types";
import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.editCourse");

const EXPORTED_COURSE_VISIBLE_TAB_VALUES = ["Status", "Enrolled"];

const EditCourse = () => {
  const { t } = useTranslation();
  const { id } = useParams();

  const { data: isStripeConfigured } = useStripeConfigured();
  const { data: isAIConfigured } = useAIConfigured();
  const { isManagingTenantAdmin } = useUserRole();

  const { language } = useLanguageStore();

  const [courseLanguage, setCourseLanguage] = useState<SupportedLanguages>(language);

  const [openGenerateTranslationModal, setOpenGenerateTranslationModal] = useState(false);
  const [selectedTenantIds, setSelectedTenantIds] = useState<string[]>([]);
  const { mutateAsync: generateTranslations, isPending: isGenerationPending } =
    useGenerateMissingTranslations();
  const { mutateAsync: exportMasterCourse, isPending: isExportPending } = useExportMasterCourse();

  const [searchParams, setSearchParams] = useSearchParams();
  const courseTabs = useEditCourseTabs();
  const navigate = useNavigate();

  if (!id) throw new Error("Course ID not found");

  const {
    data: course,
    isFetching,
    isLoading,
    dataUpdatedAt,
    error,
  } = useBetaCourseById(id, courseLanguage);

  const { data: hasMissingTranslations } = useMissingTranslations(id, courseLanguage);
  const { data: exportCandidates } = useMasterCourseExportCandidates(id, isManagingTenantAdmin);
  const { previousDataUpdatedAt, currentDataUpdatedAt } = useTrackDataUpdatedAt(dataUpdatedAt);

  const hasMissingCourseTranslations =
    hasMissingTranslations?.data?.hasMissingTranslations ?? false;

  const { tenants: shareableTenants = [], summary } = exportCandidates ?? {};
  const { remainingCount } = summary ?? { remainingCount: 0 };

  const canExportMore = remainingCount > 0;

  const validSelectedTenantIds = useMemo(
    () =>
      selectedTenantIds.filter((tenantId) => {
        const selectedTenant = shareableTenants.find((tenant) => tenant.id === tenantId);
        return Boolean(selectedTenant) && !selectedTenant?.isExported;
      }),
    [selectedTenantIds, shareableTenants],
  );

  const sharedCourseNotice = useMemo(
    () => ({
      title: t("adminCourseView.sharedCourse.exportedNoticeTitle"),
      description: t("adminCourseView.sharedCourse.exportedNoticeDescription"),
    }),
    [t],
  );

  useEffect(() => {
    if (!isFetching && !course?.availableLocales.includes(courseLanguage)) {
      setCourseLanguage(course?.baseLanguage ?? language);
    }
  }, [language, courseLanguage, course, isFetching]);

  const handleTabChange = useCallback(
    (tabValue: string) => {
      setSearchParams((prevParams) => {
        const nextParams = new URLSearchParams(prevParams);
        nextParams.set("tab", tabValue);
        return nextParams;
      });
    },
    [setSearchParams],
  );

  const handleGenerate = useCallback(async () => {
    await generateTranslations({ courseId: id, language: courseLanguage });
    setOpenGenerateTranslationModal(false);
  }, [courseLanguage, generateTranslations, id]);

  const handleExport = useCallback(async () => {
    if (!validSelectedTenantIds.length) return;
    await exportMasterCourse({ courseId: id, targetTenantIds: validSelectedTenantIds });
    setSelectedTenantIds([]);
  }, [exportMasterCourse, id, validSelectedTenantIds]);

  const toggleTenantSelection = useCallback((tenantId: string, checked: boolean) => {
    setSelectedTenantIds((prev) => {
      if (!checked) return prev.filter((idToKeep) => idToKeep !== tenantId);
      if (prev.includes(tenantId)) return prev;
      return [...prev, tenantId];
    });
  }, []);

  const canRefetchChapterList = Boolean(
    previousDataUpdatedAt && currentDataUpdatedAt && previousDataUpdatedAt < currentDataUpdatedAt,
  );

  const selectedTab = searchParams.get("tab") ?? EXPORTED_COURSE_VISIBLE_TAB_VALUES[0];

  const { isExportedCourse, isMasterCourse } = useMemo(() => {
    const isExportedCourse = course?.originType === COURSE_ORIGIN_TYPES.EXPORTED;
    const isMasterCourse = course?.originType === COURSE_ORIGIN_TYPES.MASTER;

    return { isExportedCourse, isMasterCourse };
  }, [course]);

  const { visibleCourseTabs, activeTab } = useMemo(() => {
    const visibleCourseTabs = isExportedCourse
      ? courseTabs.filter((tab) => EXPORTED_COURSE_VISIBLE_TAB_VALUES.includes(tab.value))
      : courseTabs;

    const activeTab = visibleCourseTabs.some((tab) => tab.value === selectedTab)
      ? selectedTab
      : EXPORTED_COURSE_VISIBLE_TAB_VALUES[0];

    return { visibleCourseTabs, activeTab };
  }, [courseTabs, isExportedCourse, selectedTab]);

  useEffect(() => {
    if (error) {
      navigate("/");
    }
  }, [error, navigate]);

  if (error) return null;

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="size-32 animate-spin rounded-full border-b-2 border-t-2 border-gray-900"></div>
      </div>
    );
  }

  const breadcrumbs = [
    { title: t("adminCourseView.breadcrumbs.courses"), href: "/admin/courses" },
    { title: course?.title || "", href: `/admin/beta-courses/${id}` },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <Tabs value={activeTab} className="flex h-full flex-col gap-y-4">
        <div className="flex w-full flex-col gap-y-4 rounded-lg border border-gray-200 bg-white px-8 py-6 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="h4 flex items-center text-neutral-950 mr-2">
              {course?.title || ""}

              {course?.status === "published" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                  icon="Success"
                >
                  {t("common.other.published")}
                </Badge>
              )}
              {course?.status === "draft" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                  icon="Warning"
                >
                  {t("common.other.draft")}
                </Badge>
              )}
              {course?.status === "private" && (
                <Badge
                  variant={getCourseBadgeVariant(course?.status)}
                  fontWeight="bold"
                  className="ml-2"
                >
                  {t("common.other.private")}
                </Badge>
              )}
              {isMasterCourse && (
                <Badge variant="secondaryWithOutline" fontWeight="bold" className="ml-2">
                  <Building className="size-3.5" />
                  {t("adminCourseView.sharedCourse.badgeMaster")}
                </Badge>
              )}
              {isExportedCourse && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Badge variant="secondaryWithOutline" fontWeight="bold" className="ml-2">
                        <Building className="size-3.5" />
                        {t("adminCourseView.sharedCourse.badgeExported")}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {t("adminCourseView.sharedCourse.badgeExportedTooltip")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </h4>

            <div className="flex gap-4 items-center">
              {!isExportedCourse && (
                <>
                  <div className="flex gap-2 items-center">
                    <CourseLanguageSelector
                      courseLanguage={courseLanguage}
                      course={
                        course && {
                          id: course.id,
                          baseLanguage: course.baseLanguage,
                          availableLocales: course.availableLocales,
                        }
                      }
                      isAIConfigured={isAIConfigured?.enabled ?? false}
                      onChange={setCourseLanguage}
                      setOpenGenerateTranslationModal={setOpenGenerateTranslationModal}
                    />

                    {hasMissingCourseTranslations && isAIConfigured?.enabled && (
                      <Dialog
                        open={openGenerateTranslationModal}
                        onOpenChange={setOpenGenerateTranslationModal}
                      >
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-2">
                            <Icon name="AiMentor" className="size-4" />
                            {t("adminCourseView.common.generateMissingTranslations")}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogTitle>
                            {t("adminCourseView.common.generateMissingTranslations")}
                          </DialogTitle>
                          <DialogDescription>
                            {t("adminCourseView.common.generateMissingTranslationsDescription")}
                          </DialogDescription>
                          <DialogFooter>
                            <DialogTrigger asChild>
                              <Button variant="outline">
                                {t("contentCreatorView.button.cancel")}
                              </Button>
                            </DialogTrigger>
                            <Button
                              type="button"
                              onClick={handleGenerate}
                              disabled={isGenerationPending}
                            >
                              {isGenerationPending ? (
                                <span className="flex items-center gap-2">
                                  <span className="size-4 border-2 border-t-2 border-gray-300 border-t-gray-900 rounded-full animate-spin"></span>
                                  {t("contentCreatorView.button.confirm")}
                                </span>
                              ) : (
                                t("contentCreatorView.button.confirm")
                              )}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>

                  <Separator orientation="vertical" className="h-10" decorative />
                </>
              )}

              <Button
                asChild
                className="border border-neutral-200 bg-transparent text-accent-foreground"
              >
                <Link to={`/course/${course?.id}?language=${courseLanguage}`}>
                  <Icon name="Eye" className="mr-2" />
                  {t("adminCourseView.common.preview")}
                </Link>
              </Button>
            </div>
          </div>
          <TabsList className="w-min">
            {visibleCourseTabs.map(({ label, value }) => (
              <TabsTrigger key={value} value={value} onClick={() => handleTabChange(value)}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="Settings">
          {isExportedCourse ? (
            <SharedCourseReadonlyNotice
              title={sharedCourseNotice.title}
              description={sharedCourseNotice.description}
            />
          ) : (
            <CourseSettings
              key={`${course?.id}-${courseLanguage}`}
              authorId={course?.authorId || ""}
              courseId={course?.id || ""}
              title={course?.title}
              description={course?.description}
              categoryId={course?.categoryId}
              thumbnailS3SingedUrl={course?.thumbnailS3SingedUrl}
              thumbnailS3Key={course?.thumbnailS3Key}
              trailerUrl={course?.trailerUrl}
              hasCertificate={course?.hasCertificate || false}
              courseLanguage={courseLanguage}
            />
          )}
        </TabsContent>
        <TabsContent value="Curriculum" className="h-full">
          {isExportedCourse ? (
            <SharedCourseReadonlyNotice
              title={sharedCourseNotice.title}
              description={sharedCourseNotice.description}
            />
          ) : (
            <LeaveModalProvider>
              <CourseLessons
                chapters={course?.chapters as Chapter[]}
                canRefetchChapterList={!!canRefetchChapterList}
                language={courseLanguage}
                baseLanguage={course?.baseLanguage ?? courseLanguage}
              />
            </LeaveModalProvider>
          )}
        </TabsContent>
        {isMasterCourse && isStripeConfigured?.enabled && (
          <TabsContent value="Pricing">
            <CoursePricing
              courseId={course?.id || ""}
              currency={course?.currency}
              priceInCents={course?.priceInCents}
              language={language}
            />
          </TabsContent>
        )}
        <TabsContent value="Status">
          <CourseStatus
            courseId={course?.id || ""}
            status={course?.status || "draft"}
            language={language}
          />
        </TabsContent>
        <TabsContent value="Enrolled">
          <CourseEnrolled />
        </TabsContent>
        {isManagingTenantAdmin && (
          <TabsContent value="Exports">
            <SharedCourseExportsTabContent
              tenants={shareableTenants}
              selectedTenantIds={validSelectedTenantIds}
              canExportMore={canExportMore}
              isExportPending={isExportPending}
              onToggleTenantSelection={toggleTenantSelection}
              onExport={handleExport}
            />
          </TabsContent>
        )}
      </Tabs>
    </PageWrapper>
  );
};

export default EditCourse;
