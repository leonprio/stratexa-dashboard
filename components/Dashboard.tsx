import React, { useMemo } from "react";
import {
  Dashboard as DashboardType,
  DashboardItem,
  DashboardRole,
  ComplianceThresholds,
} from "../types";
import { DashboardRow } from "./DashboardRow";

interface DashboardProps {
  data: DashboardItem[] | undefined | null;
  onUpdateItem: (item: DashboardItem) => void;
  globalThresholds: ComplianceThresholds;
  userRoleForDashboard: DashboardRole | null;
  layout?: "grid" | "compact";
  year?: number;
  allDashboards?: DashboardType[];
  isAggregate?: boolean;
  selectedItemId?: number | null;
  onSelectItem?: (id: number | null) => void;
  decimalPrecision?: 1 | 2;
}

export const Dashboard: React.FC<DashboardProps> = ({
  data,
  onUpdateItem,
  globalThresholds,
  userRoleForDashboard,
  layout = "grid",
  year,
  isAggregate = false,
  selectedItemId,
  onSelectItem,
  decimalPrecision = 2 // Default to 2
}) => {
  const safeData: DashboardItem[] = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (selectedItemId === null) return list;
    return list.filter(item => item.id !== selectedItemId);
  }, [data, selectedItemId]);

  const gridClasses =
    layout === "compact"
      ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 gap-2 pt-0"
      : "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 items-start";

  const emptyMessage = useMemo(() => {
    return year
      ? `No hay indicadores para mostrar en ${year}.`
      : "No hay indicadores para mostrar.";
  }, [year]);

  return (
    <div className={gridClasses}>
      {safeData.length > 0 ? (
        safeData.map((item) => (
          <DashboardRow
            key={`row-${item.id}`}
            item={item}
            onUpdateItem={onUpdateItem}
            globalThresholds={globalThresholds}
            userRoleForDashboard={userRoleForDashboard}
            layout={layout as "grid" | "compact"}
            year={year}
            isAggregate={isAggregate}
            isSelected={item.id === selectedItemId}
            onSelect={() => onSelectItem?.(item.id === selectedItemId ? null : item.id)}
            decimalPrecision={decimalPrecision}
          />
        ))
      ) : (
        <div className="col-span-full text-center py-12 px-6 text-slate-400 bg-slate-800/50 backdrop-blur-sm rounded-xl shadow-lg ring-1 ring-white/10">
          <p className="text-lg">{emptyMessage}</p>
          <p className="mt-2 text-slate-500">
            Puedes comenzar agregando uno nuevo desde &quot;Gestionar Indicadores&quot;.
          </p>
        </div>
      )}
    </div>
  );
};
