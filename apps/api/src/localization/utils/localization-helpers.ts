import { getTableColumns } from "drizzle-orm";

const DEFAULT_EXCLUDED_COLUMN_NAMES = new Set(["settings", "metadata"]);

type TableWithColumns = Parameters<typeof getTableColumns>[0];

type LocalizableKeyOptions = {
  include?: readonly string[];
  exclude?: readonly string[];
};

type ColumnLike = {
  getSQLType?: () => string;
  columnType?: string;
  dataType?: string;
};

const getColumnSqlType = (column: ColumnLike) => {
  if (typeof column.getSQLType === "function") {
    return column.getSQLType().toLowerCase();
  }

  return column.columnType?.toLowerCase() ?? column.dataType?.toLowerCase() ?? "";
};

const isJsonColumn = (column: ColumnLike) => {
  const sqlType = getColumnSqlType(column);

  return sqlType.includes("jsonb") || sqlType === "json";
};

export const getLocalizableKeysFromTable = (
  table: TableWithColumns,
  options: LocalizableKeyOptions = {},
) => {
  const includeSet = options.include ? new Set(options.include) : null;
  const excludeSet = new Set([...(options.exclude ?? []), ...DEFAULT_EXCLUDED_COLUMN_NAMES]);

  const columns = getTableColumns(table);

  return Object.entries(columns)
    .filter(([name, column]) => {
      if (!isJsonColumn(column) || excludeSet.has(name)) return false;
      return includeSet ? includeSet.has(name) : true;
    })
    .map(([name]) => name);
};

export const hasLocalizableUpdates = <TUpdate extends Record<string, unknown>>(
  table: TableWithColumns,
  updateData: TUpdate,
  options?: LocalizableKeyOptions,
) => {
  const localizableKeys = getLocalizableKeysFromTable(table, options);

  return localizableKeys.some((key) => updateData[key] !== undefined);
};
