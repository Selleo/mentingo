import { Plus } from "lucide-react";

interface AutomationHeaderProps {
  onCreate: () => void;
}

export const AutomationHeader: React.FC<AutomationHeaderProps> = ({ onCreate }) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Automations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Zarządzaj automatycznymi powiadomieniami email wysyłanymi w odpowiedzi na zdarzenia w
          platformie.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        <Plus className="w-4 h-4" />
        Create Automation
      </button>
    </div>
  );
};
