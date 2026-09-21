import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { SUPPORTED_LANGUAGES, SYSTEM_ROLE_SLUGS } from "@repo/shared";
import { Info, UserPlus } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { useCreateUser } from "~/api/mutations/admin/useCreateUser";
import { useGroupsQuery } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { UserMultiSelect } from "~/modules/Admin/Users/components/UserMultiSelect";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";
import { setPageTitle } from "~/utils/setPageTitle";

import { CREATE_USER_PAGE_HANDLES } from "../../../../e2e/data/users/handles";

import type { MetaFunction } from "@remix-run/react";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createNewUser");

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  roleSlugs: z.array(z.string()).min(1, "Please select at least one role."),
  language: z.nativeEnum(SUPPORTED_LANGUAGES),
  managedGroupIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateNewUserPage() {
  const navigate = useNavigate();

  const { t } = useTranslation();

  const { data: adminsSettings } = useUserSettings();
  const { data: roles = [] } = useRoles();
  const { data: groups = [] } = useGroupsQuery({ language: adminsSettings?.language });
  const { mutateAsync: createUser } = useCreateUser();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleSlugs: [],
      managedGroupIds: [],
      language: adminsSettings?.language,
    },
  });

  const onSubmit = (values: FormValues) => {
    createUser({ data: values }).then(({ data }) => {
      queryClient.invalidateQueries({ queryKey: ALL_COURSES_QUERY_KEY });
      navigate(`/admin/users/${data.id}`);
    });
  };

  const isFormValid = form.formState.isValid;
  const selectedRoleSlugs = form.watch("roleSlugs");
  const isGroupManager = selectedRoleSlugs.includes(SYSTEM_ROLE_SLUGS.GROUP_MANAGER);

  const breadcrumbs = [
    { title: t("adminUsersView.breadcrumbs.users"), href: "/admin/users" },
    { title: t("adminUsersView.breadcrumbs.createNew"), href: "/admin/users/new" },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-y-6" data-testid={CREATE_USER_PAGE_HANDLES.PAGE}>
        <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
          <div className="flex items-center gap-2 text-neutral-900">
            <UserPlus className="size-7 text-primary-700" />
            <h2 className="h4 text-neutral-950">{t("adminUserView.header")}</h2>
          </div>
        </div>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="rounded-xl border bg-background p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="h5 text-neutral-950">{t("adminUserView.editUserHeader")}</h3>
              <Button
                data-testid={CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON}
                type="submit"
                disabled={!isFormValid}
                className="min-w-28"
              >
                {t("adminUserView.button.createUser")}
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="firstName">{t("adminUserView.field.firstName")}</Label>
                    <FormControl>
                      <Input
                        id="firstName"
                        data-testid={CREATE_USER_PAGE_HANDLES.FIRST_NAME_INPUT}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="lastName">{t("adminUserView.field.lastName")}</Label>
                    <FormControl>
                      <Input
                        id="lastName"
                        data-testid={CREATE_USER_PAGE_HANDLES.LAST_NAME_INPUT}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <Label htmlFor="email">{t("adminUserView.field.email")}</Label>
                    <FormControl>
                      <Input
                        id="email"
                        data-testid={CREATE_USER_PAGE_HANDLES.EMAIL_INPUT}
                        type="email"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleSlugs"
                render={({ field }) => (
                  <FormItem>
                    <Label>{t("adminUsersView.dropdown.roles")}</Label>
                    <FormControl>
                      <UserMultiSelect
                        testId={CREATE_USER_PAGE_HANDLES.ROLE_SELECT}
                        getOptionTestId={(option) =>
                          CREATE_USER_PAGE_HANDLES.roleOption(option.value)
                        }
                        value={field.value ?? []}
                        options={roles.map((role) => ({
                          value: role.slug,
                          label: getRoleLabel(role.slug, t, roles),
                        }))}
                        onChange={field.onChange}
                        placeholder={t("adminUsersView.filters.placeholder.roles")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="language">{t("adminUserView.field.language")}</Label>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger
                          id="language"
                          data-testid={CREATE_USER_PAGE_HANDLES.LANGUAGE_SELECT}
                        >
                          <SelectValue placeholder={t("adminUserView.placeholder.language")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(SUPPORTED_LANGUAGES).map((lang) => (
                          <SelectItem
                            key={lang}
                            value={lang}
                            data-testid={CREATE_USER_PAGE_HANDLES.languageOption(lang)}
                          >
                            {t(`common.languages.${lang}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {isGroupManager && (
              <section className="mt-6 border-t border-neutral-200 pt-5">
                <div className="mb-4 flex items-center gap-2">
                  <h4 className="h6 text-neutral-950">{t("adminUserView.field.managedGroups")}</h4>
                  <TooltipProvider delayDuration={0}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="rounded-full text-neutral-500 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          aria-label={t("adminUserView.managedGroupsTooltip")}
                        >
                          <Info className="size-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        {t("adminUserView.managedGroupsTooltip")}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormField
                  control={form.control}
                  name="managedGroupIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <UserMultiSelect
                          testId={CREATE_USER_PAGE_HANDLES.MANAGED_GROUPS_SELECT}
                          getOptionTestId={(option) =>
                            CREATE_USER_PAGE_HANDLES.managedGroupOption(option.value)
                          }
                          value={field.value ?? []}
                          options={groups.map((group) => ({
                            value: group.id,
                            label: group.name,
                          }))}
                          onChange={field.onChange}
                          placeholder={t("adminUserView.placeholder.managedGroups")}
                          emptyIndicator={<p>{t("adminGroupsView.groupSelect.noGroups")}</p>}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </section>
            )}
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
