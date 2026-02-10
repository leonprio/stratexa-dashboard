import React, { useState, useMemo } from 'react';
import { Dashboard, SystemSettings } from '../types';

interface WeightControlCenterProps {
    settings: SystemSettings | undefined;
    dashboards: Dashboard[];
    onSave: (settings: Partial<SystemSettings>) => Promise<void>;
    onCancel: () => void;
    isLoading: boolean;
}

export const WeightControlCenter: React.FC<WeightControlCenterProps> = ({
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

    // Filtrar solo tableros reales (no totales)
    const relevantDashboards = useMemo(() =>
        dashboards.filter(d => !String(d.id).startsWith('agg-') && d.id !== -1),
        [dashboards]);

    // Inicializar pesos manuales con lógica de recuperación
    const [manualWeights, setManualWeights] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        relevantDashboards.forEach(d => {
            const sid = String(d.id);
            // Prioridad: 1. CustomWeight global, 2. Peso local del tablero, 3. Equal split (fallback)
            initial[sid] = settings?.customWeights?.[sid] ?? d.dashboardWeight ?? (100 / (relevantDashboards.length || 1));
        });
        return initial;
    });

    // Cálculos de simulación para mostrar impacto visual
    const effectiveWeights = useMemo(() => {
        const weights: Record<string, number> = {};

        if (strategy === 'equal') {
            const val = 100 / (relevantDashboards.length || 1);
            relevantDashboards.forEach(d => weights[String(d.id)] = val);
        } else if (strategy === 'manual') {
            relevantDashboards.forEach(d => weights[String(d.id)] = manualWeights[String(d.id)] || 0);
        } else if (strategy === 'indicator' && indicatorDriver) {
            // Simular basado en el último valor del driver
            let totalVal = 0;
            const values: Record<string, number> = {};

            relevantDashboards.forEach(d => {
                const item = d.items.find(i => i.indicator.trim().toUpperCase() === indicatorDriver.trim().toUpperCase());
                let val = 0;
                if (item?.monthlyProgress) {
                    const validVals = item.monthlyProgress.filter(v => v !== null && v !== 0);
                    val = validVals.length > 0 ? Number(validVals[validVals.length - 1]) : 0.1;
                }
                values[String(d.id)] = val;
                totalVal += val;
            });

            relevantDashboards.forEach(d => {
                weights[String(d.id)] = totalVal > 0 ? (values[String(d.id)] / totalVal) * 100 : (100 / relevantDashboards.length);
            });
        }

        return weights;
    }, [strategy, indicatorDriver, manualWeights, relevantDashboards]);

    const totalWeight = useMemo(() =>
        (Object.values(effectiveWeights) as number[]).reduce((a, b) => a + b, 0),
        [effectiveWeights]);

    const availableIndicators = useMemo(() =>
        Array.from(new Set(dashboards.flatMap(d => d.items.map(i => i.indicator)))).sort(),
        [dashboards]);

    const handleSave = async () => {
        if (strategy === 'manual' && Math.abs(totalWeight - 100) > 0.1) {
            alert('La suma de las ponderaciones manuales debe ser exactamente 100%.');
            return;
        }

        const updates: Partial<SystemSettings> = {
            aggregationStrategy: strategy,
            indicatorDriver: strategy === 'indicator' ? indicatorDriver : undefined,
            customWeights: strategy === 'manual' ? manualWeights : undefined
        };

        await onSave(updates);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-slate-900 border border-white/10 rounded-[2rem] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col ring-1 ring-white/5">

                {/* Header Premium */}
                <div className="p-8 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-3 mb-2">
                                <span className="p-2 bg-indigo-500/20 rounded-lg text-xl">⚖️</span>
                                <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Centro de Control de Pesos</h2>
                            </div>
                            <p className="text-slate-400 text-sm">
                                Auditoría de impacto en el cumplimiento global del cliente.
                            </p>
                        </div>
                        <div className={`px-4 py-2 rounded-xl border font-mono font-bold text-lg ${Math.abs(totalWeight - 100) < 0.1 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'}`}>
                            TOTAL: {totalWeight.toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Sidebar: Estrategias */}
                    <div className="w-full md:w-72 bg-black/20 p-6 border-r border-white/5 space-y-4">
                        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Estrategia Activa</h3>

                        <StrategyButton
                            active={strategy === 'equal'}
                            onClick={() => setStrategy('equal')}
                            icon="🤝" title="Equitativo"
                            desc="Promedio simple entre todos."
                        />
                        <StrategyButton
                            active={strategy === 'manual'}
                            onClick={() => setStrategy('manual')}
                            icon="🎛️" title="Estratégico"
                            desc="Manual por importancia."
                        />
                        <StrategyButton
                            active={strategy === 'indicator'}
                            onClick={() => setStrategy('indicator')}
                            icon="📈" title="Por Volumen"
                            desc="Pesa el que tiene más datos."
                        />

                        {strategy === 'indicator' && (
                            <div className="pt-4 border-t border-white/5 animate-in slide-in-from-left duration-300">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Indicador Maestro</label>
                                <select
                                    value={indicatorDriver}
                                    onChange={(e) => setIndicatorDriver(e.target.value)}
                                    className="w-full bg-slate-800 border border-white/10 rounded-lg p-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">-- Seleccionar --</option>
                                    {availableIndicators.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Main Content: Weight Map */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-900/40">
                        <div className="mb-6 flex justify-between items-center">
                            <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Mapa de Distribución</h3>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded font-bold uppercase">
                                Visualización de Impacto Actual
                            </span>
                        </div>

                        <div className="space-y-4">
                            {relevantDashboards.map(d => {
                                const weightVal = effectiveWeights[String(d.id)] || 0;
                                return (
                                    <div key={d.id} className="group bg-slate-800/20 border border-white/5 rounded-2xl p-4 hover:bg-slate-800/40 transition-all duration-300">
                                        <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-xs font-bold text-indigo-400 border border-indigo-500/20">
                                                    {(d as any).orderNumber || '#'}
                                                </div>
                                                <span className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors uppercase tracking-tight">{d.title}</span>
                                            </div>

                                            {strategy === 'manual' ? (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number"
                                                        value={manualWeights[String(d.id)] || 0}
                                                        onChange={(e) => {
                                                            const val = parseFloat(e.target.value) || 0;
                                                            setManualWeights(prev => ({ ...prev, [String(d.id)]: val }));
                                                        }}
                                                        className="w-16 bg-slate-950 border border-white/10 rounded-lg p-1.5 text-center text-sm font-mono text-white focus:ring-1 focus:ring-indigo-500 outline-none"
                                                    />
                                                    <span className="text-xs text-slate-500 font-bold">%</span>
                                                </div>
                                            ) : (
                                                <div className="text-right">
                                                    <span className="text-sm font-black font-mono text-white inline-block w-16 text-right">
                                                        {weightVal === 0 ? '0' : weightVal.toFixed(1)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Barra de Progreso Visual */}
                                        <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex">
                                            <div
                                                className={`h-full transition-all duration-500 ease-out ${strategy === 'manual' ? 'bg-indigo-500' : 'bg-slate-600'}`}
                                                style={{ width: `${weightVal}%` }}
                                            />
                                            {/* Ghost impact indicator (si hubiera una diferencia significativa que mostrar) */}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Footer Acciones */}
                <div className="p-6 border-t border-white/5 bg-black/20 flex gap-4">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 bg-transparent hover:bg-white/5 text-slate-400 font-bold rounded-2xl transition-all uppercase tracking-widest text-[10px]"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading || (strategy === 'indicator' && !indicatorDriver)}
                        className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-indigo-900/20 transition-all uppercase tracking-widest text-[10px] disabled:opacity-30 disabled:grayscale"
                    >
                        {isLoading ? 'Sincronizando...' : 'Confirmar y Aplicar Ponderación'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Sub-componente para botones de estrategia
const StrategyButton = ({ active, onClick, icon, title, desc }: any) => (
    <button
        onClick={onClick}
        className={`w-full p-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden ${active
            ? 'bg-indigo-600/20 border-indigo-500/50 ring-2 ring-indigo-500/20'
            : 'bg-white/5 border-white/5 hover:bg-white/10'
            }`}
    >
        {active && <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-500 flex items-center justify-center rounded-bl-xl text-[10px] text-white animate-in slide-in-from-top-right duration-300">✓</div>}
        <div className="text-2xl mb-2">{icon}</div>
        <div className="font-black text-xs text-white uppercase tracking-tighter mb-1">{title}</div>
        <div className="text-[9px] text-slate-400 leading-tight uppercase font-bold tracking-wider">{desc}</div>
    </button>
);
