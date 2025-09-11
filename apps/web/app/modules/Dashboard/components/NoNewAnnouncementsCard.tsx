import { useTranslation } from "react-i18next";

import { Icon } from "~/components/Icon";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

interface NoNewAnnouncementsCardProps {
  setIsVisible: (value: boolean) => void;
}

export default function NoNewAnnouncementsCard({ setIsVisible }: NoNewAnnouncementsCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="mx-1 md:mx-4">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-primary-100 p-2">
              <Icon name="Megaphone" className="text-primary-800" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              className="grid size-10 place-items-center rounded-lg border border-neutral-900 p-2"
              onClick={() => setIsVisible(false)}
            >
              <Icon name="X" className="text-neutral-950" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="body-sm-md md:body-base-md text-neutral-800">
          {t("announcements.other.noNewAnnouncements")}
        </p>
      </CardContent>
    </Card>
  );
}
