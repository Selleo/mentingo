export const StatusBadge: React.FC<{ status: "Enabled" | "Disabled" | "Draft" | "Archived" }> = ({
  status,
}) => {
  const styles = {
    Enabled: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Disabled: "bg-gray-50 text-gray-600 border-gray-200",
    Draft: "bg-amber-50 text-amber-700 border-amber-200",
    Archived: "bg-slate-100 text-slate-700 border-slate-300 font-medium",
  };

  const labelPl = {
    Enabled: "Włączona",
    Disabled: "Wyłączona",
    Draft: "Szkic",
    Archived: "Zarchiwizowana",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status]}`}
    >
      {labelPl[status]}
    </span>
  );
};
