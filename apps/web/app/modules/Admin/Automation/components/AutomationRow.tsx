import { Mail, CheckCircle, AlertTriangle, HelpCircle, Settings2 } from "lucide-react";

import { StatusBadge } from "./StatusBadge";

import type { Automation } from "../Automation.page";

interface AutomationRowProps {
  automation: Automation;
  onOpenDrawer: (automation: Automation) => void;
}

export const AutomationRow: React.FC<AutomationRowProps> = ({ automation, onOpenDrawer }) => {
  const renderLastRun = () => {
    const { date, status } = automation.lastRun;
    if (status === "never") {
      return (
        <span className="inline-flex items-center gap-1.5 text-sm text-gray-400">
          <HelpCircle className="w-4 h-4 text-gray-300" />
          Brak uruchomień
        </span>
      );
    }

    const isSuccess = status === "success";
    return (
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-900">
          {isSuccess ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          )}
          {date}
        </span>
        <span className="text-xs text-gray-400 pl-5.5">
          {isSuccess ? "Zakończone sukcesem" : "Wystąpił błąd"}
        </span>
      </div>
    );
  };

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-6 py-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-gray-900">{automation.name}</span>
          <span className="text-xs text-gray-500 mt-0.5 line-clamp-1">
            {automation.description}
          </span>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={automation.status} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-blue-50 text-blue-700 border border-blue-100">
          {automation.trigger}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-center">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
          <Mail className="w-3 h-3" />
          {automation.actionsCount} {automation.actionsCount === 1 ? "e-mail" : "e-maile"}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">{renderLastRun()}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{automation.updatedAt}</td>
      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
        <button
          onClick={() => onOpenDrawer(automation)}
          className="inline-flex items-center gap-1 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Zarządzaj
        </button>
      </td>
    </tr>
  );
};
