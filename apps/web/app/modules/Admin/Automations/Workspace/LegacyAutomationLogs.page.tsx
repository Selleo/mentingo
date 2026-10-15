import { redirect } from "@remix-run/react";

export const clientLoader = () => redirect("/admin/automations?tab=logs");

export default function LegacyAutomationLogsPage() {
  return null;
}
