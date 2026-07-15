import { useState } from "react";

import { AutomationPagination } from "./AutomationPagination";
import { AutomationRow } from "./AutomationRow";

import type { Automation } from "../Automation.page";

interface AutomationTableProps {
  automations: Automation[];
  onOpenDrawer: (automation: Automation) => void;
}

export const AutomationTable: React.FC<AutomationTableProps> = ({ automations, onOpenDrawer }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = automations.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div className="flex flex-col">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Nazwa automatyzacji
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Trigger (Wyzwalacz)
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 text-center">
                Akcje
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Ostatnie uruchomienie
              </th>
              <th className="px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Aktualizacja
              </th>
              <th className="relative px-6 py-3.5">
                <span className="sr-only">Menu</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {currentItems.map((item) => (
              <AutomationRow key={item.id} automation={item} onOpenDrawer={onOpenDrawer} />
            ))}
            {automations.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-gray-500">
                  Brak zdefiniowanych automatyzacji. Kliknij Create Automation, aby dodać pierwszą.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {automations.length > 0 && (
        <AutomationPagination
          totalItems={automations.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
