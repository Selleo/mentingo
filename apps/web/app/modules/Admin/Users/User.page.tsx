import { useParams } from "@remix-run/react";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "@repo/shared";
import { startCase } from "lodash-es";
import { UserCircle2 } from "lucide-react";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useAdminUpdateUser } from "~/api/mutations/admin/useAdminUpdateUser";
import { userQueryOptions, useUserById } from "~/api/queries/admin/useUserById";
import { ENROLLED_USERS_QUERY_KEY } from "~/api/queries/admin/useUsersEnrolled";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { PermissionsMatrix } from "~/modules/Admin/Users/components/PermissionsMatrix";
import { buildPermissionsUnionForRoleSlugs } from "~/modules/Admin/Users/utils/permissionsMatrix";
import Loader from "~/modules/common/Loader/Loader";
import { setPageTitle } from "~/utils/setPageTitle";

import { USER_PAGE_HANDLES } from "../../../../e2e/data/users/handles";

import { UserInfo } from "./components/UserInfo";

import type { MetaFunction } from "@remix-run/react";
import type { PermissionKey } from "@repo/shared";
import type { UpdateUserBody } from "~/api/generated-api";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.userDetails");

const displayedFields: Array<keyof UpdateUserBody> = [
  "firstName",
  "lastName",
  "email",
  "roleSlugs",
  "groups",
  "archived",
];

const User = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();

  if (!id) throw new Error(t("adminUserView.error.userNotFound"));

  const { data: user, isLoading } = useUserById(id);
  const { mutateAsync: updateUser } = useAdminUpdateUser();

  const {
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<UpdateUserBody>();

  const permissionsOrder = useMemo(() => Object.values(PERMISSIONS) as PermissionKey[], []);

  const userRoleSlugs = useMemo(() => user?.roleSlugs ?? [], [user]);

  const userPermissionsUnion = useMemo(
    () =>
      buildPermissionsUnionForRoleSlugs({
        roleSlugs: userRoleSlugs,
        permissionsByRoleSlug: SYSTEM_ROLE_PERMISSIONS,
        permissionsOrder,
      }),
    [permissionsOrder, userRoleSlugs],
  );

  const permissionsRole = useMemo(
    () => [
      {
        slug: "effective",
        label: t("adminUserView.permissions.effective"),
        permissions: userPermissionsUnion,
      },
    ],
    [t, userPermissionsUnion],
  );

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!user) throw new Error(t("adminUserView.error.userNotFound"));

  const onSubmit = (data: UpdateUserBody) => {
    updateUser({ data, userId: id }).then(() => {
      queryClient.invalidateQueries(userQueryOptions(id));
      queryClient.invalidateQueries({ queryKey: [ENROLLED_USERS_QUERY_KEY], exact: false });
    });
  };

  const breadcrumbs = [
    { title: t("adminUserView.breadcrumbs.users"), href: "/admin/users" },
    { title: t("adminUserView.breadcrumbs.userDetails"), href: `/admin/users/${id}` },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6" data-testid={USER_PAGE_HANDLES.PAGE}>
        <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-neutral-900">
                <UserCircle2 className="size-7 text-primary-700" />
                <h2 className="h4 text-neutral-950">
                  {user.firstName} {user.lastName}
                </h2>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                data-testid={USER_PAGE_HANDLES.STATUS_BADGE}
                variant={user.archived ? "outline" : "secondary"}
                className="capitalize"
              >
                {user.archived ? t("common.other.archived") : t("common.other.active")}
              </Badge>
            </div>
          </div>
        </div>
        <Tabs defaultValue="information" className="w-full">
          <TabsList className="h-auto rounded-lg border bg-neutral-50 p-1">
            <TabsTrigger data-testid={USER_PAGE_HANDLES.INFORMATION_TAB} value="information">
              {t("adminUserView.tabs.information")}
            </TabsTrigger>
            <TabsTrigger data-testid={USER_PAGE_HANDLES.PERMISSIONS_TAB} value="permissions">
              {t("adminUserView.tabs.permissions")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="information" className="pt-4">
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="rounded-xl border bg-background p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="h5 text-neutral-950">{t("adminUserView.editUserHeader")}</h3>
                </div>
                <Button
                  data-testid={USER_PAGE_HANDLES.SAVE_BUTTON}
                  type="submit"
                  disabled={!isDirty}
                  className="min-w-28"
                >
                  {t("common.button.save")}
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {displayedFields.map((field) => (
                  <div key={field} className={field === "email" ? "md:col-span-2" : ""}>
                    <Label className="mb-2 inline-block text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      {field === "archived"
                        ? t("adminUserView.field.status")
                        : field === "roleSlugs"
                          ? t("adminUsersView.dropdown.roles")
                          : startCase(t(`adminUserView.field.${field}`))}
                    </Label>
                    <UserInfo name={field} control={control} isEditing user={user} />
                  </div>
                ))}
              </div>
            </form>
          </TabsContent>
          <TabsContent value="permissions" className="pt-4">
            <div className="rounded-xl border bg-background p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <h3 className="h5 text-neutral-950">{t("adminUserView.permissions.title")}</h3>
                </div>
              </div>
              <PermissionsMatrix roles={permissionsRole} permissionsOrder={permissionsOrder} />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default User;
