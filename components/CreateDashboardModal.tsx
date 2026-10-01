import React, { useState, useMemo, useEffect } from 'react';
import { normalizeGroupName } from '../utils/formatters';

export interface CreateDashboardData {
  title: string;
  area: string;
  group: string;
}

interface CreateDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: CreateDashboardData) => Promise<void> | void;
  availableAreas: string[];
  availableGroups?: string[];
  dashboards?: Array<{ area?: string; group?: string }>;
  dashboardLabel?: string;
}

export const NEW_AREA_VALUE = '__NEW_AREA__';
export const NEW_GROUP_VALUE = '__NEW_GROUP__';
export const SAME_AS_AREA_VALUE = '__SAME_AS_AREA__';

/**
 * Normaliza nombres de áreas para preservar identidad canónica sin duplicados por mayúsculas/espacios.
 */
export const normalizeAreaName = (area: string): string => {
  return area.trim().toUpperCase();
};

export const CreateDashboardModal: React.FC<CreateDashboardModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  availableAreas,
  availableGroups = [],
  dashboards = [],
  dashboardLabel = 'Tablero',
}) => {
  // Áreas limpias, únicas y ordenadas
  const cleanAvailableAreas = useMemo(() => {
    const set = new Set<string>();
    availableAreas.forEach((a) => {
      const norm = normalizeAreaName(a || '');
      if (norm) set.add(norm);
    });
    return Array.from(set).sort();
  }, [availableAreas]);

  // Mapa de Área -> Set de Grupos existentes asociados a esa área
  const areaToGroupsMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    dashboards.forEach((d) => {
      const areaNorm = normalizeAreaName(d.area || '');
      const groupNorm = normalizeGroupName(d.group || '');
      if (areaNorm && groupNorm && groupNorm !== 'GENERAL' && groupNorm !== 'SINTESIS' && groupNorm !== 'TODOS') {
        if (!map.has(areaNorm)) {
          map.set(areaNorm, new Set<string>());
        }
        map.get(areaNorm)!.add(d.group!.trim().toUpperCase());
      }
    });
    return map;
  }, [dashboards]);

  const [title, setTitle] = useState('');
  const [selectedAreaOption, setSelectedAreaOption] = useState<string>(() =>
    cleanAvailableAreas.length > 0 ? cleanAvailableAreas[0] : NEW_AREA_VALUE
  );
  const [newAreaText, setNewAreaText] = useState('');
  const [selectedGroupOption, setSelectedGroupOption] = useState<string>(SAME_AS_AREA_VALUE);
  const [newGroupText, setNewGroupText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manejar cambio de área y resetear grupo seleccionado
  const handleAreaChange = (newArea: string) => {
    setSelectedAreaOption(newArea);
    setSelectedGroupOption(SAME_AS_AREA_VALUE);
    setNewGroupText('');
  };

  // Grupos filtrados por el área seleccionada
  const areaScopedGroups = useMemo(() => {
    // Si es nueva área, NO hereda grupos de otras áreas
    if (selectedAreaOption === NEW_AREA_VALUE) {
      return [];
    }

    const currentAreaNorm = normalizeAreaName(selectedAreaOption);
    const set = areaToGroupsMap.get(currentAreaNorm);
    if (set && set.size > 0) {
      return Array.from(set).sort();
    }

    // Fallback: si dashboards no fue provisto pero sí availableGroups y no hay mapeo
    if (dashboards.length === 0 && availableGroups.length > 0) {
      const fallbackSet = new Set<string>();
      availableGroups.forEach((g) => {
        const norm = normalizeGroupName(g || '');
        if (norm && norm !== 'GENERAL' && norm !== 'SINTESIS' && norm !== 'TODOS') {
          fallbackSet.add(g.trim().toUpperCase());
        }
      });
      return Array.from(fallbackSet).sort();
    }

    return [];
  }, [selectedAreaOption, areaToGroupsMap, dashboards.length, availableGroups]);

  // Inicializar defaults cuando se abre el modal
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setNewAreaText('');
      setNewGroupText('');
      setErrorMessage(null);
      setIsSubmitting(false);

      if (cleanAvailableAreas.length > 0) {
        setSelectedAreaOption(cleanAvailableAreas[0]);
      } else {
        setSelectedAreaOption(NEW_AREA_VALUE);
      }

      setSelectedGroupOption(SAME_AS_AREA_VALUE);
    }
  }, [isOpen, cleanAvailableAreas]);

  if (!isOpen) return null;

  const resolvedArea =
    selectedAreaOption === NEW_AREA_VALUE
      ? normalizeAreaName(newAreaText)
      : normalizeAreaName(selectedAreaOption);

  const resolvedGroup = (() => {
    if (selectedGroupOption === SAME_AS_AREA_VALUE) {
      return resolvedArea || 'GENERAL';
    }
    if (selectedGroupOption === NEW_GROUP_VALUE) {
      return newGroupText.trim().toUpperCase() || 'GENERAL';
    }
    if (selectedGroupOption === 'GENERAL') {
      return 'GENERAL';
    }
    // Si se tenía seleccionado un grupo que ya no pertenece al área, revalidar a resolvedArea
    const groupUpper = selectedGroupOption.trim().toUpperCase();
    if (!areaScopedGroups.includes(groupUpper)) {
      return resolvedArea || 'GENERAL';
    }
    return groupUpper || 'GENERAL';
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage(`El nombre del ${dashboardLabel.toLowerCase()} es obligatorio.`);
      return;
    }

    if (!resolvedArea) {
      setErrorMessage('El área organizacional es obligatoria para la navegación y estrategia.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm({
        title: cleanTitle,
        area: resolvedArea,
        group: resolvedGroup,
      });
      onClose();
    } catch (err: any) {
      console.error('Error creating dashboard:', err);
      setErrorMessage(err.message || 'Error al crear el tablero. Intente nuevamente.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[90] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-3xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 border-b border-slate-700/60 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">➕</span>
            <div>
              <h3 id="modal-title" className="text-base font-bold text-white tracking-wide">
                Crear Nuevo {dashboardLabel}
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Define la identidad organizacional y agrupación operativa
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-2">
              <span className="text-sm">⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Nombre del Tablero */}
          <div>
            <label htmlFor="dashboard-title" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              1. Nombre del {dashboardLabel} <span className="text-rose-400">*</span>
            </label>
            <input
              id="dashboard-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all placeholder:text-slate-600 font-semibold"
              placeholder={`Ej: "Inclusión — Guanajuato", "METRO CENTRO", "Calidad"`}
              autoFocus
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Nombre visible que identificará la unidad operativa o temática.
            </p>
          </div>

          {/* 2. Área Organizacional */}
          <div className="pt-2 border-t border-slate-800">
            <label htmlFor="area-select" className="block text-xs font-bold text-cyan-400 uppercase tracking-wider mb-1.5">
              2. Área Organizacional (Dirección / División) <span className="text-rose-400">*</span>
            </label>
            <select
              id="area-select"
              value={selectedAreaOption}
              onChange={(e) => handleAreaChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none font-semibold mb-2"
            >
              {cleanAvailableAreas.map((area) => (
                <option key={area} value={area}>
                  {area} (Área Existente)
                </option>
              ))}
              <option value={NEW_AREA_VALUE}>+ NUEVA ÁREA...</option>
            </select>

            {selectedAreaOption === NEW_AREA_VALUE && (
              <div className="mt-2 animate-in fade-in duration-150">
                <input
                  id="new-area-text"
                  type="text"
                  value={newAreaText}
                  onChange={(e) => setNewAreaText(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/60 rounded-lg px-3.5 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none placeholder:text-slate-600 uppercase font-semibold"
                  placeholder='Nombre de la nueva área: ej. "SECRETARÍA DE INCLUSIÓN", "OPERACIONES"'
                  required
                />
                <p className="text-[10px] text-cyan-400/80 mt-1">
                  Se creará como una nueva área organizacional canónica para esta cuenta.
                </p>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Permite agrupar múltiples tableros bajo la misma estrategia, Matriz de Contribución y navegación.
            </p>
          </div>

          {/* 3. Grupo / Subdirección */}
          <div className="pt-2 border-t border-slate-800">
            <label htmlFor="group-select" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              3. Grupo Operativo / Subdirección / Región
            </label>
            <select
              id="group-select"
              value={selectedGroupOption}
              onChange={(e) => setSelectedGroupOption(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none font-semibold mb-2"
            >
              <option value={SAME_AS_AREA_VALUE}>
                Igual al Área: &quot;{resolvedArea || 'ÁREA'}&quot; (Recomendado para estructura directa como SOMOS)
              </option>
              <option value="GENERAL">GENERAL (Tablero transversal independiente)</option>
              {areaScopedGroups
                .filter((g) => g !== resolvedArea)
                .map((group) => (
                  <option key={group} value={group}>
                    {group} (Grupo Existente)
                  </option>
                ))}
              <option value={NEW_GROUP_VALUE}>+ NUEVO GRUPO / SUBDIRECCIÓN...</option>
            </select>

            {selectedGroupOption === NEW_GROUP_VALUE && (
              <div className="mt-2 animate-in fade-in duration-150">
                <input
                  id="new-group-text"
                  type="text"
                  value={newGroupText}
                  onChange={(e) => setNewGroupText(e.target.value)}
                  className="w-full bg-slate-950 border border-cyan-500/60 rounded-lg px-3.5 py-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none placeholder:text-slate-600 uppercase font-semibold"
                  placeholder='Nombre del nuevo grupo: ej. "DIRECCIÓN CENTRO", "SUBDIRECCIÓN NORTE"'
                  required
                />
                <p className="text-[10px] text-cyan-400/80 mt-1">
                  Los tableros con el mismo grupo consolidarán juntos automáticamente en un Resumen Directivo.
                </p>
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Determina con qué otros tableros se genera el tablero consolidado virtual (agg-*).
            </p>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors min-h-[44px]"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-700 disabled:text-slate-500 transition-all shadow-lg shadow-cyan-900/30 flex items-center gap-2 min-h-[44px]"
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creando...
                </>
              ) : (
                `Crear ${dashboardLabel}`
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
