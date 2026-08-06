import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { DashboardItem } from '../types';

interface AggregateBuilderProps {
  currentItem: DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string });
  allItems: (DashboardItem | (Omit<DashboardItem, 'id'> & { id: number | string }))[];
  onChangeComponentIds: (ids: (number | string)[]) => void;
  onChangeType?: (type: 'accumulative' | 'average') => void;
  onClose: () => void;
}

export const AggregateBuilder: React.FC<AggregateBuilderProps> = ({
  currentItem,
  allItems,
  onChangeComponentIds,
  onChangeType,
  onClose,
}) => {
  // persistedSourceIds derivado sin modificar currentItem.componentIds, asegurando deduplicación estable
  const persistedSourceIds = useMemo(() => {
    return Array.from(new Set((currentItem.componentIds || []).map(id => String(id))));
  }, [currentItem.componentIds]);

  const [selectedIds, setSelectedIds] = useState<string[]>(persistedSourceIds);
  const [strategy, setStrategy] = useState<'accumulative' | 'average'>(
    currentItem.type === 'accumulative' ? 'accumulative' : 'average'
  );

  // Resincronizar selectedIds cuando cambien currentItem.id, currentItem.componentIds o allItems
  useEffect(() => {
    setSelectedIds(Array.from(new Set((currentItem.componentIds || []).map(id => String(id)))));
  }, [currentItem.id, currentItem.componentIds, allItems]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  // availableItems: Todos los items del mismo dashboard excepto el indicador actual (impidiendo autorreferencia)
  const availableItems = useMemo(() => {
    return allItems.filter(it => String(it.id) !== String(currentItem.id));
  }, [allItems, currentItem.id]);

  // orphanedSourceIds: IDs persistidos que no existen en allItems
  const orphanedSourceIds = useMemo(() => {
    const availableIdSet = new Set(availableItems.map(it => String(it.id)));
    return selectedIds.filter(id => !availableIdSet.has(id));
  }, [selectedIds, availableItems]);

  // validSelectedItems: Únicamente availableItems cuyos IDs estén presentes en selectedIds
  const validSelectedItems = useMemo(() => {
    return availableItems.filter(it => selectedIds.includes(String(it.id)));
  }, [availableItems, selectedIds]);

  // Helper para sugerencias/ordenamiento por equivalencia semántica
  const isSuggestedItem = useMemo(() => {
    const normalize = (str?: string) =>
      (str || '')
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");

    const targetSemanticKey = currentItem.semanticKey;
    const targetParentDefId = currentItem.parentDefinitionId;
    const targetNameNorm = normalize(currentItem.indicator);
    const targetUnitNorm = normalize(currentItem.unit);

    return (it: typeof availableItems[0]) => {
      if (targetSemanticKey && it.semanticKey) {
        return it.semanticKey === targetSemanticKey;
      }
      if (targetParentDefId && it.parentDefinitionId) {
        return it.parentDefinitionId === targetParentDefId;
      }
      const nameNorm = normalize(it.indicator);
      const unitNorm = normalize(it.unit);
      return nameNorm === targetNameNorm && unitNorm === targetUnitNorm;
    };
  }, [currentItem.indicator, currentItem.unit, currentItem.semanticKey, currentItem.parentDefinitionId]);

  // Ordenamiento visual:
  // 1. Fuentes seleccionadas
  // 2. Fuentes sugeridas por semanticKey / parentDefinitionId / nombre+unidad
  // 3. Demás disponibles en orden original
  const sortedAvailableItems = useMemo(() => {
    return [...availableItems].sort((a, b) => {
      const aSelected = selectedIds.includes(String(a.id));
      const bSelected = selectedIds.includes(String(b.id));
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;

      const aSuggested = isSuggestedItem(a);
      const bSuggested = isSuggestedItem(b);
      if (aSuggested && !bSuggested) return -1;
      if (!aSuggested && bSuggested) return 1;

      return 0;
    });
  }, [availableItems, selectedIds, isSuggestedItem]);

  const toggleSelectId = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApply = () => {
    // Al aplicar, enviar sólo los IDs de validSelectedItems conservando tipo original
    const validIds = validSelectedItems.map(item => item.id);
    onChangeComponentIds(validIds);
    if (onChangeType) {
      onChangeType(strategy);
    }
    onClose();
  };

  // Vista previa calculada exclusivamente con validSelectedItems (mes 5 / Junio)
  const previewMonthIdx = 5;
  const previewProgress = useMemo(() => {
    if (validSelectedItems.length === 0) return 0;
    const sum = validSelectedItems.reduce((acc, it) => acc + Number(it.monthlyProgress?.[previewMonthIdx] || 0), 0);
    return strategy === 'accumulative' ? sum : Math.round((sum / validSelectedItems.length) * 10) / 10;
  }, [validSelectedItems, strategy]);

  const previewGoal = useMemo(() => {
    if (validSelectedItems.length === 0) return 0;
    const sum = validSelectedItems.reduce((acc, it) => acc + Number(it.monthlyGoals?.[previewMonthIdx] || 0), 0);
    return strategy === 'accumulative' ? sum : Math.round((sum / validSelectedItems.length) * 10) / 10;
  }, [validSelectedItems, strategy]);

  const previewCompliancePct = useMemo(() => {
    if (previewGoal === 0) return 0;
    return Math.round((previewProgress / previewGoal) * 100);
  }, [previewProgress, previewGoal]);

  const isApplyDisabled = validSelectedItems.length === 0 || orphanedSourceIds.length > 0;

  // 🛡️ FIX v9.4.20 (PORTAL MODAL): Montar sobre document.body para escapar el stacking
  // context del IndicatorManager. El ancestro IndicatorManager tiene z-[100] y propiedades
  // CSS (transform en animaciones, will-change) que crean un contexto de apilamiento propio,
  // haciendo que cualquier fixed child quede subordinado a ese contexto aunque tenga z-50.
  // Solución: createPortal saca el modal del árbol DOM del ancestro.
  const modalContent = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* HEADER DEL MODAL AGREGADO */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-xl text-amber-400 font-bold">
              📊
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black uppercase text-white tracking-tight">
                Configurador de Indicador AGREGADO
              </h3>
              <span className="text-xs text-amber-400 font-medium">
                Consolidando para: <strong className="text-white">{currentItem.indicator}</strong> (#{currentItem.id})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-700 transition-all font-bold"
            title="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* AYUDA CONTEXTUAL */}
        <div className="bg-amber-950/40 border border-amber-500/20 p-3 rounded-2xl text-xs text-amber-200 mb-6">
          <strong className="text-amber-400">💡 AGREGADO:</strong> Consolida indicadores desde el mismo tablero. Calcula los avances por separado y las metas por separado.
        </div>

        {/* ADVERTENCIA DE FUENTES HUÉRFANAS */}
        {orphanedSourceIds.length > 0 && (
          <div className="bg-rose-950/60 border border-rose-500/40 p-4 rounded-2xl text-xs text-rose-200 mb-6 flex flex-col gap-1">
            <strong className="text-rose-400 font-bold">⚠️ FUENTES HUÉRFANAS DETECTADAS:</strong>
            <span>
              Los siguientes IDs de fuentes configuradas no existen en este tablero: {orphanedSourceIds.join(', ')}.
            </span>
            <span className="text-[11px] text-rose-300/80 mt-1">
              Deseleccione o resuelva estas referencias antes de aplicar la configuración.
            </span>
          </div>
        )}

        {/* SECCIÓN 1: ESTRATEGIA DE AGREGACIÓN */}
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 mb-6">
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
            1. Estrategia de Consolidador
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStrategy('accumulative')}
              className={`p-3.5 rounded-xl border text-left flex flex-col transition-all ${strategy === 'accumulative' ? 'bg-amber-600/30 border-amber-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <span className="font-bold text-xs uppercase">➕ SUMA (Acumulativo)</span>
              <span className="text-[10px] text-slate-500 mt-1">Suma el total de avances y el total de metas de los nodos seleccionados.</span>
            </button>

            <button
              type="button"
              onClick={() => setStrategy('average')}
              className={`p-3.5 rounded-xl border text-left flex flex-col transition-all ${strategy === 'average' ? 'bg-amber-600/30 border-amber-400 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
            >
              <span className="font-bold text-xs uppercase">⚖️ PROMEDIO (Promediado)</span>
              <span className="text-[10px] text-slate-500 mt-1">Calcula el promedio de avances y el promedio de metas de los nodos seleccionados.</span>
            </button>
          </div>
        </div>

        {/* SECCIÓN 2: SELECCIÓN VISUAL DE FUENTES */}
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              2. Selecciona las fuentes de consolidación ({validSelectedItems.length} seleccionadas)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {sortedAvailableItems.length === 0 ? (
              <div className="text-xs text-amber-300 font-bold bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                ⚠️ NO HAY OTROS INDICADORES DISPONIBLES EN ESTE TABLERO.
              </div>
            ) : (
              sortedAvailableItems.map(it => {
                const isSelected = selectedIds.includes(String(it.id));
                const suggested = isSuggestedItem(it);
                return (
                  <div
                    key={it.id}
                    onClick={() => toggleSelectId(String(it.id))}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${isSelected ? 'bg-amber-500/10 border-amber-500/50 text-white' : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-bold text-xs text-cyan-400">#{it.id}</span>
                      <span className="text-xs font-medium">{it.indicator}</span>
                      {it.unit && (
                        <span className="text-[10px] text-slate-500 font-mono">({it.unit})</span>
                      )}
                      {suggested && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Sugerido
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span>Avance: {it.monthlyProgress?.[previewMonthIdx] ?? 0}</span>
                      <span>Meta: {it.monthlyGoals?.[previewMonthIdx] ?? 0}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECCIÓN 3: VISTA PREVIA DEL CÁLCULO AGREGADO */}
        <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl flex flex-col gap-3 mb-6">
          <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
            3. Vista previa del resultado consolidado ({strategy === 'accumulative' ? 'SUMA' : 'PROMEDIO'})
          </span>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Avance Agregado</span>
              <span className="text-xl font-black text-white mt-1">
                {previewProgress} {currentItem.unit || '%'}
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Agregada</span>
              <span className="text-xl font-black text-slate-300 mt-1">
                {previewGoal} {currentItem.unit || '%'}
              </span>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Cumplimiento Resultante</span>
              <span className="text-xl font-black text-emerald-400 mt-1">
                {previewCompliancePct}%
              </span>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplyDisabled}
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:scale-[1.02]"
          >
            Aplicar Agregado
          </button>
        </div>

      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalContent, document.body);
};
