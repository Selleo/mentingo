import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "@remix-run/react";
import { FORUM_POST_MAX_LENGTH, FORUM_TOPIC_TITLE_MAX_LENGTH } from "@repo/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";

import { useCreateForumTopic } from "~/api/mutations/useCreateForumTopic";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";

import { FORUM_HANDLES } from "../../../../e2e/data/forum/handles";

const createForumTopicFormSchema = z.object({
  title: z.string().trim().min(1).max(FORUM_TOPIC_TITLE_MAX_LENGTH),
  content: z.string().trim().min(1).max(FORUM_POST_MAX_LENGTH),
});

type CreateForumTopicFormValues = z.infer<typeof createForumTopicFormSchema>;

type CreateForumTopicDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateForumTopicDialog({ open, onOpenChange }: CreateForumTopicDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mutate: createTopic, isPending } = useCreateForumTopic();
  const form = useForm<CreateForumTopicFormValues>({
    resolver: zodResolver(createForumTopicFormSchema),
    defaultValues: { title: "", content: "" },
  });
  const [title, content] = form.watch(["title", "content"]);
  const canSubmit = Boolean(title.trim() && content.trim()) && !isPending;

  const handleSubmit = form.handleSubmit((values) => {
    createTopic(values, {
      onSuccess: (topic) => {
        form.reset();
        onOpenChange(false);
        navigate(`/forum/topics/${topic.id}`);
      },
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid={FORUM_HANDLES.CREATE_DIALOG}>
        <DialogHeader>
          <DialogTitle>{t("forum.createDialog.title")}</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="forum-topic-title">{t("forum.createDialog.titleLabel")}</Label>
            <Input
              id="forum-topic-title"
              maxLength={FORUM_TOPIC_TITLE_MAX_LENGTH}
              placeholder={t("forum.createDialog.titlePlaceholder")}
              data-testid={FORUM_HANDLES.TITLE_INPUT}
              {...form.register("title")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="forum-topic-content">{t("forum.createDialog.contentLabel")}</Label>
            <Textarea
              id="forum-topic-content"
              rows={6}
              maxLength={FORUM_POST_MAX_LENGTH}
              placeholder={t("forum.createDialog.contentPlaceholder")}
              data-testid={FORUM_HANDLES.CONTENT_INPUT}
              {...form.register("content")}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.button.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit}
              data-testid={FORUM_HANDLES.CREATE_SUBMIT_BUTTON}
            >
              {t("forum.createDialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
