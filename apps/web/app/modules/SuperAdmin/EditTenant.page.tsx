import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import { useUpdateTenant } from "~/api/mutations/super-admin/useUpdateTenant";
import { useTenant } from "~/api/queries/super-admin/useTenant";
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
  status: z.enum(["active", "inactive"]),
});

type FormValues = z.infer<typeof formSchema>;

export default function EditTenantPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const tenantId = id || "";
  const { data, isLoading } = useTenant(tenantId);
  const { mutateAsync: updateTenant } = useUpdateTenant();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      host: "",
      status: "active",
    },
  });

  useEffect(() => {
    if (!data?.data) return;
    form.reset({
      name: data.data.name,
      host: data.data.host,
      status: data.data.status as "active" | "inactive",
    });
  }, [data, form]);

  const onSubmit = async (values: FormValues) => {
    await updateTenant({
      id: tenantId,
      data: {
        name: values.name,
        host: values.host,
        status: values.status,
      },
    });

    queryClient.invalidateQueries({ queryKey: ["superAdminTenants"] });
    navigate("/super-admin/tenants");
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-y-6">
        <div>
          <h1 className="text-xl font-semibold">Edit Tenant</h1>
          <p className="text-sm text-muted-foreground">Update tenant details and status.</p>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading tenant...</div>
        ) : (
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
                      <Input id="host" {...field} />
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

              <div className="flex justify-end">
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </PageWrapper>
  );
}
