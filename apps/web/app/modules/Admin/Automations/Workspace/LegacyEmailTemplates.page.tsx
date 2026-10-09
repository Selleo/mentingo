import { redirect } from "@remix-run/react";

export const clientLoader = ({ request }: { request: Request }) => {
  const params = new URL(request.url).searchParams;

  params.set("tab", "email-templates");

  return redirect(`/admin/automations?${params.toString()}`);
};

export default function LegacyEmailTemplatesPage() {
  return null;
}
