import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { useCreateTenant } from "~/api/mutations/super-admin/useCreateTenant";
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

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().url("Host must be a valid URL"),
  status: z.enum(["active", "inactive"]).default("active"),
  adminEmail: z.string().email("Admin email is required"),
  adminFirstName: z.string().optional(),
  adminLastName: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const { mutateAsync: createTenant } = useCreateTenant();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "",
      status: "active",
      adminEmail: "",
      adminFirstName: "",
      adminLastName: "",
    },
  });

  const onSubmit = async (values: FormValues) => {
    await createTenant({
      data: {
        name: values.name,
        host: values.host,
        status: values.status,
        adminEmail: values.adminEmail,
        adminFirstName: values.adminFirstName || undefined,
        adminLastName: values.adminLastName || undefined,
      },
    });

    queryClient.invalidateQueries({ queryKey: ["superAdminTenants"] });
    navigate("/super-admin/tenants");
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-y-6">
        <div>
          <h1 className="text-xl font-semibold">Create Tenant</h1>
          <p className="text-sm text-muted-foreground">
            Create a new tenant and invite the first admin.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="name">Tenant Name</Label>
                  <FormControl>
                    <Input id="name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="host">Tenant Host (full URL)</Label>
                  <FormControl>
                    <Input id="host" placeholder="https://tenant.example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <Label>Status</Label>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="adminFirstName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="adminFirstName">Admin First Name</Label>
                    <FormControl>
                      <Input id="adminFirstName" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminLastName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="adminLastName">Admin Last Name</Label>
                    <FormControl>
                      <Input id="adminLastName" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="adminEmail">Admin Email</Label>
                  <FormControl>
                    <Input id="adminEmail" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button type="submit">Create Tenant</Button>
            </div>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
