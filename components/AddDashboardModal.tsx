import React, { useState } from 'react';
import { Dashboard } from '../types';

interface AddDashboardModalProps {
  isOpen: boolean;
  onConfirm: (title: string, group: string, initialIndicator: { name: string, weight: number }, sourceDashboardId?: number | null) => void;
  onCancel: () => void;
  dashboards: Dashboard[];
  dashboardLabel: string;
  groupLabel: string;
  existingGroups: string[];
}

export const AddDashboardModal = ({ isOpen, onConfirm, onCancel, dashboards, dashboardLabel, groupLabel, existingGroups }: AddDashboardModalProps) => {
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [indicatorName, setIndicatorName] = useState('');
  const [indicatorWeight, setIndicatorWeight] = useState(100);
  const [sourceDashboardId, setSourceDashboardId] = useState<string>('');

  if (!isOpen) {
    return null;
  }

  const handleConfirm = () => {
    if (title.trim() && indicatorName.trim()) {
      const sourceId = sourceDashboardId ? parseInt(sourceDashboardId, 10) : null;
      onConfirm(title.trim(), group.trim(), { name: indicatorName.trim(), weight: indicatorWeight }, sourceId);
      // Reset
      setTitle('');
      setGroup('');
      setIndicatorName('');
      setIndicatorWeight(100);
      setSourceDashboardId('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Only submit if all required fields are present
      if (title.trim() && indicatorName.trim()) {
        e.preventDefault();
        handleConfirm();
      }
    }
  }

  const isFormValid = title.trim().length > 0 && indicatorName.trim().length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-slate-100 mb-4">Crear Nuevo {dashboardLabel}</h3>

        <div className="space-y-4">
          {/* Título */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Nombre del {dashboardLabel} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-base focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder={`Ej: ${dashboardLabel} Operativo`}
              autoFocus
            />
          </div>

          {/* Grupo (Dirección / Gerencia) */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              {groupLabel} (Opcional)
            </label>
            <input
              type="text"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-base focus:ring-2 focus:ring-cyan-500 outline-none"
              placeholder={`Ej: ${groupLabel} Norte`}
              list="existing-groups"
            />
            <datalist id="existing-groups">
              {existingGroups.map(g => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div className="border-t border-slate-700 pt-4 mt-2">
            <p className="text-sm text-cyan-400 font-semibold mb-3">Primer Indicador (Requerido)</p>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Nombre del Indicador <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={indicatorName}
                  onChange={(e) => setIndicatorName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                  placeholder="Ej: % Ventas vs Meta"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Peso (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={indicatorWeight}
                  onChange={(e) => setIndicatorWeight(Number(e.target.value))}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>
          </div>


          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Importar desde otro {dashboardLabel} (Opcional)
            </label>
            <select
              value={sourceDashboardId}
              onChange={e => setSourceDashboardId(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-base focus:ring-2 focus:ring-cyan-500 outline-none"
            >
              <option value="">-- No importar ({dashboardLabel} Limpio) --</option>
              {dashboards.map(d => (
                <option key={d.id} value={d.id}>{d.title}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">Si importas, se copiarán los indicadores del tablero seleccionado.</p>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="px-5 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isFormValid}
            className="px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition-colors text-sm font-semibold text-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
          >
            Crear {dashboardLabel}
          </button>
        </div>
      </div>
    </div>
  );
};