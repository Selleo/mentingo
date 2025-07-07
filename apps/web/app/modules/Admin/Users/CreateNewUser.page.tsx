import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import * as z from "zod";

import { useCreateUser } from "~/api/mutations/admin/useCreateUser";
import { ALL_COURSES_QUERY_KEY } from "~/api/queries/useCourses";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";
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
import { USER_ROLE } from "~/config/userRoles";
import { CreatePageHeader } from "~/modules/Admin/components";

const formSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters."),
  lastName: z.string().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  role: z.enum([USER_ROLE.admin, USER_ROLE.contentCreator, USER_ROLE.student], {
    required_error: "Please select a role.",
  }),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateNewUserPage() {
  const { mutateAsync: createUser } = useCreateUser();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      role: USER_ROLE.student,
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

  const backButton = { title: t("adminUsersView.breadcrumbs.back"), href: "/admin/users" };

  return (
    <PageWrapper breadcrumbs={breadcrumbs} backButton={backButton} isBarebones>
      <div className="flex flex-col gap-y-6">
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
                  <Label htmlFor="firstName" className="text-right">
                    {t("adminUserView.field.firstName")}
                  </Label>
                  <FormControl>
                    <Input id="firstName" {...field} />
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
                  <Label htmlFor="lastName" className="text-right">
                    {t("adminUserView.field.lastName")}
                  </Label>
                  <FormControl>
                    <Input id="lastName" {...field} />
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
                  <Label htmlFor="email" className="text-right">
                    {t("adminUserView.field.email")}
                  </Label>
                  <FormControl>
                    <Input id="email" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="role" className="text-right">
                    {t("adminUserView.field.role")}
                  </Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger id="role">
                        <SelectValue placeholder={t("adminUserView.placeholder.role")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={USER_ROLE.student}>{t("common.roles.student")}</SelectItem>
                      <SelectItem value={USER_ROLE.admin}>{t("common.roles.admin")}</SelectItem>
                      <SelectItem value={USER_ROLE.contentCreator}>
                        {t("common.roles.contentCreator")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={!isFormValid}>
                {t("adminUserView.button.createUser")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
