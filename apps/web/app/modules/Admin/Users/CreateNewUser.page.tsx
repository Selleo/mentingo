import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { useCreateUser } from "~/api/mutations/admin/useCreateUser";
import { useRoles } from "~/api/queries/admin/useRoles";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import MultipleSelector from "~/components/ui/multiselect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CreatePageHeader } from "~/modules/Admin/components";
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
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateNewUserPage() {
  const navigate = useNavigate();

  const { t } = useTranslation();

  const { data: adminsSettings } = useUserSettings();
  const { data: roles = [] } = useRoles();
  const { mutateAsync: createUser } = useCreateUser();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      roleSlugs: [],
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

  const breadcrumbs = [
    { title: t("adminUsersView.breadcrumbs.users"), href: "/admin/users" },
    { title: t("adminUsersView.breadcrumbs.createNew"), href: "/admin/users/new" },
  ];

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-y-6" data-testid={CREATE_USER_PAGE_HANDLES.PAGE}>
        <CreatePageHeader
          title={t("adminUserView.header")}
          description={t("adminUserView.subHeader")}
        />
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                <FormItem>
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
                  <Label htmlFor="role">{t("adminUsersView.dropdown.roles")}</Label>
                  <FormControl>
                    <MultipleSelector
                      testId={CREATE_USER_PAGE_HANDLES.ROLE_SELECT}
                      getOptionTestId={(option) =>
                        CREATE_USER_PAGE_HANDLES.roleOption(option.value)
                      }
                      value={(field.value ?? []).map((roleSlug) => ({
                        value: roleSlug,
                        label: getRoleLabel(roleSlug, t, roles),
                      }))}
                      options={roles.map((role) => ({
                        value: role.slug,
                        label: getRoleLabel(role.slug, t, roles),
                      }))}
                      onChange={(options) => field.onChange(options.map((option) => option.value))}
                      placeholder={t("adminUsersView.filters.placeholder.roles")}
                      hidePlaceholderWhenSelected
                      hideClearAllButton
                      className="w-full bg-background p-2"
                      badgeClassName="bg-accent text-accent-foreground text-sm hover:bg-accent"
                      commandProps={{
                        label: t("adminUsersView.filters.placeholder.roles"),
                      }}
                      inputProps={{
                        className: "w-full outline-none py-0 body-base",
                      }}
                      checkbox={false}
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
            <DialogFooter>
              <Button
                data-testid={CREATE_USER_PAGE_HANDLES.SUBMIT_BUTTON}
                type="submit"
                disabled={!isFormValid}
              >
                {t("adminUserView.button.createUser")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
