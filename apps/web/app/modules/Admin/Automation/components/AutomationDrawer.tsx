import { X, Trash2, Save, Play, Square, Archive } from "lucide-react";
import { type FC, useState, useEffect } from "react";

import type { Automation } from "../Automation.page";

interface AutomationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  automation: Automation | null;
  onUpdate: (id: string, updatedFields: Partial<Automation>) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const AutomationDrawer: FC<AutomationDrawerProps> = ({
  isOpen,
  onClose,
  automation,
  onUpdate,
  onDelete,
  onEdit,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Automation["status"]>("Draft");

  useEffect(() => {
    if (automation) {
      setName(automation.name);
      setDescription(automation.description);
      setStatus(automation.status);
    }
  }, [automation]);

  if (!isOpen || !automation) return null;

  const handleSave = () => {
    onUpdate(automation.id, {
      name,
      description,
      status,
    });
    onClose();
  };

  const toggleActivation = () => {
    const nextStatus: Automation["status"] = status === "Enabled" ? "Disabled" : "Enabled";
    setStatus(nextStatus);
    onUpdate(automation.id, { status: nextStatus });
  };

  return (
    <div className="fixed inset-0 overflow-hidden z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 overflow-hidden">
        {/* 🟢 Dostępny dla lintera i czytników ekranu backdrop zamykający panel */}
        <button
          type="button"
          className="absolute inset-0 bg-gray-500 bg-opacity-75 transition-opacity border-none w-full h-full cursor-default"
          onClick={onClose}
          aria-label="Zamknij panel boczny"
        />

        <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10 sm:pl-16">
          <div className="pointer-events-auto w-screen max-w-md">
            <div className="flex h-full flex-col bg-white shadow-xl">
              {/* Nagłówek panelu */}
              <div className="bg-gray-50 px-4 py-6 sm:px-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium text-gray-900">Szczegóły automatyzacji</h2>
                  <div className="ml-3 flex h-7 items-center">
                    <button
                      type="button"
                      className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      onClick={onClose}
                    >
                      <span className="sr-only">Zamknij panel</span>
                      <X className="h-6 w-6" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Zawartość / Formularz */}
              <div className="relative flex-1 overflow-y-auto p-6 space-y-6">
                {/* Pole: Nazwa automatyzacji */}
                <div className="space-y-1">
                  <label
                    htmlFor="drawer-automation-name"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Nazwa automatyzacji
                  </label>
                  <input
                    id="drawer-automation-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>

                {/* Pole: Opis */}
                <div className="space-y-1">
                  <label
                    htmlFor="drawer-automation-desc"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Opis działania
                  </label>
                  <textarea
                    id="drawer-automation-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  />
                </div>

                {/* Pole: Status */}
                <div className="space-y-1">
                  <label
                    htmlFor="drawer-automation-status"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Status
                  </label>
                  <select
                    id="drawer-automation-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Automation["status"])}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
                  >
                    <option value="Draft">Szkic (Draft)</option>
                    <option value="Enabled">Aktywna (Enabled)</option>
                    <option value="Disabled">Nieaktywna (Disabled)</option>
                    <option value="Archived">Zarchiwizowana (Archived)</option>
                  </select>
                </div>

                <hr className="border-gray-200" />

                {/* Szybkie akcje statusu i edycji przepływu */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Zarządzanie przepływem
                  </p>

                  <button
                    type="button"
                    onClick={() => onEdit(automation.id)}
                    className="flex w-full items-center justify-center rounded-md bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 shadow-sm hover:bg-indigo-100 transition"
                  >
                    Otwórz kreator kroków
                  </button>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={toggleActivation}
                      disabled={status === "Archived"}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium shadow-sm transition disabled:opacity-50 ${
                        status === "Enabled"
                          ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                          : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      }`}
                    >
                      {status === "Enabled" ? (
                        <>
                          <Square className="h-4 w-4" /> Wstrzymaj
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" /> Uruchom
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setStatus("Archived");
                        onUpdate(automation.id, { status: "Archived" });
                      }}
                      disabled={status === "Archived"}
                      className="flex items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" /> Archiwizuj
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 justify-between bg-gray-50 px-4 py-4 sm:px-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => onDelete(automation.id)}
                  className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 shadow-sm hover:bg-red-100 transition"
                >
                  <Trash2 className="h-4 w-4" /> Usuń
                </button>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    Anuluj
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <Save className="h-4 w-4" /> Zapisz zmiany
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
