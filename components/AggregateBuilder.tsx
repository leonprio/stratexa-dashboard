import React, { useState, useMemo } from 'react';
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
  const currentIds = useMemo(() => {
    return (currentItem.componentIds || []).map(id => String(id));
  }, [currentItem.componentIds]);

  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);
  const [strategy, setStrategy] = useState<'accumulative' | 'average'>(
    currentItem.type === 'accumulative' ? 'accumulative' : 'average'
  );

  // Excluir autorreferencia y filtrar fuentes conceptualmente compatibles (misma unidad o normalizada)
  const availableItems = useMemo(() => {
    const targetUnit = (currentItem.unit || '').trim().toLowerCase();
    return allItems.filter(it => {
      if (String(it.id) === String(currentItem.id)) return false;
      const unit = (it.unit || '').trim().toLowerCase();
      // Si el destino tiene unidad definida, requerir compatibilidad de unidad
      if (targetUnit && unit) {
        return unit === targetUnit;
      }
      return true;
    });
  }, [allItems, currentItem.id, currentItem.unit]);

  const toggleSelectId = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleApply = () => {
    // Conservar tipos originales (number o string)
    const originalTypes = selectedIds.map(idStr => {
      const found = availableItems.find(it => String(it.id) === idStr);
      return found ? found.id : idStr;
    });
    onChangeComponentIds(originalTypes);
    if (onChangeType) {
      onChangeType(strategy);
    }
    onClose();
  };

  // Cálculo de vista previa de consolidación (mes 5 / Junio)
  const previewMonthIdx = 5;
  const selectedItems = useMemo(() => {
    return availableItems.filter(it => selectedIds.includes(String(it.id)));
  }, [availableItems, selectedIds]);

  const previewProgress = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    const sum = selectedItems.reduce((acc, it) => acc + Number(it.monthlyProgress?.[previewMonthIdx] || 0), 0);
    return strategy === 'accumulative' ? sum : Math.round((sum / selectedItems.length) * 10) / 10;
  }, [selectedItems, strategy]);

  const previewGoal = useMemo(() => {
    if (selectedItems.length === 0) return 0;
    const sum = selectedItems.reduce((acc, it) => acc + Number(it.monthlyGoals?.[previewMonthIdx] || 0), 0);
    return strategy === 'accumulative' ? sum : Math.round((sum / selectedItems.length) * 10) / 10;
  }, [selectedItems, strategy]);

  const previewCompliancePct = useMemo(() => {
    if (previewGoal === 0) return 0;
    return Math.round((previewProgress / previewGoal) * 100);
  }, [previewProgress, previewGoal]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl w-full max-w-[800px] max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col p-6 text-slate-100">
        
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
          <strong className="text-amber-400">💡 AGREGADO:</strong> Consolida indicadores idénticos o equivalentes desde áreas, regiones o tableros hijos. Calcula los avances por separado y las metas por separado.
        </div>

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
              2. Selecciona las fuentes de consolidación ({selectedIds.length} seleccionadas)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
            {availableItems.length === 0 ? (
              <span className="text-xs text-slate-500 italic p-2">No hay otros indicadores en este tablero.</span>
            ) : (
              availableItems.map(it => {
                const isSelected = selectedIds.includes(String(it.id));
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
                        onChange={() => {}} // Manejado por onClick del contenedor
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                      />
                      <span className="font-bold text-xs text-cyan-400">#{it.id}</span>
                      <span className="text-xs font-medium">{it.indicator}</span>
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
            className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg hover:scale-[1.02]"
          >
            Aplicar Agregado
          </button>
        </div>

      </div>
    </div>
  );
};
