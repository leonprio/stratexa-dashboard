import React, { useMemo } from 'react';
import {
  StrategicObjective,
  StrategicPerspective,
  ContributionObjective,
  ContributionIndicatorAssignment
} from '../../strategyTypes';
import { Dashboard as DashboardType } from '../../types';
import { calculateCompliance } from '../../utils/compliance';
import { CheckCircle2, AlertTriangle, Info, TrendingUp, Layers, Target } from 'lucide-react';

export interface StrategicObjectiveNodeProps {
  objective: StrategicObjective;
  perspective?: StrategicPerspective;
  contributions?: ContributionObjective[];
  assignments?: ContributionIndicatorAssignment[];
  dashboards?: DashboardType[];
  isSelected?: boolean;
  isHovered?: boolean;
  isCause?: boolean;
  isEffect?: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Nodo visual de Objetivo Estratégico (OE) para el Mapa Estratégico BSC.
 *
 * Escenario A: Sin Objetivos de Contribución (OCs) -> Renderiza el nodo OE limpio normalmente.
 * Escenario B: Con OCs -> Muestra badges de enriquecimiento (conteo de áreas, OCs, KPIs y distribución semafórica).
 *
 * REGLA OBLIGATORIA: NUNCA calcula ni despliega un porcentaje sintético general de cumplimiento para el OE.
 */
export const StrategicObjectiveNode: React.FC<StrategicObjectiveNodeProps> = ({
  objective,
  perspective,
  contributions = [],
  assignments = [],
  dashboards = [],
  isSelected = false,
  isHovered = false,
  isCause = false,
  isEffect = false,
  onClick,
  onMouseEnter,
  onMouseLeave
}) => {
  const nodeColor = perspective?.color || '#3B82F6';

  // Filtrar los OCs pertenecientes a este OE
  const oeContributions = useMemo(() => {
    return contributions.filter(c => c.primaryStrategicObjectiveId === objective.id && c.status !== 'inactive');
  }, [contributions, objective.id]);

  // Derivar métricas operativas de enriquecimiento opcional (ÚNICAMENTE cuando existen OCs)
  const enrichmentData = useMemo(() => {
    if (oeContributions.length === 0) {
      return { hasContributions: false, ocCount: 0, areaCount: 0, kpiCount: 0, statusCounts: { green: 0, yellow: 0, red: 0 } };
    }

    const ocIds = new Set(oeContributions.map(c => c.id));
    const uniqueAreas = new Set(oeContributions.map(c => c.areaName.trim().toUpperCase()));
    const oeAssignments = assignments.filter(a => ocIds.has(a.contributionObjectiveId));

    let green = 0;
    let yellow = 0;
    let red = 0;

    oeAssignments.forEach(asgn => {
      const dbMatch = dashboards.find(d => String(d.id) === String(asgn.dashboardId));
      if (dbMatch) {
        const itemMatch = (dbMatch.items || []).find(it => String(it.id) === String(asgn.itemId));
        if (itemMatch) {
          const compResult = calculateCompliance(itemMatch);
          const comp = compResult?.overallPercentage;
          if (comp !== null && comp !== undefined) {
            if (comp >= 95) green++;
            else if (comp >= 85) yellow++;
            else red++;
          }
        }
      }
    });

    return {
      hasContributions: true,
      ocCount: oeContributions.length,
      areaCount: uniqueAreas.size,
      kpiCount: oeAssignments.length,
      statusCounts: { green, yellow, red }
    };
  }, [oeContributions, assignments, dashboards]);

  // Clases CSS dinámicas para selección/hover/causa/efecto
  let borderStyle = 'border-slate-200 hover:border-slate-400';
  let shadowStyle = 'shadow-sm hover:shadow-md';
  let ringStyle = '';

  if (isSelected) {
    borderStyle = 'border-indigo-600';
    ringStyle = 'ring-2 ring-indigo-500 ring-offset-2';
    shadowStyle = 'shadow-lg';
  } else if (isCause) {
    borderStyle = 'border-amber-500';
    ringStyle = 'ring-2 ring-amber-400 ring-offset-1';
    shadowStyle = 'shadow-md';
  } else if (isEffect) {
    borderStyle = 'border-emerald-500';
    ringStyle = 'ring-2 ring-emerald-400 ring-offset-1';
    shadowStyle = 'shadow-md';
  } else if (isHovered) {
    borderStyle = 'border-blue-400';
    shadowStyle = 'shadow-md';
  }

  return (
    <div
      data-oe-id={objective.id}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative cursor-pointer transition-all duration-200 rounded-xl bg-white p-3.5 border ${borderStyle} ${shadowStyle} ${ringStyle} min-w-[220px] max-w-[280px] flex flex-col justify-between select-none`}
      style={{ borderLeftWidth: '5px', borderLeftColor: nodeColor }}
    >
      {/* Cabecera: Código OE + Badge de Causa/Efecto */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide"
          style={{ backgroundColor: `${nodeColor}15`, color: nodeColor }}
        >
          {objective.code}
        </span>

        {isCause && (
          <span className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-amber-200">
            Causa
          </span>
        )}
        {isEffect && (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-emerald-200">
            Efecto
          </span>
        )}
      </div>

      {/* Título del Objetivo Estratégico */}
      <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight mb-2">
        {objective.title}
      </h4>

      {/* Pie Enriquecido condicional (Solo Escenario B con OCs) */}
      {enrichmentData.hasContributions ? (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-0.5 font-medium text-slate-700" title={`${enrichmentData.ocCount} Objetivos de Contribución`}>
              <Target className="w-3 h-3 text-slate-400" />
              {enrichmentData.ocCount} OC
            </span>
            <span className="flex items-center gap-0.5" title={`${enrichmentData.areaCount} Áreas contribuyentes`}>
              <Layers className="w-3 h-3 text-slate-400" />
              {enrichmentData.areaCount} Áreas
            </span>
          </div>

          {/* Badge semafórico sin promedio sintético */}
          {enrichmentData.kpiCount > 0 ? (
            <div className="flex items-center gap-1 font-mono text-[10px]" title="Distribución de estatus operativo de KPIs vinculados">
              {enrichmentData.statusCounts.green > 0 && (
                <span className="inline-flex items-center text-emerald-600 font-bold">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />
                  {enrichmentData.statusCounts.green}
                </span>
              )}
              {enrichmentData.statusCounts.yellow > 0 && (
                <span className="inline-flex items-center text-amber-600 font-bold">
                  <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                  {enrichmentData.statusCounts.yellow}
                </span>
              )}
              {enrichmentData.statusCounts.red > 0 && (
                <span className="inline-flex items-center text-rose-600 font-bold">
                  <Info className="w-2.5 h-2.5 mr-0.5" />
                  {enrichmentData.statusCounts.red}
                </span>
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-400 italic">Sin KPIs</span>
          )}
        </div>
      ) : (
        /* Escenario A: Sin OCs ni KPIs -> Render limpio sin advertencias de error */
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span className="font-medium text-slate-400">Nivel Estratégico Pure</span>
        </div>
      )}
    </div>
  );
};
