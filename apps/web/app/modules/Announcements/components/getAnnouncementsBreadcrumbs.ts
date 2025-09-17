import type i18next from "i18next";

export const getAnnouncementsPageBreadcrumbs = (t: typeof i18next.t, isCreate = false) => {
  const baseBreadcrumbs = [
    { title: t("announcements.breadcrumbs.dashboard"), href: "/" },
    {
      title: t("announcements.breadcrumbs.announcements"),
      href: "/announcements",
    },
  ];

  return isCreate
    ? [
        ...baseBreadcrumbs,
        {
          title: t("announcements.breadcrumbs.createAnnouncement"),
          href: "/admin/announcements/new",
        },
      ]
    : baseBreadcrumbs;
};
