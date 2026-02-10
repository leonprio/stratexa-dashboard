
import React, { useState } from 'react';
import { ComplianceThresholds } from '../types';

interface ThresholdEditorProps {
  thresholds: ComplianceThresholds;
  onSave: (newThresholds: ComplianceThresholds) => void;
  onCancel: () => void;
}

export const ThresholdEditor = ({ thresholds, onSave, onCancel }: ThresholdEditorProps) => {
  const [localThresholds, setLocalThresholds] = useState(thresholds);

  const handleChange = (field: keyof ComplianceThresholds, value: string) => {
    const numericValue = Number(value);
    if (!isNaN(numericValue) && numericValue >= 0 && numericValue <= 100) {
      setLocalThresholds(prev => ({ ...prev, [field]: numericValue }));
    }
  };

  const handleSave = () => {
    if (localThresholds.onTrack < localThresholds.atRisk) {
      alert("El umbral 'En Rumbo' no puede ser menor que el umbral 'En Riesgo'.");
      return;
    }
    onSave(localThresholds);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-xl font-bold text-slate-100 mb-4">Configurar Umbrales Globales</h3>
        <p className="text-sm text-slate-400 mb-6">Estos umbrales se aplicarán a todos los indicadores del dashboard.</p>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="onTrack-threshold" className="block text-sm font-medium text-slate-300 mb-1">
              En Rumbo (≥)
            </label>
            <input
              id="onTrack-threshold"
              type="number"
              min="0" max="100"
              value={localThresholds.onTrack}
              onChange={(e) => handleChange('onTrack', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-base focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
            />
          </div>
          <div>
            <label htmlFor="atRisk-threshold" className="block text-sm font-medium text-slate-300 mb-1">
              En Riesgo (≥)
            </label>
            <input
              id="atRisk-threshold"
              type="number"
              min="0" max="100"
              value={localThresholds.atRisk}
              onChange={(e) => handleChange('atRisk', e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-base focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition"
            />
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-slate-700">
          <button 
            onClick={onCancel}
            className="px-5 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            className="px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition-colors text-sm font-semibold text-white"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};