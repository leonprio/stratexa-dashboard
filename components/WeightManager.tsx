import React, { useState, useMemo } from 'react';
import { DashboardItem } from '../types';

interface WeightManagerProps {
    key?: React.Key;
    items: DashboardItem[];
    onSave: (updatedWeights: { id: number; weight: number }[]) => void;
    onCancel: () => void;
    dashboards: { id: number | string; title: string }[];
    activeDashboardId: number | string;
    onDashboardSelect: (id: number | string) => void;
}

export const WeightManager = ({ items, onSave, onCancel, dashboards, activeDashboardId, onDashboardSelect }: WeightManagerProps) => {
    const [weights, setWeights] = useState(() =>
        items.map(item => ({ id: item.id, weight: item.weight }))
    );

    const handleWeightChange = (id: number, value: string) => {
        const numericValue = Number(value);
        if (isNaN(numericValue)) return;

        setWeights(currentWeights =>
            currentWeights.map(w => w.id === id ? { ...w, weight: numericValue } : w)
        );
    };

    const totalWeight = useMemo(() => weights.reduce((sum, w) => sum + w.weight, 0), [weights]);

    const handleSave = () => {
        if (totalWeight !== 100) {
            alert('La suma de las ponderaciones debe ser exactamente 100%.');
            return;
        }
        onSave(weights);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-100">Gestionar Ponderaciones</h3>
                        <p className="text-sm text-slate-400">Ajusta el peso de cada indicador.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-400">Tablero:</span>
                        <select
                            value={String(activeDashboardId)}
                            onChange={(e) => onDashboardSelect(e.target.value)}
                            className="bg-slate-700 border border-slate-600 rounded-md p-2 text-white text-sm focus:ring-2 focus:ring-cyan-500 outline-none w-[180px]"
                        >
                            {dashboards.map(d => (
                                <option key={d.id} value={d.id}>{d.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-3">
                    {items.map(item => {
                        const currentWeight = weights.find(w => w.id === item.id)?.weight ?? 0;
                        return (
                            <div key={item.id} className="flex items-center justify-between gap-4 p-3 bg-slate-900/50 rounded-lg">
                                <span className="text-slate-300 flex-1 truncate" title={item.indicator}>{item.indicator}</span>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={currentWeight}
                                        onChange={(e) => handleWeightChange(item.id, e.target.value)}
                                        className="w-24 bg-slate-700 border border-slate-600 rounded-md p-2 text-white font-mono text-base focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 outline-none transition text-center"
                                    />
                                    <span className="text-slate-400">%</span>
                                </div>
                            </div>
                        )
                    })}
                </div>

                <div className={`flex justify-between items-center mt-6 pt-4 border-t border-slate-700 font-bold ${totalWeight === 100 ? 'text-green-400' : 'text-red-400'}`}>
                    <span>Total</span>
                    <span>{new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalWeight)}%</span>
                </div>
                {totalWeight !== 100 && (
                    <p className="text-xs text-red-400 text-center mt-1">El total debe ser 100% para poder guardar.</p>
                )}


                <div className="flex justify-end gap-4 mt-6">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={totalWeight !== 100}
                        className="px-5 py-2 rounded-md bg-cyan-600 hover:bg-cyan-500 transition-colors text-sm font-semibold text-white disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                        Guardar Ponderaciones
                    </button>
                </div>
            </div>
        </div>
    );
};
