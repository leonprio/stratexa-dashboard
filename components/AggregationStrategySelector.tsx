import React, { useState } from 'react';
import { Dashboard, SystemSettings } from '../types';

interface AggregationStrategySelectorProps {
    settings: SystemSettings | undefined;
    dashboards: Dashboard[];
    onSave: (settings: Partial<SystemSettings>, dashboardWeights?: Record<number, number>) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}

export const AggregationStrategySelector: React.FC<AggregationStrategySelectorProps> = ({
    settings,
    dashboards,
    onSave,
    onCancel,
    isLoading
}) => {
    const [strategy, setStrategy] = useState<SystemSettings['aggregationStrategy']>(
        settings?.aggregationStrategy || 'equal'
    );

    const [indicatorDriver, setIndicatorDriver] = useState<string>(
        settings?.indicatorDriver || ''
    );

    // Inicializar pesos manuales
    const [manualWeights, setManualWeights] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        const relevantDashboards = dashboards.filter(d => typeof d.id === 'number');

        relevantDashboards.forEach(d => {
            const sid = String(d.id);
            // Prioridad: 1. CustomWeight guardado, 2. Peso en dashboard, 3. Equal split
            if (settings?.customWeights?.[sid]) {
                initial[sid] = settings.customWeights[sid];
            } else {
                initial[sid] = d.dashboardWeight || (100 / relevantDashboards.length);
            }
        });
        return initial;
    });

    const relevantDashboards = dashboards.filter(d => typeof d.id === 'number');

    // Obtener lista única de indicadores disponibles para el dropdown
    const availableIndicators = Array.from(new Set(
        dashboards.flatMap(d => d.items.map(i => i.indicator))
    )).sort();

    const handleSave = async () => {
        const updates: Partial<SystemSettings> = {
            aggregationStrategy: strategy,
            indicatorDriver: strategy === 'indicator' ? indicatorDriver : undefined,
            customWeights: strategy === 'manual' ? manualWeights : undefined
        };

        // Convertir keys string a number para la persistencia individual si fuera necesario
        // Pero aquí guardamos en settings global principalmente.
        await onSave(updates);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] w-full max-w-2xl p-8 shadow-3xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

                <div className="text-center mb-8 flex-shrink-0">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-500/20">
                        <span className="text-3xl">⚖️</span>
                    </div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter mb-2 text-white">Estrategia de Ponderación Global</h2>
                    <p className="text-slate-400 text-sm max-w-md mx-auto">
                        Define cómo se calcula el cumplimiento del Tablero General Consolidado.
                    </p>
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-6">

                    {/* Selector de Estrategia */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <button
                            onClick={() => setStrategy('equal')}
                            className={`p-4 rounded-xl border text-left transition-all ${strategy === 'equal'
                                ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-400/30'
                                : 'bg-slate-800 border-white/5 hover:bg-slate-700'
                                }`}
                        >
                            <div className="text-2xl mb-2">🤝</div>
                            <div className="font-bold text-sm text-white mb-1">Equitativo</div>
                            <div className="text-[10px] text-slate-300 leading-relaxed">
                                Todos los tableros valen lo mismo. Promedio simple.
                            </div>
                        </button>

                        <button
                            onClick={() => setStrategy('manual')}
                            className={`p-4 rounded-xl border text-left transition-all ${strategy === 'manual'
                                ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-400/30'
                                : 'bg-slate-800 border-white/5 hover:bg-slate-700'
                                }`}
                        >
                            <div className="text-2xl mb-2">🎛️</div>
                            <div className="font-bold text-sm text-white mb-1">Estratégico</div>
                            <div className="text-[10px] text-slate-300 leading-relaxed">
                                Asignación manual de peso (%) a cada tablero según su importancia.
                            </div>
                        </button>

                        <button
                            onClick={() => setStrategy('indicator')}
                            className={`p-4 rounded-xl border text-left transition-all ${strategy === 'indicator'
                                ? 'bg-indigo-600 border-indigo-500 ring-2 ring-indigo-400/30'
                                : 'bg-slate-800 border-white/5 hover:bg-slate-700'
                                }`}
                        >
                            <div className="text-2xl mb-2">📈</div>
                            <div className="font-bold text-sm text-white mb-1">Por Volumen</div>
                            <div className="text-[10px] text-slate-300 leading-relaxed">
                                El peso lo dicta un indicador clave (ej. Estado de Fuerza, Ventas).
                            </div>
                        </button>
                    </div>

                    {/* Configuración Específica */}
                    <div className="bg-slate-950/50 rounded-2xl p-6 border border-white/5">

                        {strategy === 'equal' && (
                            <div className="text-center py-4">
                                <p className="text-slate-400 text-sm">
                                    Cada uno de los <span className="text-white font-bold">{relevantDashboards.length}</span> tableros tendrá un peso del
                                    <span className="text-indigo-400 font-bold ml-1">{(100 / (relevantDashboards.length || 1)).toFixed(1)}%</span>.
                                </p>
                            </div>
                        )}

                        {strategy === 'manual' && (
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-white/5 pb-2">
                                    <span>Tablero</span>
                                    <span>Peso (%)</span>
                                </div>
                                {relevantDashboards.map(d => (
                                    <div key={d.id} className="flex items-center justify-between gap-4">
                                        <span className="text-sm text-slate-300 truncate flex-1">{d.title}</span>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={manualWeights[String(d.id)] || 0}
                                                onChange={(e) => {
                                                    const val = parseFloat(e.target.value) || 0;
                                                    setManualWeights(prev => ({ ...prev, [String(d.id)]: val }));
                                                }}
                                                className="w-20 bg-slate-900 border border-slate-700 rounded-lg p-2 text-right text-white font-mono focus:border-indigo-500 outline-none"
                                            />
                                            <span className="text-slate-600">%</span>
                                        </div>
                                    </div>
                                ))}

                                <div className="pt-4 mt-4 border-t border-white/5 flex justify-between items-center">
                                    <span className="text-xs text-slate-500 font-bold uppercase">Total</span>
                                    <span className={`text-lg font-black ${(Object.values(manualWeights).reduce((a: number, b: number) => a + b, 0) as number).toFixed(0) === '100'
                                        ? 'text-emerald-400'
                                        : 'text-amber-400'
                                        }`}>
                                        {(Object.values(manualWeights).reduce((a: number, b: number) => a + b, 0) as number).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )}

                        {strategy === 'indicator' && (
                            <div className="space-y-4">
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                                    Selecciona el Indicador Maestro (&quot;Driver&quot;)
                                </label>
                                <select
                                    value={indicatorDriver}
                                    onChange={(e) => setIndicatorDriver(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white outline-none focus:border-indigo-500"
                                >
                                    <option value="">-- Seleccionar Indicador --</option>
                                    {availableIndicators.map(ind => (
                                        <option key={ind} value={ind}>{ind}</option>
                                    ))}
                                </select>

                                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                    <h4 className="text-indigo-400 text-xs font-bold uppercase mb-2">Simulación del Peso Actual:</h4>
                                    <div className="space-y-1 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                        {relevantDashboards.map(d => {
                                            const item = d.items.find(i => i.indicator === indicatorDriver);

                                            // Lógica robusta de simulación (igual que en backend)
                                            let val = 0;
                                            if (item?.monthlyProgress) {
                                                // Buscar último valor no-nulo
                                                const validVals = item.monthlyProgress.filter(v => v !== null && v !== 0);
                                                val = validVals.length > 0 ? Number(validVals[validVals.length - 1]) : 0;
                                            }

                                            return (
                                                <div key={d.id} className="flex justify-between text-xs">
                                                    <span className="text-slate-400 truncate w-2/3">{d.title}</span>
                                                    <span className={`font-mono ${val === 0 ? 'text-amber-500' : 'text-white'}`}>
                                                        {val === 0 ? '0 (⚠️ Sin datos)' : `${val} (u.)`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex gap-4 flex-shrink-0">
                    <button
                        onClick={onCancel}
                        disabled={isLoading}
                        className="flex-1 py-4 bg-transparent hover:bg-white/5 text-slate-400 font-bold rounded-xl transition-all uppercase tracking-widest text-xs"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || (strategy === 'indicator' && !indicatorDriver)}
                        className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl shadow-lg shadow-indigo-900/40 transition-all uppercase tracking-widest text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Guardando...' : 'Guardar Estrategia'}
                    </button>
                </div>

            </div>
        </div>
    );
};
