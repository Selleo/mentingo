import { useLoaderData } from "@remix-run/react";
import { useState } from "react";

import { AutomationDrawer } from "./components/AutomationDrawer";
import { AutomationFilters, type StatusFilter } from "./components/AutomationFilters";
import { AutomationHeader } from "./components/AutomationHeader";
import { AutomationTable } from "./components/AutomationTable";

export interface Automation {
  id: string;
  name: string;
  description: string;
  status: "Enabled" | "Disabled" | "Draft" | "Archived";
  trigger: string;
  actionsCount: number;
  lastRun: {
    date: string;
    status: "success" | "failed" | "never";
  };
  updatedAt: string;
}

// Początkowe dane demonstracyjne
const INITIAL_DATA: Automation[] = [
  {
    id: "1",
    name: "Kurs przypisany - Powiadomienie",
    description: "Wysyła email do uczestnika zaraz po przypisaniu do kursu.",
    status: "Enabled",
    trigger: "learner.assigned",
    actionsCount: 1,
    lastRun: { date: "2026-07-15 08:12", status: "success" },
    updatedAt: "2026-07-10",
  },
  {
    id: "2",
    name: "Przypomnienie o certyfikacie",
    description: "Wysyłane 30 dni przed wygaśnięciem certyfikatu.",
    status: "Disabled",
    trigger: "certificate.expiring",
    actionsCount: 2,
    lastRun: { date: "2026-07-12 11:00", status: "failed" },
    updatedAt: "2026-07-12",
  },
  {
    id: "3",
    name: "Nowe szkolenie Live",
    description: "Szkic powiadomienia o nadchodzących warsztatach.",
    status: "Draft",
    trigger: "live_training.scheduled",
    actionsCount: 1,
    lastRun: { date: "-", status: "never" },
    updatedAt: "2026-07-15",
  },
];

export async function clientLoader() {
  return { initialAutomations: INITIAL_DATA };
}

export default function AutomationPage() {
  const { initialAutomations } = useLoaderData<typeof clientLoader>();

  // Stan przechowujący listę wszystkich automatyzacji
  const [automations, setAutomations] = useState<Automation[]>(initialAutomations);

  // Stany zarządzające wysuwanym panelem bocznym (Drawer)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

  // Stany wyszukiwania i filtrowania
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("All");

  // Funkcja tworzenia nowej automatyzacji jako Szkic (Draft)
  const handleCreate = () => {
    const newAutomation: Automation = {
      id: Date.now().toString(),
      name: "Nowa automatyzacja (Szkic)",
      description:
        "Zdefiniuj cel i opis tej automatyzacji, a następnie przejdź do kreatora przepływu.",
      status: "Draft",
      trigger: "Do skonfigurowania...",
      actionsCount: 0,
      lastRun: { date: "-", status: "never" },
      updatedAt: new Date().toISOString().split("T")[0],
    };
    setAutomations((prev) => [newAutomation, ...prev]);
  };

  // Otwarcie panelu bocznego dla wybranego wiersza
  const handleOpenDrawer = (automation: Automation) => {
    setSelectedAutomation(automation);
    setIsDrawerOpen(true);
  };

  // Zamykanie panelu bocznego z czyszczeniem zaznaczenia
  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedAutomation(null);
  };

  // Aktualizacja automatyzacji (Zapis zmian z Drawera)
  const handleUpdate = (id: string, updatedFields: Partial<Automation>) => {
    setAutomations((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = {
            ...item,
            ...updatedFields,
            updatedAt: new Date().toISOString().split("T")[0], // Automatyczne odświeżenie daty modyfikacji
          };

          // Jeśli aktualizowany element jest aktualnie otwarty w drawerze, synchronizujemy jego stan lokalny
          if (selectedAutomation?.id === id) {
            setSelectedAutomation(updatedItem);
          }

          return updatedItem;
        }
        return item;
      }),
    );
  };

  // Usuwanie automatyzacji
  const handleDelete = (id: string) => {
    if (
      confirm(
        "Czy na pewno chcesz bezpowrotnie usunąć tę automatyzację? Zamiast tego możesz ją zarchiwizować.",
      )
    ) {
      setAutomations((prev) => prev.filter((item) => item.id !== id));
      handleCloseDrawer();
    }
  };

  // Przejście do zewnętrznego kreatora/edytora przepływu
  const handleEdit = (id: string) => {
    console.log(`Przekierowanie użytkownika do kreatora automatyzacji o ID: ${id}`);
    // Tutaj możesz dodać np. navigate(`/automations/${id}/builder`);
  };

  // Logika filtrowania danych w locie na podstawie paska filtrów
  const filteredAutomations = automations.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "All" || item.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Nagłówek sekcji z przyciskiem "Utwórz" */}
      <AutomationHeader onCreate={handleCreate} />

      {/* Pasek filtrowania tekstowego oraz zakładek statusu */}
      <div className="mt-8">
        <AutomationFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />
      </div>

      {/* Tabela prezentująca przefiltrowane wyniki */}
      <div className="bg-white shadow rounded-lg border border-gray-200 overflow-hidden">
        <AutomationTable automations={filteredAutomations} onOpenDrawer={handleOpenDrawer} />
      </div>

      {/* Szuflada boczna (Slide-over drawer) zarządzana centralnym stanem strony */}
      <AutomationDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        automation={selectedAutomation}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onEdit={handleEdit}
      />
    </div>
  );
}
