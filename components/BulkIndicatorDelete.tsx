import React, { useState, useMemo } from 'react';
import { Dashboard } from '../types';

interface BulkIndicatorDeleteProps {
    dashboards: Dashboard[];
    selectedYear: number;
    activeClientId: string;
    onDelete: (indicatorName: string, dashboardIds: number[]) => Promise<void>;
    onCancel: () => void;
}

export const BulkIndicatorDelete = ({ dashboards, selectedYear, activeClientId, onDelete, onCancel }: BulkIndicatorDeleteProps) => {
    const [selectedIndicator, setSelectedIndicator] = useState<string>('');
    const [selectedDashboards, setSelectedDashboards] = useState<Set<number>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    // Get all unique indicators across all dashboards for the selected year
    const availableIndicators = useMemo(() => {
        const indicatorMap = new Map<string, { name: string; count: number; dashboardIds: number[] }>();

        dashboards
            .filter(d => (d.clientId || 'ips') === activeClientId && (d.year || 2025) === selectedYear)
            .forEach(dashboard => {
                dashboard.items.forEach(item => {
                    const existing = indicatorMap.get(item.indicator);
                    if (existing) {
                        existing.count++;
                        existing.dashboardIds.push(Number(dashboard.id));
                    } else {
                        indicatorMap.set(item.indicator, {
                            name: item.indicator,
                            count: 1,
                            dashboardIds: [Number(dashboard.id)]
                        });
                    }
                });
            });

        return Array.from(indicatorMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [dashboards, activeClientId, selectedYear]);

    // Get dashboards that have the selected indicator
    const dashboardsWithIndicator = useMemo(() => {
        if (!selectedIndicator) return [];

        return dashboards
            .filter(d =>
                (d.clientId || 'ips') === activeClientId &&
                (d.year || 2025) === selectedYear &&
                d.items.some(item => item.indicator === selectedIndicator)
            )
            .map(d => ({
                id: d.id,
                title: d.title,
                group: d.group || 'Sin grupo'
            }));
    }, [dashboards, selectedIndicator, activeClientId, selectedYear]);

    const handleToggleDashboard = (dashboardId: number) => {
        setSelectedDashboards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(dashboardId)) {
                newSet.delete(dashboardId);
            } else {
                newSet.add(dashboardId);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        setSelectedDashboards(new Set(dashboardsWithIndicator.map(d => Number(d.id))));
    };

    const handleDeselectAll = () => {
        setSelectedDashboards(new Set());
    };

    const handleDelete = async () => {
        if (!selectedIndicator || selectedDashboards.size === 0) return;

        const dashboardIds = Array.from(selectedDashboards);
        const confirmMessage = `¿Estás seguro de eliminar el indicador "${selectedIndicator}" de ${dashboardIds.length} tablero(s)?

Esta acción eliminará:
- El indicador
- Todas sus metas
- Todo su progreso

Esta acción NO se puede deshacer.`;

        if (!window.confirm(confirmMessage)) return;

        setIsDeleting(true);
        try {
            await onDelete(selectedIndicator, dashboardIds as number[]);
            // Reset selection
            setSelectedIndicator('');
            setSelectedDashboards(new Set());
        } catch (error) {
            console.error("Error deleting indicator:", error);
            alert("Error al eliminar el indicador. Verifica la consola para más detalles.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onCancel}>
            <div className="bg-slate-800 rounded-xl shadow-2xl ring-1 ring-white/10 w-full max-w-4xl p-6 flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-slate-100 mb-2">Eliminar Indicador en Múltiples Tableros</h3>
                    <p className="text-sm text-slate-400">
                        Selecciona un indicador y los tableros de los que deseas eliminarlo.
                    </p>
                </div>

                {/* Step 1: Select Indicator */}
                <div className="mb-6">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                        Paso 1: Selecciona el indicador a eliminar
                    </label>
                    <select
                        value={selectedIndicator}
                        onChange={(e) => {
                            setSelectedIndicator(e.target.value);
                            setSelectedDashboards(new Set());
                        }}
                        className="w-full bg-slate-700 border border-slate-600 rounded-md p-3 text-white focus:ring-2 focus:ring-cyan-500 outline-none"
                    >
                        <option value="">-- Selecciona un indicador --</option>
                        {availableIndicators.map(indicator => (
                            <option key={indicator.name} value={indicator.name}>
                                {indicator.name} ({indicator.count} tablero{indicator.count > 1 ? 's' : ''})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Step 2: Select Dashboards */}
                {selectedIndicator && (
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-semibold text-slate-300">
                                Paso 2: Selecciona los tableros ({selectedDashboards.size} de {dashboardsWithIndicator.length})
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                                >
                                    Seleccionar todos
                                </button>
                                <span className="text-slate-600">|</span>
                                <button
                                    onClick={handleDeselectAll}
                                    className="text-xs text-slate-400 hover:text-slate-300 font-medium"
                                >
                                    Deseleccionar todos
                                </button>
                            </div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                            {dashboardsWithIndicator.length === 0 ? (
                                <p className="text-slate-500 text-sm">No se encontraron tableros con este indicador.</p>
                            ) : (
                                <div className="space-y-2">
                                    {dashboardsWithIndicator.map(dashboard => (
                                        <label
                                            key={dashboard.id}
                                            className="flex items-center gap-3 p-2 rounded-md hover:bg-slate-800/50 cursor-pointer transition"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedDashboards.has(Number(dashboard.id))}
                                                onChange={() => handleToggleDashboard(Number(dashboard.id))}
                                                className="w-4 h-4 text-cyan-600 bg-slate-700 border-slate-600 rounded focus:ring-cyan-500 focus:ring-2"
                                            />
                                            <div className="flex-1">
                                                <span className="text-sm text-slate-200 font-medium">{dashboard.title}</span>
                                                <span className="text-xs text-slate-500 ml-2">({dashboard.group})</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Warning */}
                {selectedIndicator && selectedDashboards.size > 0 && (
                    <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <div>
                                <p className="text-red-300 text-sm font-semibold">⚠️ Acción Irreversible</p>
                                <p className="text-red-400/80 text-xs mt-1">
                                    Se eliminará &quot;{selectedIndicator}&quot; de {selectedDashboards.size} tablero(s), incluyendo todas sus metas y progreso.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-4 pt-6 border-t border-slate-700">
                    <button
                        onClick={onCancel}
                        disabled={isDeleting}
                        className="px-5 py-2 rounded-md bg-slate-600 hover:bg-slate-500 transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={!selectedIndicator || selectedDashboards.size === 0 || isDeleting}
                        className="px-5 py-2 rounded-md bg-red-600 hover:bg-red-500 transition-colors text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isDeleting ? (
                            <>
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Eliminando...
                            </>
                        ) : (
                            <>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" />
                                </svg>
                                Eliminar de {selectedDashboards.size} Tablero(s)
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
