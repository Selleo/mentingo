import { useTranslation } from "react-i18next";

import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { RequiredTick } from "~/modules/Admin/Groups/components/RequiredTick";

import type { UseFormReturn } from "react-hook-form";
import type { GroupFormValues } from "~/modules/Admin/Groups/group.utils";

interface CreateGroupProps {
  form: UseFormReturn<GroupFormValues>;
  handleSubmit: (group: GroupFormValues) => Promise<void>;
}

const CreateGroupCard = ({ form, handleSubmit }: CreateGroupProps) => {
  const { t } = useTranslation();
  return (
    <section className="mt-4 flex w-full grow flex-col gap-y-6 rounded-lg bg-white p-6 drop-shadow">
      <div className="flex flex-col gap-1">
        <h4 className="h4 text-neutral-950">{t("adminGroupsView.newGroup.card.header")}</h4>
        <p className="body-base text-neutral-900">{t("adminGroupsView.newGroup.card.subheader")}</p>
      </div>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="flex grow flex-col space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <Label htmlFor="name" className="text">
                  <RequiredTick />
                  {t("adminGroupsView.newGroup.fields.name")}
                </Label>
                <FormControl>
                  <Input id="name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="characteristic"
            render={({ field }) => (
              <FormItem className="grow">
                <Label htmlFor="characteristic" className="text">
                  <RequiredTick />
                  {t("adminGroupsView.newGroup.fields.characteristic")}
                </Label>
                <FormControl>
                  <Textarea id="characteristic" {...field} className="h-full resize-none" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
      <span className="body-base text-neutral-800">
        {t("adminGroupsView.newGroup.card.footer")}
      </span>
    </section>
  );
};
export default CreateGroupCard;
