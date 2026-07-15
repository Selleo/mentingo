import { Settings, Trash2, Power, PowerOff, MoreVertical } from "lucide-react";
import { useState, useEffect, useRef } from "react";

interface ActionMenuProps {
  automationId: string;
  status: "Enabled" | "Disabled" | "Draft";
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export const ActionMenu: React.FC<ActionMenuProps> = ({
  automationId,
  status,
  onToggleStatus,
  onDelete,
  onEdit,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isEnabled = status === "Enabled";

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 z-10">
          <div className="py-1">
            <button
              onClick={() => {
                onEdit(automationId);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <Settings className="w-4 h-4 text-gray-400" />
              Ustawienia i edycja
            </button>

            <button
              onClick={() => {
                onToggleStatus(automationId);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              {isEnabled ? (
                <>
                  <PowerOff className="w-4 h-4 text-amber-500" />
                  Wyłącz powiadomienie
                </>
              ) : (
                <>
                  <Power className="w-4 h-4 text-emerald-500" />
                  Włącz powiadomienie
                </>
              )}
            </button>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                onDelete(automationId);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
              Usuń automatyzację
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
