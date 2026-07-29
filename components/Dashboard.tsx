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
  selectedItemId?: number | string | null;
  onSelectItem?: (id: number | string | null) => void;
  decimalPrecision?: 0 | 1 | 2;
  allContextItems?: DashboardItem[];
  isGlobalAdmin?: boolean; // 🛡️ v9.1.0-PRO-FINAL-SHIELDED: Propagado hasta DashboardRow
}

/**
 * Componente Dashboard
 * 
 * Orquestador principal de la cuadrícula de KPIs o vista compacta. 
 * Realiza filtrado reactivo y gestión de selección de indicadores.
 */
export const Dashboard: React.FC<DashboardProps> = React.memo(({
  data,
  onUpdateItem,
  globalThresholds,
  userRoleForDashboard,
  layout = "grid",
  year,
  isAggregate = false,
  selectedItemId,
  onSelectItem,
  decimalPrecision = 0,
  allContextItems = [],
  isGlobalAdmin = false
}) => {
  const safeData: DashboardItem[] = useMemo(() => {
    const list = Array.isArray(data) ? data : [];
    if (selectedItemId === null) return list;
    return list.filter(item => item.id !== selectedItemId);
  }, [data, selectedItemId]);

  // Grid responsivo que respeta el ancho real del contenedor (descontando sidebar)
  // auto-fit + minmax: en contenedor de 1000px → 3 cols; en 700px → 2 cols; en <320px → 1 col
  // Contrato controlado de columnas mediante Container Queries en index.css
  const gridClasses =
    layout === "compact"
      ? "kpi-grid-compact gap-2 pt-0"
      : "kpi-grid-normal gap-3 items-start";

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
            allDashboardItems={allContextItems.length > 0 ? allContextItems : (data || [])}
            isGlobalAdmin={isGlobalAdmin}
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
});
